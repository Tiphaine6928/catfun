<?php

namespace App\Entity;

use App\Repository\EmailChangeRequestRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Demande de changement d'email, en attente de confirmation.
 *
 * Le lien envoyé à la NOUVELLE adresse contient un jeton aléatoire ; seule son empreinte (SHA-256)
 * est gardée en base. L'email du compte ne change qu'au clic sur ce lien : on est sûr que la
 * nouvelle adresse existe et appartient bien au joueur.
 */
#[ORM\Entity(repositoryClass: EmailChangeRequestRepository::class)]
class EmailChangeRequest
{
    public const LIFETIME = '24 hours';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(length: 180)]
    private string $newEmail;

    #[ORM\Column(length: 64, unique: true)]
    private string $tokenHash;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $expiresAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $createdAt;

    /**
     * Crée la demande et renvoie le jeton en clair, à mettre dans le lien de l'email.
     *
     * @return array{0: self, 1: string}
     */
    public static function create(User $user, string $newEmail): array
    {
        $token = bin2hex(random_bytes(32));
        $request = new self();
        $request->user = $user;
        $request->newEmail = $newEmail;
        $request->tokenHash = self::hash($token);
        $request->createdAt = new \DateTimeImmutable();
        $request->expiresAt = $request->createdAt->modify('+'.self::LIFETIME);

        return [$request, $token];
    }

    public static function hash(string $token): string
    {
        return hash('sha256', $token);
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getUser(): User
    {
        return $this->user;
    }

    public function getNewEmail(): string
    {
        return $this->newEmail;
    }

    public function isExpired(\DateTimeImmutable $now = new \DateTimeImmutable()): bool
    {
        return $this->expiresAt <= $now;
    }
}
