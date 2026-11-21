<?php

namespace App\Repository;

use App\Entity\Game;
use App\Entity\Score;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\ParameterType;
use Doctrine\ORM\QueryBuilder;
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
     * Classement d'un jeu : une ligne par joueur, avec son meilleur score.
     * Ordre : points décroissants, puis le score obtenu en premier.
     * Si un joueur a plusieurs fois son record, c'est le plus ancien qui compte.
     * Avec $level, seuls les scores de ce niveau sont comptés ; sans, tous les niveaux sont mélangés.
     *
     * @return list<array{id: int, points: int, date: \DateTimeImmutable, pseudo: string}>
     */
    public function findLeaderboardForGame(Game $game, int $limit = 10, ?string $level = null): array
    {
        $sql = <<<'SQL'
            SELECT id, points, date, pseudo
            FROM (
                SELECT s.id, s.points, s.date, u.pseudo,
                       ROW_NUMBER() OVER (PARTITION BY s.player_id ORDER BY s.points DESC, s.date ASC, s.id ASC) AS position
                FROM score s
                INNER JOIN user u ON u.id = s.player_id
                WHERE s.game_id = :game %s
            ) best
            WHERE position = 1
            ORDER BY points DESC, date ASC, id ASC
            LIMIT :limit
            SQL;

        $params = ['game' => $game->getId(), 'limit' => $limit];
        $types = ['game' => ParameterType::INTEGER, 'limit' => ParameterType::INTEGER];
        if (null !== $level) {
            $params['level'] = $level;
            $types['level'] = ParameterType::STRING;
        }

        $rows = $this->getEntityManager()->getConnection()->fetchAllAssociative(
            sprintf($sql, null !== $level ? 'AND s.level = :level' : ''),
            $params,
            $types,
        );

        return array_map(static fn (array $row) => [
            'id' => (int) $row['id'],
            'points' => (int) $row['points'],
            'date' => new \DateTimeImmutable($row['date']),
            'pseudo' => (string) $row['pseudo'],
        ], $rows);
    }

    /**
     * Nombre de joueurs ayant au moins un score sur ce jeu (à ce niveau si $level est donné).
     */
    public function countPlayersForGame(Game $game, ?string $level = null): int
    {
        $qb = $this->createQueryBuilder('s')
            ->select('COUNT(DISTINCT IDENTITY(s.player))')
            ->andWhere('s.game = :game')
            ->setParameter('game', $game);
        $this->filterByLevel($qb, $level);

        return (int) $qb->getQuery()->getSingleScalarResult();
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
     * Meilleur score d'un joueur sur un jeu, à un niveau donné ou tous niveaux confondus
     * (null s'il n'y a jamais joué).
     */
    public function findBestPointsForPlayer(User $player, Game $game, ?string $level = null): ?int
    {
        $qb = $this->createQueryBuilder('s')
            ->select('MAX(s.points)')
            ->andWhere('s.player = :player')
            ->andWhere('s.game = :game')
            ->setParameter('player', $player)
            ->setParameter('game', $game);
        $this->filterByLevel($qb, $level);

        $best = $qb->getQuery()->getSingleScalarResult();

        return null === $best ? null : (int) $best;
    }

    private function filterByLevel(QueryBuilder $qb, ?string $level): void
    {
        if (null !== $level) {
            $qb->andWhere('s.level = :level')->setParameter('level', $level);
        }
    }
}
