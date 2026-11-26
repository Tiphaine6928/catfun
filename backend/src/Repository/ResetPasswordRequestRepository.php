<?php

namespace App\Repository;

use App\Entity\ResetPasswordRequest;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<ResetPasswordRequest>
 */
class ResetPasswordRequestRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ResetPasswordRequest::class);
    }

    /** Demande correspondant au jeton du lien (expirée ou non), null si inconnue. */
    public function findOneByToken(string $token): ?ResetPasswordRequest
    {
        return $this->findOneBy(['tokenHash' => ResetPasswordRequest::hash($token)]);
    }

    /** Supprime toutes les demandes de cet utilisateur (une seule demande valable à la fois). */
    public function deleteForUser(User $user): void
    {
        $this->createQueryBuilder('r')
            ->delete()
            ->andWhere('r.user = :user')
            ->setParameter('user', $user)
            ->getQuery()
            ->execute();
    }

    /** Supprime les liens expirés. @return int nombre de liens supprimés */
    public function deleteExpired(\DateTimeImmutable $now = new \DateTimeImmutable()): int
    {
        return $this->createQueryBuilder('r')
            ->delete()
            ->andWhere('r.expiresAt <= :now')
            ->setParameter('now', $now)
            ->getQuery()
            ->execute();
    }
}
