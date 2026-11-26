<?php

namespace App\EventListener;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\Security\Http\Event\LoginSuccessEvent;

/**
 * Retient la date de chaque connexion par email et mot de passe (POST /api/login).
 * Sert à supprimer les comptes inactifs depuis longtemps (voir app:data:purge).
 */
#[AsEventListener]
final class RecordLoginListener
{
    public function __construct(private readonly EntityManagerInterface $entityManager)
    {
    }

    public function __invoke(LoginSuccessEvent $event): void
    {
        // Seulement la vraie connexion, pas chaque appel à l'API avec un jeton
        if ('login' !== $event->getFirewallName()) {
            return;
        }
        $user = $event->getUser();
        if ($user instanceof User) {
            $user->recordLogin();
            $this->entityManager->flush();
        }
    }
}
