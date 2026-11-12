<?php

namespace App\Repository;

use App\Entity\Game;
use App\Entity\Score;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Score>
 */
class ScoreRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Score::class);
    }

    /**
     * Meilleurs scores d'un jeu (leaderboard), du plus haut au plus bas.
     * À égalité de points, le score obtenu en premier passe devant.
     *
     * @return Score[]
     */
    public function findTopScoresForGame(Game $game, int $limit = 10): array
    {
        return $this->createQueryBuilder('s')
            ->addSelect('p')
            ->join('s.player', 'p')
            ->andWhere('s.game = :game')
            ->setParameter('game', $game)
            ->orderBy('s.points', 'DESC')
            ->addOrderBy('s.date', 'ASC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    /**
     * Historique des scores d'un joueur, du plus récent au plus ancien.
     *
     * @return Score[]
     */
    public function findByPlayer(User $player, ?Game $game = null): array
    {
        $qb = $this->createQueryBuilder('s')
            ->andWhere('s.player = :player')
            ->setParameter('player', $player)
            ->orderBy('s.date', 'DESC');

        if (null !== $game) {
            $qb->andWhere('s.game = :game')->setParameter('game', $game);
        }

        return $qb->getQuery()->getResult();
    }

    /**
     * Meilleur score d'un joueur sur un jeu (null s'il n'y a jamais joué).
     */
    public function findBestPointsForPlayer(User $player, Game $game): ?int
    {
        $best = $this->createQueryBuilder('s')
            ->select('MAX(s.points)')
            ->andWhere('s.player = :player')
            ->andWhere('s.game = :game')
            ->setParameter('player', $player)
            ->setParameter('game', $game)
            ->getQuery()
            ->getSingleScalarResult();

        return null === $best ? null : (int) $best;
    }
}
