<?php

namespace App\Controller\Api;

use App\Entity\EmailChangeRequest;
use App\Entity\User;
use App\Repository\EmailChangeRequestRepository;
use App\Repository\UserRepository;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
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
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * Changement d'email (droit de rectification, RGPD) :
 * 1. POST /api/me/email : le joueur connecté donne sa nouvelle adresse et son mot de passe ;
 *    un lien de confirmation part vers la nouvelle adresse, l'ancienne est prévenue.
 * 2. POST /api/email/confirm : le lien confirme le changement.
 */
class EmailChangeController extends AbstractController
{
    use JsonApiTrait;

    public function __construct(
        private readonly EmailChangeRequestRepository $requests,
        private readonly EntityManagerInterface $entityManager,
        private readonly MailerInterface $mailer,
        private readonly LoggerInterface $logger,
        #[Autowire(env: 'FRONTEND_URL')] private readonly string $frontendUrl,
        #[Autowire(env: 'MAILER_FROM')] private readonly string $mailerFrom,
    ) {
    }

    /**
     * Corps JSON : {"email": "nouvelle@adresse", "password": "..."}
     */
    #[Route('/api/me/email', name: 'api_me_email', methods: ['POST'])]
    public function request(
        Request $request,
        #[CurrentUser] User $user,
        UserRepository $users,
        UserPasswordHasherInterface $passwordHasher,
        ValidatorInterface $validator,
        RateLimiterFactory $emailChangeLimiter,
    ): JsonResponse {
        $data = $this->decodeJsonBody($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }
        $email = \is_string($data['email'] ?? null) ? trim($data['email']) : null;
        $password = $data['password'] ?? null;

        $errors = [];
        if (null === $email) {
            $errors['email'] = 'Merci de saisir ta nouvelle adresse email.';
        }
        if (!\is_string($password) || '' === $password) {
            $errors['password'] = 'Merci de saisir ton mot de passe pour confirmer.';
        }
        if ($errors) {
            return $this->validationError($errors);
        }

        // Mots de passe essayés et emails envoyés : limités par compte
        if (!$emailChangeLimiter->create((string) $user->getId())->consume()->isAccepted()) {
            return $this->error('Trop de demandes. Réessaie dans une heure.', Response::HTTP_TOO_MANY_REQUESTS);
        }

        if (!$passwordHasher->isPasswordValid($user, $password)) {
            return $this->validationError(['password' => 'Mot de passe incorrect.']);
        }

        $violations = $validator->validate($email, [
            new Assert\NotBlank(message: 'Merci de saisir ta nouvelle adresse email.'),
            new Assert\Email(message: 'Cette adresse email n\'est pas valide.'),
            new Assert\Length(max: 180, maxMessage: 'L\'adresse email doit faire au plus {{ limit }} caractères.'),
        ]);
        if (\count($violations) > 0) {
            return $this->validationError(['email' => (string) $violations[0]->getMessage()]);
        }
        if (0 === strcasecmp($email, (string) $user->getEmail())) {
            return $this->validationError(['email' => 'C\'est déjà ton adresse email.']);
        }
        if (null !== $users->findOneBy(['email' => $email])) {
            return $this->validationError(['email' => 'Un compte existe déjà avec cet email.']);
        }

        $this->requests->deleteForUser($user);
        [$changeRequest, $token] = EmailChangeRequest::create($user, $email);
        $this->entityManager->persist($changeRequest);
        $this->entityManager->flush();

        try {
            $this->mailer->send($this->confirmationEmail($user, $email, $token));
        } catch (TransportExceptionInterface $exception) {
            $this->logger->error('Email de confirmation non envoyé : {error}', ['error' => $exception->getMessage()]);
            $this->requests->deleteForUser($user);

            return $this->error('L\'email de confirmation n\'a pas pu être envoyé. Réessaie plus tard.', Response::HTTP_SERVICE_UNAVAILABLE);
        }
        try {
            // L'ancienne adresse est prévenue : si ce n'est pas le joueur, il peut réagir
            $this->mailer->send($this->noticeToOldEmail($user, $email));
        } catch (TransportExceptionInterface $exception) {
            $this->logger->error('Avertissement à l\'ancienne adresse non envoyé : {error}', ['error' => $exception->getMessage()]);
        }

        return $this->json([
            'message' => sprintf('Un lien de confirmation a été envoyé à %s. Ton adresse ne changera qu\'après un clic sur ce lien (valable 24 heures).', $email),
        ], Response::HTTP_ACCEPTED);
    }

    /**
     * Corps JSON : {"token": "..."} (jeton du lien reçu à la nouvelle adresse).
     * Le joueur devra ensuite se reconnecter avec sa nouvelle adresse.
     */
    #[Route('/api/email/confirm', name: 'api_email_confirm', methods: ['POST'])]
    public function confirm(Request $request): JsonResponse
    {
        $data = $this->decodeJsonBody($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }
        $token = $data['token'] ?? null;
        $changeRequest = \is_string($token) && preg_match('/^[0-9a-f]{64}$/', $token) ? $this->requests->findOneByToken($token) : null;
        if (null === $changeRequest || $changeRequest->isExpired()) {
            return $this->error('Ce lien n\'est plus valable (il a expiré ou a déjà servi). Refais la demande depuis Mon profil.', Response::HTTP_GONE);
        }

        $user = $changeRequest->getUser();
        $newEmail = $changeRequest->getNewEmail();
        $this->requests->deleteForUser($user);
        $user->setEmail($newEmail);

        try {
            $this->entityManager->flush();
        } catch (UniqueConstraintViolationException) {
            // Un autre compte a pris cette adresse entre la demande et la confirmation
            return $this->error('Cette adresse est déjà utilisée par un autre compte.', Response::HTTP_CONFLICT);
        }

        return $this->json(['message' => 'Ton adresse email a été changée.', 'email' => $newEmail]);
    }

    private function confirmationEmail(User $user, string $newEmail, string $token): Email
    {
        $pseudo = $user->getPseudo() ?? '';
        $link = rtrim($this->frontendUrl, '/').'/#/confirmer-email?token='.$token;

        return (new Email())
            ->from(Address::create($this->mailerFrom))
            ->to($newEmail)
            ->subject('CatFun : confirme ta nouvelle adresse email')
            ->text(<<<TEXT
                Bonjour {$pseudo},

                Tu as demandé à utiliser cette adresse pour ton compte CatFun. Ouvre ce lien pour confirmer :
                {$link}

                Ce lien est valable 24 heures. Si tu n'as rien demandé, ignore cet email : rien ne changera.

                Twixy et Aïna 🐾
                TEXT)
            ->html(sprintf(
                '<p>Bonjour %s,</p><p>Tu as demandé à utiliser cette adresse pour ton compte CatFun.</p>'
                .'<p><a href="%s" style="display:inline-block;padding:10px 18px;background:#5e35b1;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:bold">Confirmer ma nouvelle adresse</a></p>'
                .'<p>Ce lien est valable 24 heures. Si tu n\'as rien demandé, ignore cet email : rien ne changera.</p><p>Twixy et Aïna 🐾</p>',
                htmlspecialchars($pseudo, \ENT_QUOTES),
                htmlspecialchars($link, \ENT_QUOTES),
            ));
    }

    private function noticeToOldEmail(User $user, string $newEmail): Email
    {
        $pseudo = $user->getPseudo() ?? '';

        return (new Email())
            ->from(Address::create($this->mailerFrom))
            ->to((string) $user->getEmail())
            ->subject('CatFun : demande de changement d\'adresse email')
            ->text(<<<TEXT
                Bonjour {$pseudo},

                Une demande a été faite pour remplacer l'adresse email de ton compte CatFun par {$newEmail}.
                Le changement n'aura lieu que si quelqu'un clique sur le lien envoyé à cette nouvelle adresse.

                Si c'est toi, tout va bien. Sinon, quelqu'un connaît peut-être ton mot de passe :
                change-le vite (lien « Mot de passe oublié ? » sur la page de connexion).

                Twixy et Aïna 🐾
                TEXT);
    }
}
