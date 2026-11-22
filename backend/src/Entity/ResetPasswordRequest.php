<?php

namespace App\Entity;

use App\Repository\ResetPasswordRequestRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Demande de nouveau mot de passe (« Mot de passe oublié »).
 *
 * Le lien envoyé par email contient un jeton aléatoire ; seule son empreinte (SHA-256) est
 * gardée en base : quelqu'un qui lirait la base ne pourrait pas s'en servir.
 * Le jeton n'est valable que pendant LIFETIME, et une seule fois.
 */
#[ORM\Entity(repositoryClass: ResetPasswordRequestRepository::class)]
class ResetPasswordRequest
{
    public const LIFETIME = '1 hour';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(length: 64, unique: true)]
    private string $tokenHash;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $expiresAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $createdAt;

    /**
     * Crée la demande et renvoie le jeton en clair, à mettre dans le lien de l'email
     * (il n'est stocké nulle part ailleurs).
     *
     * @return array{0: self, 1: string}
     */
    public static function create(User $user): array
    {
        $token = bin2hex(random_bytes(32));
        $request = new self();
        $request->user = $user;
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

    public function getExpiresAt(): \DateTimeImmutable
    {
        return $this->expiresAt;
    }

    public function isExpired(\DateTimeImmutable $now = new \DateTimeImmutable()): bool
    {
        return $this->expiresAt <= $now;
    }
}
