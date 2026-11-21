<?php

namespace App\Entity;

use App\Repository\ScoreRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: ScoreRepository::class)]
#[ORM\Index(name: 'IDX_SCORE_GAME_POINTS', columns: ['game_id', 'points'])]
#[ORM\Index(name: 'IDX_SCORE_GAME_LEVEL_POINTS', columns: ['game_id', 'level', 'points'])]
class Score
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column]
    #[Assert\NotNull]
    #[Assert\PositiveOrZero]
    private ?int $points = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $date;

    /**
     * Niveau de la partie (ex. "facile"), pour les jeux qui en ont ; null sinon.
     * Les scores du Mémoire enregistrés avant l'ajout des niveaux sont aussi à null.
     */
    #[ORM\Column(length: 20, nullable: true)]
    private ?string $level = null;

    #[ORM\ManyToOne(inversedBy: 'scores')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Assert\NotNull]
    private ?User $player = null;

    #[ORM\ManyToOne(inversedBy: 'scores')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Assert\NotNull]
    private ?Game $game = null;

    public function __construct()
    {
        $this->date = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getPoints(): ?int
    {
        return $this->points;
    }

    public function setPoints(int $points): static
    {
        $this->points = $points;

        return $this;
    }

    public function getDate(): \DateTimeImmutable
    {
        return $this->date;
    }

    public function setDate(\DateTimeImmutable $date): static
    {
        $this->date = $date;

        return $this;
    }

    public function getLevel(): ?string
    {
        return $this->level;
    }

    public function setLevel(?string $level): static
    {
        $this->level = $level;

        return $this;
    }

    public function getPlayer(): ?User
    {
        return $this->player;
    }

    public function setPlayer(?User $player): static
    {
        $this->player = $player;

        return $this;
    }

    public function getGame(): ?Game
    {
        return $this->game;
    }

    public function setGame(?Game $game): static
    {
        $this->game = $game;

        return $this;
    }
}
