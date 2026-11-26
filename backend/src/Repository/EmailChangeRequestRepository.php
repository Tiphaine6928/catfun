<?php

namespace App\Repository;

use App\Entity\EmailChangeRequest;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<EmailChangeRequest>
 */
class EmailChangeRequestRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, EmailChangeRequest::class);
    }

    public function findOneByToken(string $token): ?EmailChangeRequest
    {
        return $this->findOneBy(['tokenHash' => EmailChangeRequest::hash($token)]);
    }

    /** Une seule demande en attente par compte : une nouvelle annule les précédentes. */
    public function deleteForUser(User $user): void
    {
        $this->createQueryBuilder('r')
            ->delete()
            ->andWhere('r.user = :user')
            ->setParameter('user', $user)
            ->getQuery()
            ->execute();
    }

    /** @return int nombre de demandes expirées supprimées */
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
