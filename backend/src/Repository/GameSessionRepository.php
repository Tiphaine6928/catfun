<?php

namespace App\Repository;

use App\Entity\Game;
use App\Entity\GameSession;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<GameSession>
 */
class GameSessionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, GameSession::class);
    }

    /** Dernière partie du joueur sur ce jeu (pour ne pas retomber sur le même mot). */
    public function findLastForPlayer(User $player, Game $game): ?GameSession
    {
        return $this->createQueryBuilder('s')
            ->andWhere('s.player = :player')
            ->andWhere('s.game = :game')
            ->setParameter('player', $player)
            ->setParameter('game', $game)
            ->orderBy('s.createdAt', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * Partie du joueur, verrouillée jusqu'à la fin de la transaction :
     * deux coups envoyés en même temps sont joués l'un après l'autre.
     * Renvoie null si la partie n'existe pas ou appartient à quelqu'un d'autre.
     */
    public function findForPlayerAndLock(string $id, User $player): ?GameSession
    {
        $session = $this->find($id, LockMode::PESSIMISTIC_WRITE);

        return null !== $session && $session->getPlayer()->getId() === $player->getId() ? $session : null;
    }
}
