<?php

namespace App\Entity;

use App\Game\GameEngine;
use App\Repository\GameSessionRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Une partie jouée côté serveur. Son état (mot caché, ordre des cartes…) ne quitte jamais le serveur :
 * le joueur n'en reçoit que la partie visible. Le score est calculé et enregistré par le serveur.
 */
#[ORM\Entity(repositoryClass: GameSessionRepository::class)]
#[ORM\Index(name: 'IDX_GAME_SESSION_PLAYER_GAME', columns: ['player_id', 'game_id', 'created_at'])]
class GameSession
{
    /** Identifiant aléatoire (impossible à deviner), utilisé dans les URL de l'API. */
    #[ORM\Id]
    #[ORM\Column(length: 32)]
    private string $id;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $player;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Game $game;

    #[ORM\Column(length: 20, nullable: true)]
    private ?string $level;

    /** @var array<string, mixed> */
    #[ORM\Column(type: Types::JSON)]
    private array $state;

    #[ORM\Column(length: 10)]
    private string $status = GameEngine::PLAYING;

    /** Score enregistré à la victoire. */
    #[ORM\OneToOne]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?Score $score = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $finishedAt = null;

    /**
     * @param array<string, mixed> $state
     */
    public function __construct(User $player, Game $game, ?string $level, array $state)
    {
        $this->id = bin2hex(random_bytes(16));
        $this->player = $player;
        $this->game = $game;
        $this->level = $level;
        $this->state = $state;
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function getPlayer(): User
    {
        return $this->player;
    }

    public function getGame(): Game
    {
        return $this->game;
    }

    public function getLevel(): ?string
    {
        return $this->level;
    }

    /** @return array<string, mixed> */
    public function getState(): array
    {
        return $this->state;
    }

    /** @param array<string, mixed> $state */
    public function setState(array $state, string $status): static
    {
        $this->state = $state;
        $this->status = $status;
        if (GameEngine::PLAYING !== $status) {
            $this->finishedAt ??= new \DateTimeImmutable();
        }

        return $this;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function isFinished(): bool
    {
        return GameEngine::PLAYING !== $this->status;
    }

    public function getScore(): ?Score
    {
        return $this->score;
    }

    public function setScore(?Score $score): static
    {
        $this->score = $score;

        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getFinishedAt(): ?\DateTimeImmutable
    {
        return $this->finishedAt;
    }
}
