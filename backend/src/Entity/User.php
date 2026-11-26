<?php

namespace App\Entity;

use App\Repository\UserRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Validator\Constraints\UniqueEntity;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: UserRepository::class)]
#[ORM\UniqueConstraint(name: 'UNIQ_IDENTIFIER_EMAIL', fields: ['email'])]
#[ORM\UniqueConstraint(name: 'UNIQ_USER_PSEUDO', fields: ['pseudo'])]
#[UniqueEntity(fields: ['email'], message: 'Un compte existe déjà avec cet email.')]
#[UniqueEntity(fields: ['pseudo'], message: 'Ce pseudo est déjà pris.')]
class User implements UserInterface, PasswordAuthenticatedUserInterface
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 180)]
    #[Assert\NotBlank(message: 'Merci de saisir une adresse email.')]
    #[Assert\Email(message: 'L\'adresse email "{{ value }}" n\'est pas valide.')]
    #[Assert\Length(max: 180)]
    private ?string $email = null;

    /**
     * Nom affiché publiquement (classements). Unique, sans tenir compte des majuscules
     * (collation MySQL utf8mb4_unicode_ci).
     */
    #[ORM\Column(length: 30)]
    #[Assert\NotBlank(message: 'Merci de choisir un pseudo.')]
    #[Assert\Length(
        min: 3,
        max: 30,
        minMessage: 'Le pseudo doit faire au moins {{ limit }} caractères.',
        maxMessage: 'Le pseudo doit faire au plus {{ limit }} caractères.',
    )]
    #[Assert\Regex(
        pattern: '/^[\p{L}\p{N}_-]+$/u',
        message: 'Le pseudo ne peut contenir que des lettres, des chiffres, « _ » et « - ».',
    )]
    private ?string $pseudo = null;

    /**
     * @var list<string> The user roles
     */
    #[ORM\Column]
    private array $roles = [];

    /**
     * @var string The hashed password
     */
    #[ORM\Column]
    private ?string $password = null;

    /**
     * @var Collection<int, Score>
     */
    #[ORM\OneToMany(targetEntity: Score::class, mappedBy: 'player')]
    private Collection $scores;

    /** Dernière connexion (ou inscription) : un compte inactif trop longtemps est supprimé (RGPD). */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $lastLoginAt;

    /** Date de l'email prévenant que le compte inactif va être supprimé ; null si pas prévenu. */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $inactivityNoticeSentAt = null;

    public function __construct()
    {
        $this->scores = new ArrayCollection();
        $this->lastLoginAt = new \DateTimeImmutable();
    }

    public function getLastLoginAt(): \DateTimeImmutable
    {
        return $this->lastLoginAt;
    }

    /** Connexion réussie : le compte est de nouveau actif, l'avertissement éventuel est annulé. */
    public function recordLogin(\DateTimeImmutable $at = new \DateTimeImmutable()): static
    {
        $this->lastLoginAt = $at;
        $this->inactivityNoticeSentAt = null;

        return $this;
    }

    public function getInactivityNoticeSentAt(): ?\DateTimeImmutable
    {
        return $this->inactivityNoticeSentAt;
    }

    public function markInactivityNoticeSent(\DateTimeImmutable $at = new \DateTimeImmutable()): static
    {
        $this->inactivityNoticeSentAt = $at;

        return $this;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getEmail(): ?string
    {
        return $this->email;
    }

    public function setEmail(string $email): static
    {
        $this->email = trim($email);

        return $this;
    }

    public function getPseudo(): ?string
    {
        return $this->pseudo;
    }

    public function setPseudo(string $pseudo): static
    {
        $this->pseudo = trim($pseudo);

        return $this;
    }

    /**
     * A visual identifier that represents this user.
     *
     * @see UserInterface
     */
    public function getUserIdentifier(): string
    {
        return (string) $this->email;
    }

    /**
     * @see UserInterface
     */
    public function getRoles(): array
    {
        $roles = $this->roles;
        // guarantee every user at least has ROLE_USER
        $roles[] = 'ROLE_USER';

        return array_unique($roles);
    }

    /**
     * @param list<string> $roles
     */
    public function setRoles(array $roles): static
    {
        $this->roles = $roles;

        return $this;
    }

    /**
     * @see PasswordAuthenticatedUserInterface
     */
    public function getPassword(): ?string
    {
        return $this->password;
    }

    public function setPassword(string $password): static
    {
        $this->password = $password;

        return $this;
    }

    /**
     * @return Collection<int, Score>
     */
    public function getScores(): Collection
    {
        return $this->scores;
    }

    #[\Deprecated]
    public function eraseCredentials(): void
    {
        // @deprecated, to be removed when upgrading to Symfony 8
    }
}
