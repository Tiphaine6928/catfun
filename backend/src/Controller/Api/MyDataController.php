<?php

namespace App\Controller\Api;

use App\Entity\GameSession;
use App\Entity\Score;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

/**
 * Droits RGPD de l'utilisateur connecté sur ses données :
 * - accès et portabilité : GET /api/me/export (fichier JSON)
 * - effacement : DELETE /api/me (avec le mot de passe)
 */
class MyDataController extends AbstractController
{
    use JsonApiTrait;

    public function __construct(private readonly EntityManagerInterface $entityManager)
    {
    }

    /**
     * Toutes les données liées au compte, dans un fichier JSON à télécharger.
     * Le mot de passe n'y figure pas (il n'est gardé que sous forme chiffrée, irréversible).
     */
    #[Route('/api/me/export', name: 'api_me_export', methods: ['GET'])]
    public function export(#[CurrentUser] User $user): JsonResponse
    {
        $scores = $this->entityManager->getRepository(Score::class)->findBy(['player' => $user], ['date' => 'ASC', 'id' => 'ASC']);
        $sessions = $this->entityManager->getRepository(GameSession::class)->findBy(['player' => $user], ['createdAt' => 'ASC']);

        $data = [
            'date_export' => (new \DateTimeImmutable())->format(\DATE_ATOM),
            'compte' => [
                'email' => $user->getEmail(),
                'pseudo' => $user->getPseudo(),
            ],
            'scores' => array_map(static fn (Score $score) => [
                'jeu' => $score->getGame()?->getName(),
                'niveau' => $score->getLevel(),
                'points' => $score->getPoints(),
                'date' => $score->getDate()->format(\DATE_ATOM),
            ], $scores),
            'parties' => array_map(static fn (GameSession $session) => [
                'jeu' => $session->getGame()->getName(),
                'niveau' => $session->getLevel(),
                'statut' => ['playing' => 'en cours', 'won' => 'gagnée', 'lost' => 'perdue'][$session->getStatus()] ?? $session->getStatus(),
                'commencee_le' => $session->getCreatedAt()->format(\DATE_ATOM),
                'terminee_le' => $session->getFinishedAt()?->format(\DATE_ATOM),
                'points' => $session->getScore()?->getPoints(),
            ], $sessions),
        ];

        $response = new JsonResponse($data);
        $response->setEncodingOptions(\JSON_PRETTY_PRINT | \JSON_UNESCAPED_UNICODE | \JSON_UNESCAPED_SLASHES);
        $response->headers->set('Content-Disposition', 'attachment; filename="catfun-mes-donnees.json"');
        $response->headers->set('Cache-Control', 'no-store');

        return $response;
    }

    /**
     * Supprime définitivement le compte et tout ce qui y est lié (scores, parties, liens de mot de passe).
     * Corps JSON : {"password": "..."} — le mot de passe confirme que c'est bien le propriétaire.
     */
    #[Route('/api/me', name: 'api_me_delete', methods: ['DELETE'])]
    public function delete(
        Request $request,
        #[CurrentUser] User $user,
        UserPasswordHasherInterface $passwordHasher,
        RateLimiterFactory $accountDeletionLimiter,
    ): Response {
        $data = $this->decodeJsonBody($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }
        $password = $data['password'] ?? null;
        if (!\is_string($password) || '' === $password) {
            return $this->validationError(['password' => 'Merci de saisir ton mot de passe pour confirmer.']);
        }

        // Quelqu'un qui aurait récupéré le jeton ne peut pas deviner le mot de passe à l'infini
        $limit = $accountDeletionLimiter->create((string) $user->getId())->consume();
        if (!$limit->isAccepted()) {
            return $this->error('Trop de tentatives. Réessaie dans quelques minutes.', Response::HTTP_TOO_MANY_REQUESTS);
        }

        if (!$passwordHasher->isPasswordValid($user, $password)) {
            return $this->validationError(['password' => 'Mot de passe incorrect.']);
        }

        // Les scores, parties et liens de mot de passe sont supprimés avec le compte (ON DELETE CASCADE)
        $this->entityManager->remove($user);
        $this->entityManager->flush();

        return new Response(null, Response::HTTP_NO_CONTENT);
    }
}
