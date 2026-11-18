<?php

namespace App\Controller\Api;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Validator\ConstraintViolationListInterface;

/**
 * Helpers communs aux contrôleurs de l'API : lecture du corps JSON
 * et réponses d'erreur au même format partout.
 */
trait JsonApiTrait
{
    /**
     * Décode le corps JSON de la requête.
     * Renvoie le tableau décodé, ou une réponse 400 si le corps n'est pas un objet JSON.
     *
     * @return array<string, mixed>|JsonResponse
     */
    private function decodeJsonBody(Request $request): array|JsonResponse
    {
        try {
            $data = json_decode($request->getContent(), true, 512, \JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return $this->error('Le corps de la requête doit être du JSON valide.', Response::HTTP_BAD_REQUEST);
        }

        if (!\is_array($data) || array_is_list($data) && [] !== $data) {
            return $this->error('Le corps de la requête doit être un objet JSON.', Response::HTTP_BAD_REQUEST);
        }

        return $data;
    }

    /**
     * @param array<string, string> $errors
     */
    private function validationError(array $errors): JsonResponse
    {
        return $this->json(['message' => 'Données invalides.', 'errors' => $errors], Response::HTTP_UNPROCESSABLE_ENTITY);
    }

    private function violationsError(ConstraintViolationListInterface $violations): JsonResponse
    {
        $errors = [];
        foreach ($violations as $violation) {
            // On garde le premier message par champ
            $errors[$violation->getPropertyPath()] ??= (string) $violation->getMessage();
        }

        return $this->validationError($errors);
    }

    private function error(string $message, int $status): JsonResponse
    {
        return $this->json(['message' => $message], $status);
    }
}
