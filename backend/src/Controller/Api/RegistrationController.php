<?php

namespace App\Controller\Api;

use App\Entity\User;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Validator\ValidatorInterface;

class RegistrationController extends AbstractController
{
    use JsonApiTrait;

    private const FIELDS = ['email', 'pseudo', 'password'];

    /**
     * Crée un compte et connecte directement l'utilisateur.
     * Corps JSON : {"email": "...", "pseudo": "...", "password": "..."}
     * Réponse 201 : {"token": "...", "user": "<email>", "pseudo": "..."}
     */
    #[Route('/api/register', name: 'api_register', methods: ['POST'])]
    public function register(
        Request $request,
        UserPasswordHasherInterface $passwordHasher,
        EntityManagerInterface $entityManager,
        ValidatorInterface $validator,
        JWTTokenManagerInterface $jwtManager,
        RateLimiterFactory $registrationLimiter,
    ): JsonResponse {
        // Au plus 10 tentatives par heure depuis une même adresse IP (config/packages/rate_limiter.yaml).
        // Chaque tentative compte, même refusée : sinon un robot pourrait tester en masse
        // quels emails ont déjà un compte.
        $limit = $registrationLimiter->create($request->getClientIp() ?? 'inconnue')->consume();
        if (!$limit->isAccepted()) {
            $wait = max(1, $limit->getRetryAfter()->getTimestamp() - time());
            $minutes = max(1, (int) round($wait / 60)); // 3 601 s → « 60 minutes », pas 61

            return $this->json([
                'message' => sprintf('Trop de tentatives d\'inscription. Réessaie dans %d minute%s.', $minutes, $minutes > 1 ? 's' : ''),
            ], Response::HTTP_TOO_MANY_REQUESTS, ['Retry-After' => (string) $wait]);
        }

        $data = $this->decodeJsonBody($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        $errors = [];
        foreach (array_diff(array_keys($data), self::FIELDS) as $field) {
            $errors[(string) $field] = 'Ce champ n\'est pas accepté.';
        }
        foreach (self::FIELDS as $field) {
            if (!\array_key_exists($field, $data)) {
                $errors[$field] = 'Ce champ est obligatoire.';
            } elseif (!\is_string($data[$field])) {
                $errors[$field] = 'Ce champ doit être une chaîne de caractères.';
            }
        }
        if ($errors) {
            return $this->validationError($errors);
        }

        $user = (new User())
            ->setEmail($data['email'])
            ->setPseudo($data['pseudo']);

        // Mêmes règles que le formulaire d'inscription Symfony
        $passwordViolations = $validator->validate($data['password'], [
            new Assert\NotBlank(message: 'Merci de saisir un mot de passe.'),
            new Assert\Length(
                min: 6,
                max: 4096,
                minMessage: 'Le mot de passe doit faire au moins {{ limit }} caractères.',
            ),
        ]);
        foreach ($passwordViolations as $violation) {
            $errors['password'] ??= (string) $violation->getMessage();
        }
        foreach ($validator->validate($user) as $violation) {
            $errors[$violation->getPropertyPath()] ??= (string) $violation->getMessage();
        }
        if ($errors) {
            return $this->validationError($errors);
        }

        $user->setPassword($passwordHasher->hashPassword($user, $data['password']));

        try {
            $entityManager->persist($user);
            $entityManager->flush();
        } catch (UniqueConstraintViolationException $exception) {
            // Deux inscriptions simultanées avec le même email ou pseudo : la base tranche
            return str_contains($exception->getMessage(), 'UNIQ_USER_PSEUDO')
                ? $this->validationError(['pseudo' => 'Ce pseudo est déjà pris.'])
                : $this->validationError(['email' => 'Un compte existe déjà avec cet email.']);
        }

        return $this->json([
            'token' => $jwtManager->create($user),
            'user' => $user->getUserIdentifier(),
            'pseudo' => $user->getPseudo(),
        ], Response::HTTP_CREATED);
    }
}
