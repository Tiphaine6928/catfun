<?php

namespace App\Controller\Api;

use App\Entity\Game;
use App\Entity\Score;
use App\Entity\User;
use App\Repository\GameRepository;
use App\Repository\GameSessionRepository;
use App\Repository\ScoreRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

#[Route('/api', name: 'api_')]
class ScoreController extends AbstractController
{
    use JsonApiTrait;

    private const DEFAULT_LIMIT = 10;
    private const MAX_LIMIT = 100;

    public function __construct(
        private readonly GameRepository $gameRepository,
        private readonly ScoreRepository $scoreRepository,
        private readonly GameSessionRepository $sessionRepository,
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
            'levels' => $game->getLevels(),
        ], $games));
    }

    /**
     * Classement d'un jeu : le meilleur score de chaque joueur, du plus haut au plus bas. Public.
     * Paramètres optionnels : ?limit=10 (entre 1 et 100),
     * ?level=facile pour un jeu à niveaux (sans ce paramètre, tous les niveaux sont mélangés).
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

        $level = $this->levelFromQuery($request, $game);
        if ($level instanceof JsonResponse) {
            return $level;
        }

        // Rang partagé en cas d'égalité de points : 1, 2, 2, 4…
        $scores = [];
        $rank = 0;
        $previousPoints = null;
        foreach ($this->scoreRepository->findLeaderboardForGame($game, $limit, $level) as $position => $row) {
            if ($row['points'] !== $previousPoints) {
                $rank = $position + 1;
                $previousPoints = $row['points'];
            }
            // Le classement est public : on affiche le pseudo, jamais l'email.
            $scores[] = [
                'rank' => $rank,
                'id' => $row['id'],
                'points' => $row['points'],
                'date' => $row['date']->format(\DateTimeInterface::ATOM),
                'player' => $row['pseudo'],
            ];
        }

        return $this->json([
            'game' => ['id' => $game->getId(), 'name' => $game->getName(), 'levels' => $game->getLevels()],
            'level' => $level,
            'totalPlayers' => $this->scoreRepository->countPlayersForGame($game, $level),
            'scores' => $scores,
        ]);
    }

    /**
     * Historique des scores de l'utilisateur connecté, du plus récent au plus ancien.
     * Paramètres optionnels : ?game=1 pour filtrer sur un jeu, ?limit=10 (entre 1 et 100).
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

        $limit = null;
        if ($request->query->has('limit')) {
            $limit = $request->query->getInt('limit');
            if ($limit < 1 || $limit > self::MAX_LIMIT) {
                return $this->error(sprintf('Le paramètre "limit" doit être compris entre 1 et %d.', self::MAX_LIMIT), Response::HTTP_BAD_REQUEST);
            }
        }

        return $this->json(array_map(
            fn (Score $score) => $this->serializeScore($score, withGame: true),
            $this->scoreRepository->findByPlayer($user, $game, $limit),
        ));
    }

    /**
     * Statistiques de l'utilisateur connecté, pour sa page de profil :
     * pour chaque jeu, son meilleur score (par niveau pour un jeu à niveaux),
     * et le nombre de parties terminées et gagnées.
     */
    #[Route('/me/stats', name: 'me_stats', methods: ['GET'])]
    public function myStats(#[CurrentUser] User $user): JsonResponse
    {
        $counts = $this->sessionRepository->countFinishedByGame($user);

        $games = [];
        foreach ($this->gameRepository->findBy([], ['name' => 'ASC']) as $game) {
            $records = [];
            foreach ($game->hasLevels() ? $game->getLevels() : [null] as $level) {
                $records[] = ['level' => $level, 'best' => $this->scoreRepository->findBestPointsForPlayer($user, $game, $level)];
            }

            $games[] = [
                'game' => ['id' => $game->getId(), 'name' => $game->getName(), 'levels' => $game->getLevels()],
                'records' => $records,
                'played' => $counts[$game->getId()]['played'] ?? 0,
                'won' => $counts[$game->getId()]['won'] ?? 0,
            ];
        }

        return $this->json(['games' => $games]);
    }

    /**
     * Meilleur score de l'utilisateur connecté sur un jeu ("best" vaut null s'il n'y a jamais joué).
     * Paramètre optionnel : ?level=facile pour un jeu à niveaux (sans, tous niveaux confondus).
     */
    #[Route('/me/games/{id<\d+>}/best', name: 'me_best_score', methods: ['GET'])]
    public function myBestScore(int $id, Request $request, #[CurrentUser] User $user): JsonResponse
    {
        $game = $this->gameRepository->find($id);
        if (null === $game) {
            return $this->gameNotFound();
        }

        $level = $this->levelFromQuery($request, $game);
        if ($level instanceof JsonResponse) {
            return $level;
        }

        return $this->json([
            'game' => ['id' => $game->getId(), 'name' => $game->getName()],
            'level' => $level,
            'best' => $this->scoreRepository->findBestPointsForPlayer($user, $game, $level),
        ]);
    }

    /**
     * Niveau demandé dans l'URL (?level=…) : null s'il est absent,
     * ou une réponse 400 s'il n'existe pas pour ce jeu.
     */
    private function levelFromQuery(Request $request, Game $game): string|JsonResponse|null
    {
        if (!$request->query->has('level')) {
            return null;
        }

        $level = $request->query->getString('level');
        if (!$game->hasLevels()) {
            return $this->error('Ce jeu n\'a pas de niveaux.', Response::HTTP_BAD_REQUEST);
        }
        if (!$game->hasLevel($level)) {
            return $this->error($this->unknownLevelMessage($game), Response::HTTP_BAD_REQUEST);
        }

        return $level;
    }

    private function unknownLevelMessage(Game $game): string
    {
        return sprintf('Choisis un niveau parmi : %s.', implode(', ', $game->getLevels()));
    }

    private function gameNotFound(): JsonResponse
    {
        return $this->error('Ce jeu n\'existe pas.', Response::HTTP_NOT_FOUND);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeScore(Score $score, bool $withGame = false): array
    {
        $data = [
            'id' => $score->getId(),
            'points' => $score->getPoints(),
            'level' => $score->getLevel(),
            'date' => $score->getDate()->format(\DateTimeInterface::ATOM),
        ];

        if ($withGame) {
            $game = $score->getGame();
            $data['game'] = ['id' => $game?->getId(), 'name' => $game?->getName()];
        }

        return $data;
    }
}
