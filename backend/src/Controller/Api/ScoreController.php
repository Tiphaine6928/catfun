<?php

namespace App\Controller\Api;

use App\Entity\Game;
use App\Entity\Score;
use App\Entity\User;
use App\Repository\GameRepository;
use App\Repository\ScoreRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Validator\Validator\ValidatorInterface;

#[Route('/api', name: 'api_')]
class ScoreController extends AbstractController
{
    private const DEFAULT_LIMIT = 10;
    private const MAX_LIMIT = 100;

    public function __construct(
        private readonly GameRepository $gameRepository,
        private readonly ScoreRepository $scoreRepository,
    ) {
    }

    /**
     * Liste des jeux (pour connaître leurs identifiants). Public.
     */
    #[Route('/games', name: 'games_list', methods: ['GET'])]
    public function listGames(): JsonResponse
    {
        $games = $this->gameRepository->findBy([], ['name' => 'ASC']);

        return $this->json(array_map(static fn (Game $game) => [
            'id' => $game->getId(),
            'name' => $game->getName(),
            'description' => $game->getDescription(),
        ], $games));
    }

    /**
     * Classement d'un jeu, du meilleur score au moins bon. Public.
     * Paramètre optionnel : ?limit=10 (entre 1 et 100).
     */
    #[Route('/games/{id<\d+>}/leaderboard', name: 'games_leaderboard', methods: ['GET'])]
    public function leaderboard(int $id, Request $request): JsonResponse
    {
        $game = $this->gameRepository->find($id);
        if (null === $game) {
            return $this->gameNotFound();
        }

        $limit = $request->query->getInt('limit', self::DEFAULT_LIMIT);
        if ($limit < 1 || $limit > self::MAX_LIMIT) {
            return $this->error(sprintf('Le paramètre "limit" doit être compris entre 1 et %d.', self::MAX_LIMIT), Response::HTTP_BAD_REQUEST);
        }

        $rank = 0;

        return $this->json([
            'game' => ['id' => $game->getId(), 'name' => $game->getName()],
            'scores' => array_map(function (Score $score) use (&$rank) {
                return ['rank' => ++$rank] + $this->serializeScore($score, withPlayer: true);
            }, $this->scoreRepository->findTopScoresForGame($game, $limit)),
        ]);
    }

    /**
     * Enregistre un score pour l'utilisateur connecté.
     * Corps JSON : {"gameId": 1, "points": 120}
     */
    #[Route('/scores', name: 'scores_create', methods: ['POST'])]
    public function create(
        Request $request,
        #[CurrentUser] User $user,
        EntityManagerInterface $entityManager,
        ValidatorInterface $validator,
    ): JsonResponse {
        try {
            $data = json_decode($request->getContent(), true, 512, \JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return $this->error('Le corps de la requête doit être du JSON valide.', Response::HTTP_BAD_REQUEST);
        }

        if (!\is_array($data)) {
            return $this->error('Le corps de la requête doit être un objet JSON.', Response::HTTP_BAD_REQUEST);
        }

        $errors = [];
        if (!isset($data['gameId']) || !\is_int($data['gameId'])) {
            $errors['gameId'] = 'Ce champ est obligatoire et doit être un entier.';
        }
        if (!\array_key_exists('points', $data) || !\is_int($data['points'])) {
            $errors['points'] = 'Ce champ est obligatoire et doit être un entier.';
        }
        if ($errors) {
            return $this->validationError($errors);
        }

        $game = $this->gameRepository->find($data['gameId']);
        if (null === $game) {
            return $this->validationError(['gameId' => 'Ce jeu n\'existe pas.']);
        }

        $score = (new Score())
            ->setPoints($data['points'])
            ->setGame($game)
            ->setPlayer($user);

        $violations = $validator->validate($score);
        if (\count($violations) > 0) {
            $errors = [];
            foreach ($violations as $violation) {
                $errors[$violation->getPropertyPath()] = $violation->getMessage();
            }

            return $this->validationError($errors);
        }

        $entityManager->persist($score);
        $entityManager->flush();

        return $this->json($this->serializeScore($score, withGame: true), Response::HTTP_CREATED);
    }

    /**
     * Historique des scores de l'utilisateur connecté, du plus récent au plus ancien.
     * Paramètre optionnel : ?game=1 pour filtrer sur un jeu.
     */
    #[Route('/me/scores', name: 'me_scores', methods: ['GET'])]
    public function myScores(Request $request, #[CurrentUser] User $user): JsonResponse
    {
        $game = null;
        if ($request->query->has('game')) {
            $gameId = $request->query->getInt('game');
            $game = $gameId > 0 ? $this->gameRepository->find($gameId) : null;
            if (null === $game) {
                return $this->gameNotFound();
            }
        }

        return $this->json(array_map(
            fn (Score $score) => $this->serializeScore($score, withGame: true),
            $this->scoreRepository->findByPlayer($user, $game),
        ));
    }

    /**
     * Meilleur score de l'utilisateur connecté sur un jeu ("best" vaut null s'il n'y a jamais joué).
     */
    #[Route('/me/games/{id<\d+>}/best', name: 'me_best_score', methods: ['GET'])]
    public function myBestScore(int $id, #[CurrentUser] User $user): JsonResponse
    {
        $game = $this->gameRepository->find($id);
        if (null === $game) {
            return $this->gameNotFound();
        }

        return $this->json([
            'game' => ['id' => $game->getId(), 'name' => $game->getName()],
            'best' => $this->scoreRepository->findBestPointsForPlayer($user, $game),
        ]);
    }

    private function gameNotFound(): JsonResponse
    {
        return $this->error('Ce jeu n\'existe pas.', Response::HTTP_NOT_FOUND);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeScore(Score $score, bool $withPlayer = false, bool $withGame = false): array
    {
        $data = [
            'id' => $score->getId(),
            'points' => $score->getPoints(),
            'date' => $score->getDate()->format(\DateTimeInterface::ATOM),
        ];

        if ($withPlayer) {
            // Le classement est public : on affiche le pseudo, jamais l'email.
            $data['player'] = $score->getPlayer()?->getPseudo();
        }

        if ($withGame) {
            $game = $score->getGame();
            $data['game'] = ['id' => $game?->getId(), 'name' => $game?->getName()];
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

    private function error(string $message, int $status): JsonResponse
    {
        return $this->json(['message' => $message], $status);
    }
}
