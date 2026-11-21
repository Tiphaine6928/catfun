<?php

namespace App\Entity;

use App\Repository\GameRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: GameRepository::class)]
class Game
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    private ?string $name = null;

    #[ORM\Column(type: Types::TEXT)]
    private ?string $description = null;

    /**
     * Niveaux de difficulté du jeu (ex. ["facile", "normal", "difficile"]), ou null s'il n'en a pas.
     * Quand un jeu a des niveaux, chaque score doit indiquer le sien.
     *
     * @var list<string>|null
     */
    #[ORM\Column(type: Types::JSON, nullable: true)]
    private ?array $levels = null;

    /**
     * @var Collection<int, Score>
     */
    #[ORM\OneToMany(targetEntity: Score::class, mappedBy: 'game')]
    private Collection $scores;

    public function __construct()
    {
        $this->scores = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getName(): ?string
    {
        return $this->name;
    }

    public function setName(string $name): static
    {
        $this->name = $name;

        return $this;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(string $description): static
    {
        $this->description = $description;

        return $this;
    }

    /**
     * @return Collection<int, Score>
     */
    public function getScores(): Collection
    {
        return $this->scores;
    }

    /**
     * @return list<string>
     */
    public function getLevels(): array
    {
        return $this->levels ?? [];
    }

    /**
     * @param list<string>|null $levels
     */
    public function setLevels(?array $levels): static
    {
        $this->levels = $levels ? array_values($levels) : null;

        return $this;
    }

    public function hasLevels(): bool
    {
        return [] !== $this->getLevels();
    }

    public function hasLevel(string $level): bool
    {
        return \in_array($level, $this->getLevels(), true);
    }
}
