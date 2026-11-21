<?php

namespace App\Controller\Api;

use App\Entity\GameSession;
use App\Entity\Score;
use App\Entity\User;
use App\Game\GameEngine;
use App\Game\GameEngines;
use App\Game\Memoire\MemoireEngine;
use App\Game\Pendu\PenduEngine;
use App\Repository\GameRepository;
use App\Repository\GameSessionRepository;
use App\Repository\ScoreRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

/**
 * Parties jouées côté serveur : c'est la seule façon d'enregistrer un score.
 *
 * Le serveur choisit le mot ou mélange les cartes, applique chaque coup, et calcule le score
 * lui-même à la victoire. Le joueur ne reçoit que ce qu'il a le droit de voir.
 */
#[Route('/api', name: 'api_')]
class GameSessionController extends AbstractController
{
    use JsonApiTrait;

    public function __construct(
        private readonly GameRepository $gameRepository,
        private readonly GameSessionRepository $sessionRepository,
        private readonly ScoreRepository $scoreRepository,
        private readonly GameEngines $engines,
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    /**
     * Commence une partie. Corps JSON facultatif : {"level": "facile"} (obligatoire pour un jeu à niveaux).
     */
    #[Route('/games/{id<\d+>}/sessions', name: 'sessions_start', methods: ['POST'])]
    public function start(int $id, Request $request, #[CurrentUser] User $user): JsonResponse
    {
        $game = $this->gameRepository->find($id);
        $engine = null !== $game ? $this->engines->forGame($game) : null;
        if (null === $game || null === $engine) {
            return $this->error('Ce jeu n\'existe pas.', Response::HTTP_NOT_FOUND);
        }

        $data = '' === trim($request->getContent()) ? [] : $this->decodeJsonBody($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        $level = $data['level'] ?? null;
        if (null !== $level && !\is_string($level)) {
            return $this->validationError(['level' => 'Ce champ doit être une chaîne de caractères.']);
        }
        if ($game->hasLevels() && (null === $level || !$game->hasLevel($level))) {
            return $this->validationError(['level' => sprintf('Choisis un niveau parmi : %s.', implode(', ', $game->getLevels()))]);
        }
        if (!$game->hasLevels() && null !== $level) {
            return $this->validationError(['level' => 'Ce jeu n\'a pas de niveaux.']);
        }

        $previous = $this->sessionRepository->findLastForPlayer($user, $game);
        $state = $engine->start($level, $previous?->getState());
        $session = new GameSession($user, $game, $level, $state);
        $this->entityManager->persist($session);
        $this->entityManager->flush();

        return $this->json($this->serialize($session, $engine), Response::HTTP_CREATED);
    }

    /**
     * État visible d'une partie (pour la reprendre).
     */
    #[Route('/sessions/{id<[0-9a-f]{32}>}', name: 'sessions_show', methods: ['GET'])]
    public function show(string $id, #[CurrentUser] User $user): JsonResponse
    {
        $session = $this->sessionRepository->find($id);
        if (null === $session || $session->getPlayer()->getId() !== $user->getId()) {
            return $this->sessionNotFound();
        }

        return $this->json($this->serialize($session, $this->engineFor($session)));
    }

    /**
     * Pendu : propose une lettre. Corps JSON : {"letter": "e"}
     */
    #[Route('/sessions/{id<[0-9a-f]{32}>}/guess', name: 'sessions_guess', methods: ['POST'])]
    public function guess(string $id, Request $request, #[CurrentUser] User $user): JsonResponse
    {
        $data = $this->decodeJsonBody($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }
        if (!isset($data['letter']) || !\is_string($data['letter'])) {
            return $this->validationError(['letter' => 'Ce champ est obligatoire et doit être une lettre.']);
        }

        return $this->play($id, $user, PenduEngine::class, static fn (PenduEngine $engine, array $state) => $engine->guess($state, $data['letter']));
    }

    /**
     * Mémoire : retourne une carte. Corps JSON : {"index": 3}
     */
    #[Route('/sessions/{id<[0-9a-f]{32}>}/flip', name: 'sessions_flip', methods: ['POST'])]
    public function flip(string $id, Request $request, #[CurrentUser] User $user): JsonResponse
    {
        $data = $this->decodeJsonBody($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }
        if (!isset($data['index']) || !\is_int($data['index'])) {
            return $this->validationError(['index' => 'Ce champ est obligatoire et doit être un entier.']);
        }

        return $this->play($id, $user, MemoireEngine::class, static fn (MemoireEngine $engine, array $state) => $engine->flip($state, $data['index']));
    }

    /**
     * Joue un coup dans une transaction, avec la partie verrouillée :
     * deux coups envoyés en même temps sont appliqués l'un après l'autre, et le score n'est enregistré qu'une fois.
     *
     * @param class-string<GameEngine> $engineClass
     */
    private function play(string $id, User $user, string $engineClass, callable $move): JsonResponse
    {
        return $this->entityManager->wrapInTransaction(function () use ($id, $user, $engineClass, $move): JsonResponse {
            $session = $this->sessionRepository->findForPlayerAndLock($id, $user);
            if (null === $session) {
                return $this->sessionNotFound();
            }

            $engine = $this->engineFor($session);
            if (!$engine instanceof $engineClass) {
                return $this->error('Ce coup n\'existe pas pour ce jeu.', Response::HTTP_BAD_REQUEST);
            }
            if ($session->isFinished()) {
                return $this->error('Cette partie est terminée.', Response::HTTP_CONFLICT);
            }

            [$state, $result] = $move($engine, $session->getState());
            $status = $engine->status($state);
            $session->setState($state, $status);

            if (GameEngine::WON === $status) {
                // Le score est calculé par le serveur, jamais envoyé par le navigateur
                $score = (new Score())
                    ->setPlayer($user)
                    ->setGame($session->getGame())
                    ->setLevel($session->getLevel())
                    ->setPoints($engine->score($state));
                $this->entityManager->persist($score);
                $session->setScore($score);
            }
            $this->entityManager->flush();

            return $this->json(['result' => $result] + $this->serialize($session, $engine));
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(GameSession $session, GameEngine $engine): array
    {
        $game = $session->getGame();
        $data = [
            'id' => $session->getId(),
            'game' => ['id' => $game->getId(), 'name' => $game->getName()],
            'level' => $session->getLevel(),
            'status' => $session->getStatus(),
            'state' => $engine->publicState($session->getState()),
            'score' => null,
        ];

        $score = $session->getScore();
        if (null !== $score) {
            $best = $this->scoreRepository->findBestPointsForPlayer($session->getPlayer(), $game, $session->getLevel());
            $data['score'] = [
                'points' => $score->getPoints(),
                'best' => $best,
                'isRecord' => null !== $best && $score->getPoints() >= $best,
            ];
        }

        return $data;
    }

    private function engineFor(GameSession $session): GameEngine
    {
        return $this->engines->forGame($session->getGame()) ?? throw new \LogicException('Jeu sans règles : '.$session->getGame()->getName());
    }

    private function sessionNotFound(): JsonResponse
    {
        return $this->error('Cette partie n\'existe pas.', Response::HTTP_NOT_FOUND);
    }
}
