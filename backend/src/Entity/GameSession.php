<?php

namespace App\Entity;

use App\Game\GameEngine;
use App\Repository\GameSessionRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Une partie jouée côté serveur. Son état (mot caché, ordre des cartes…) ne quitte jamais le serveur :
 * le joueur n'en reçoit que la partie visible. Le score est calculé et enregistré par le serveur.
 *
 * Un visiteur non connecté peut jouer : la partie n'a alors pas de joueur, et seul celui qui connaît
 * son identifiant (impossible à deviner) peut la jouer. S'il la gagne, il peut s'inscrire ou se
 * connecter peu après pour enregistrer son score (voir claim()).
 */
#[ORM\Entity(repositoryClass: GameSessionRepository::class)]
#[ORM\Index(name: 'IDX_GAME_SESSION_PLAYER_GAME', columns: ['player_id', 'game_id', 'created_at'])]
class GameSession
{
    /** Identifiant aléatoire (impossible à deviner), utilisé dans les URL de l'API. */
    #[ORM\Id]
    #[ORM\Column(length: 32)]
    private string $id;

    /** Joueur connecté ; null pour une partie de visiteur. */
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    private ?User $player;

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
    /** Délai pour enregistrer le score d'une partie gagnée en visiteur (le temps de s'inscrire). */
    public const CLAIM_DELAY = '1 hour';

    public function __construct(?User $player, Game $game, ?string $level, array $state)
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

    public function getPlayer(): ?User
    {
        return $this->player;
    }

    public function isGuest(): bool
    {
        return null === $this->player;
    }

    /**
     * Qui peut voir et jouer cette partie : son joueur, ou n'importe qui pour une partie de visiteur
     * (son identifiant aléatoire, connu seulement du navigateur qui l'a commencée, sert de clé).
     */
    public function isPlayableBy(?User $user): bool
    {
        return null === $this->player || $this->player->getId() === $user?->getId();
    }

    /**
     * Partie de visiteur gagnée il y a moins de CLAIM_DELAY, dont le score n'est pas encore enregistré.
     */
    public function isClaimable(\DateTimeImmutable $now = new \DateTimeImmutable()): bool
    {
        return $this->isGuest()
            && GameEngine::WON === $this->status
            && null === $this->score
            && null !== $this->finishedAt
            && $this->finishedAt > $now->modify('-'.self::CLAIM_DELAY);
    }

    /** Rattache la partie (et son score) au joueur qui vient de s'inscrire ou de se connecter. */
    public function claim(User $player, Score $score): static
    {
        $this->player = $player;
        $this->score = $score;

        return $this;
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
