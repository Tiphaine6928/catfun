<?php

namespace App\Repository;

use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Security\Core\Exception\UnsupportedUserException;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\PasswordUpgraderInterface;

/**
 * @extends ServiceEntityRepository<User>
 */
class UserRepository extends ServiceEntityRepository implements PasswordUpgraderInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, User::class);
    }

    /**
     * Used to upgrade (rehash) the user's password automatically over time.
     */
    public function upgradePassword(PasswordAuthenticatedUserInterface $user, string $newHashedPassword): void
    {
        if (!$user instanceof User) {
            throw new UnsupportedUserException(sprintf('Instances of "%s" are not supported.', $user::class));
        }

        $user->setPassword($newHashedPassword);
        $this->getEntityManager()->persist($user);
        $this->getEntityManager()->flush();
    }

    /**
     * Comptes sans connexion depuis cette date, pas encore prévenus de leur suppression.
     *
     * @return list<User>
     */
    public function findInactiveNotYetNotified(\DateTimeImmutable $lastLoginBefore): array
    {
        return $this->createQueryBuilder('u')
            ->andWhere('u.lastLoginAt < :before')
            ->andWhere('u.inactivityNoticeSentAt IS NULL')
            ->setParameter('before', $lastLoginBefore)
            ->orderBy('u.id', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Supprime les comptes prévenus avant cette date et pas reconnectés depuis
     * (une connexion efface l'avertissement). Scores, parties et liens partent avec (ON DELETE CASCADE).
     *
     * @return int nombre de comptes supprimés
     */
    public function deleteNotifiedBefore(\DateTimeImmutable $notifiedBefore): int
    {
        return $this->createQueryBuilder('u')
            ->delete()
            ->andWhere('u.inactivityNoticeSentAt IS NOT NULL')
            ->andWhere('u.inactivityNoticeSentAt < :before')
            ->setParameter('before', $notifiedBefore)
            ->getQuery()
            ->execute();
    }
}
