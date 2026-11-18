<?php

namespace App\Controller\Api;

use App\Entity\User;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Validator\Validator\ValidatorInterface;

class UserController extends AbstractController
{
    use JsonApiTrait;

    /** Champs modifiables via PATCH /api/me */
    private const EDITABLE_FIELDS = ['pseudo'];

    #[Route('/api/me', name: 'api_me', methods: ['GET'])]
    public function me(#[CurrentUser] User $user): JsonResponse
    {
        return $this->json($this->serializeUser($user));
    }

    /**
     * Modifie le profil de l'utilisateur connecté.
     * Corps JSON : {"pseudo": "NouveauPseudo"}
     */
    #[Route('/api/me', name: 'api_me_update', methods: ['PATCH'])]
    public function update(
        Request $request,
        #[CurrentUser] User $user,
        EntityManagerInterface $entityManager,
        ValidatorInterface $validator,
    ): JsonResponse {
        $data = $this->decodeJsonBody($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        $errors = [];
        foreach (array_diff(array_keys($data), self::EDITABLE_FIELDS) as $field) {
            $errors[(string) $field] = 'Ce champ ne peut pas être modifié.';
        }
        if (!\array_key_exists('pseudo', $data)) {
            $errors['pseudo'] = 'Ce champ est obligatoire.';
        } elseif (!\is_string($data['pseudo'])) {
            $errors['pseudo'] = 'Ce champ doit être une chaîne de caractères.';
        }
        if ($errors) {
            return $this->validationError($errors);
        }

        $user->setPseudo($data['pseudo']);

        $violations = $validator->validate($user);
        if (\count($violations) > 0) {
            // Rien n'est enregistré : on annule la modification en mémoire
            $entityManager->refresh($user);

            return $this->violationsError($violations);
        }

        try {
            $entityManager->flush();
        } catch (UniqueConstraintViolationException) {
            // Deux requêtes simultanées pour le même pseudo : la base tranche
            return $this->validationError(['pseudo' => 'Ce pseudo est déjà pris.']);
        }

        return $this->json($this->serializeUser($user));
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeUser(User $user): array
    {
        return [
            'message' => 'Tu es connecté 🔥',
            'user' => $user->getUserIdentifier(),
            'pseudo' => $user->getPseudo(),
        ];
    }
}
