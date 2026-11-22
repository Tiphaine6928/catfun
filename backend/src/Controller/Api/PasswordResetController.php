<?php

namespace App\Controller\Api;

use App\Entity\ResetPasswordRequest;
use App\Entity\User;
use App\Repository\ResetPasswordRequestRepository;
use App\Repository\UserRepository;
use App\Security\PasswordRules;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * « Mot de passe oublié » : envoi d'un lien par email, puis choix d'un nouveau mot de passe.
 */
#[Route('/api/password', name: 'api_password_')]
class PasswordResetController extends AbstractController
{
    use JsonApiTrait;

    /** Même réponse que le compte existe ou non : on ne révèle pas quels emails sont inscrits. */
    public const SENT_MESSAGE = 'Si un compte existe avec cet email, tu vas recevoir un lien pour choisir un nouveau mot de passe. Il est valable 1 heure.';

    public function __construct(
        private readonly ResetPasswordRequestRepository $requests,
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    /**
     * Envoie le lien. Corps JSON : {"email": "..."}
     * Réponse 202, identique que l'email corresponde à un compte ou non.
     */
    #[Route('/forgot', name: 'forgot', methods: ['POST'])]
    public function forgot(
        Request $request,
        UserRepository $users,
        MailerInterface $mailer,
        LoggerInterface $logger,
        RateLimiterFactory $passwordResetLimiter,
        RateLimiterFactory $passwordResetPerEmailLimiter,
        #[Autowire(env: 'FRONTEND_URL')] string $frontendUrl,
        #[Autowire(env: 'MAILER_FROM')] string $mailerFrom,
    ): JsonResponse {
        // Par adresse IP (config/packages/rate_limiter.yaml)
        $limit = $passwordResetLimiter->create($request->getClientIp() ?? 'inconnue')->consume();
        if (!$limit->isAccepted()) {
            $wait = max(1, $limit->getRetryAfter()->getTimestamp() - time());

            return $this->json(
                ['message' => sprintf('Trop de demandes. Réessaie dans %d minute%s.', $minutes = max(1, (int) round($wait / 60)), $minutes > 1 ? 's' : '')],
                Response::HTTP_TOO_MANY_REQUESTS,
                ['Retry-After' => (string) $wait],
            );
        }

        $data = $this->decodeJsonBody($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }
        $email = $data['email'] ?? null;
        if (!\is_string($email) || '' === trim($email)) {
            return $this->validationError(['email' => 'Merci de saisir ton email.']);
        }

        $user = $users->findOneBy(['email' => trim($email)]);
        // Au plus quelques emails par heure pour un même compte : personne ne peut remplir la boîte d'un autre
        $perEmail = $passwordResetPerEmailLimiter->create(mb_strtolower(trim($email)))->consume();
        if ($user instanceof User && $perEmail->isAccepted()) {
            $this->requests->deleteForUser($user);
            [$resetRequest, $token] = ResetPasswordRequest::create($user);
            $this->entityManager->persist($resetRequest);
            $this->entityManager->flush();

            $link = rtrim($frontendUrl, '/').'/#/nouveau-mot-de-passe?token='.$token;
            try {
                $mailer->send($this->buildEmail($user, $link, $mailerFrom));
            } catch (TransportExceptionInterface $exception) {
                // Le visiteur ne doit pas savoir si le compte existe : on garde la même réponse
                $logger->error('Email de nouveau mot de passe non envoyé : {error}', ['error' => $exception->getMessage()]);
            }
        }

        return $this->json(['message' => self::SENT_MESSAGE], Response::HTTP_ACCEPTED);
    }

    /**
     * Change le mot de passe avec le jeton du lien. Corps JSON : {"token": "...", "password": "..."}
     */
    #[Route('/reset', name: 'reset', methods: ['POST'])]
    public function reset(
        Request $request,
        ValidatorInterface $validator,
        UserPasswordHasherInterface $passwordHasher,
    ): JsonResponse {
        $data = $this->decodeJsonBody($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }
        $token = $data['token'] ?? null;
        $password = $data['password'] ?? null;
        if (!\is_string($password)) {
            return $this->validationError(['password' => 'Merci de saisir un mot de passe.']);
        }

        $resetRequest = \is_string($token) && preg_match('/^[0-9a-f]{64}$/', $token) ? $this->requests->findOneByToken($token) : null;
        if (null === $resetRequest || $resetRequest->isExpired()) {
            return $this->error('Ce lien n\'est plus valable (il a expiré ou a déjà servi). Demande un nouveau lien.', Response::HTTP_GONE);
        }

        $violations = $validator->validate($password, PasswordRules::constraints());
        if (\count($violations) > 0) {
            return $this->validationError(['password' => (string) $violations[0]->getMessage()]);
        }

        $user = $resetRequest->getUser();
        $user->setPassword($passwordHasher->hashPassword($user, $password));
        // Le lien ne sert qu'une fois
        $this->requests->deleteForUser($user);
        $this->entityManager->flush();

        return $this->json(['message' => 'Ton mot de passe a été changé.']);
    }

    private function buildEmail(User $user, string $link, string $from): Email
    {
        $pseudo = $user->getPseudo() ?? '';
        $safePseudo = htmlspecialchars($pseudo, \ENT_QUOTES);
        $safeLink = htmlspecialchars($link, \ENT_QUOTES);

        return (new Email())
            ->from(Address::create($from))
            ->to($user->getEmail() ?? '')
            ->subject('CatFun : choisis un nouveau mot de passe')
            ->text(<<<TEXT
                Bonjour {$pseudo},

                Tu as demandé à changer ton mot de passe CatFun. Ouvre ce lien pour en choisir un nouveau :
                {$link}

                Ce lien est valable 1 heure et ne sert qu'une fois.
                Si tu n'as rien demandé, ignore cet email : ton mot de passe reste le même.

                Twixy et Aïna 🐾
                TEXT)
            ->html(<<<HTML
                <p>Bonjour {$safePseudo},</p>
                <p>Tu as demandé à changer ton mot de passe CatFun.</p>
                <p><a href="{$safeLink}" style="display:inline-block;padding:10px 18px;background:#5e35b1;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:bold">Choisir un nouveau mot de passe</a></p>
                <p>Ce lien est valable 1 heure et ne sert qu'une fois.<br>Si tu n'as rien demandé, ignore cet email : ton mot de passe reste le même.</p>
                <p>Twixy et Aïna 🐾</p>
                HTML);
    }
}
