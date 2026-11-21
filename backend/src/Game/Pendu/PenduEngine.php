<?php

namespace App\Game\Pendu;

use App\Game\GameEngine;
use App\Game\Randomizer;

/**
 * Règles du Pendu, côté serveur : le mot n'est envoyé au joueur qu'à la fin de la partie.
 *
 * État : ['word' => 'MOUSTACHES', 'guessed' => ['S', 'Z'], 'lives' => 8]
 */
final class PenduEngine implements GameEngine
{
    /** Un chat a neuf vies : 9 erreurs autorisées. */
    public const MAX_LIVES = 9;

    public const CORRECT = 'correct';
    public const WRONG = 'wrong';
    public const ALREADY_GUESSED = 'already-guessed';
    public const INVALID = 'invalid';
    public const GAME_OVER = 'game-over';

    /** Mots sur le thème des chats. Les accents, espaces et tirets sont gérés. */
    public const WORDS = [
        'MOUSTACHES',
        'RONRONNEMENT',
        'CROQUETTES',
        'GOUTTIÈRE',
        'GRIFFOIR',
        'LITIÈRE',
        'PELOTE DE LAINE',
        'CHAT DE GOUTTIÈRE',
        'HERBE À CHAT',
        'CHATON',
        'MATOU',
        'FÉLIN',
        'COUSSINETS',
        'PELAGE',
        'SIAMOIS',
        'PERSAN',
        'CHARTREUX',
        'SPHYNX',
        'MAINE COON',
        'BENGAL',
        'TIGRÉ',
        'ÉCAILLE DE TORTUE',
        'SOURIS',
        'ÉGRATIGNURE',
        'MIAULEMENT',
        'SIESTE',
        'CHAT-HUANT',
        'VÉTÉRINAIRE',
        'PANIER',
        'CARTON',
        'PATTE',
        'QUEUE',
        'VIBRISSES',
        'FRIANDISE',
        'ARBRE À CHAT',
        'CHAUSSETTE',
        'PÂTÉE',
        'SAUT DE CHAT',
        'BOULE DE POILS',
        'NEUF VIES',
    ];

    public function __construct(private readonly Randomizer $randomizer)
    {
    }

    public function gameName(): string
    {
        return 'Pendu';
    }

    public function start(?string $level, ?array $previousState): array
    {
        // Jamais deux fois de suite le même mot pour un joueur
        $previous = $previousState['word'] ?? null;
        $candidates = array_values(array_filter(self::WORDS, static fn (string $word) => $word !== $previous));

        return self::createState($this->randomizer->pick($candidates ?: self::WORDS));
    }

    /**
     * @return array{word: string, guessed: list<string>, lives: int}
     */
    public static function createState(string $word): array
    {
        $word = mb_strtoupper(trim($word));
        if ([] === self::lettersOf($word)) {
            throw new \InvalidArgumentException(sprintf('Le mot « %s » ne contient aucune lettre à deviner.', $word));
        }

        return ['word' => $word, 'guessed' => [], 'lives' => self::MAX_LIVES];
    }

    /**
     * Propose une lettre (accents et minuscules acceptés).
     *
     * @param array<string, mixed> $state
     *
     * @return array{0: array<string, mixed>, 1: string} [nouvel état, résultat]
     */
    public function guess(array $state, string $input): array
    {
        if (self::PLAYING !== $this->status($state)) {
            return [$state, self::GAME_OVER];
        }

        $letter = self::normalizeLetter($input);
        if (null === $letter) {
            return [$state, self::INVALID];
        }
        if (\in_array($letter, $state['guessed'], true)) {
            return [$state, self::ALREADY_GUESSED];
        }

        $correct = \in_array($letter, self::lettersOf($state['word']), true);
        $state['guessed'][] = $letter;
        if (!$correct) {
            --$state['lives'];
        }

        return [$state, $correct ? self::CORRECT : self::WRONG];
    }

    public function status(array $state): string
    {
        if ($state['lives'] <= 0) {
            return self::LOST;
        }

        return [] === array_diff(self::lettersOf($state['word']), $state['guessed']) ? self::WON : self::PLAYING;
    }

    /**
     * 100 points + 20 par vie restante + 5 par lettre différente du mot.
     */
    public function score(array $state): int
    {
        if (self::WON !== $this->status($state)) {
            return 0;
        }

        return 100 + 20 * $state['lives'] + 5 * \count(self::lettersOf($state['word']));
    }

    public function publicState(array $state): array
    {
        $status = $this->status($state);
        $over = self::PLAYING !== $status;
        $letters = self::lettersOf($state['word']);

        $cells = [];
        foreach (mb_str_split($state['word']) as $char) {
            $letter = self::normalizeLetter($char);
            if (null === $letter) {
                // Espace ou tiret : toujours visible
                $cells[] = ['char' => $char, 'letter' => false, 'revealed' => true, 'missed' => false];
                continue;
            }
            $found = \in_array($letter, $state['guessed'], true);
            $cells[] = [
                // Une lettre non trouvée reste cachée (null) tant que la partie n'est pas finie
                'char' => $found || $over ? $char : null,
                'letter' => true,
                'revealed' => $found || $over,
                'missed' => self::LOST === $status && !$found,
            ];
        }

        return [
            'cells' => $cells,
            'lives' => $state['lives'],
            'maxLives' => self::MAX_LIVES,
            'guessed' => $state['guessed'],
            'wrong' => array_values(array_diff($state['guessed'], $letters)),
            'status' => $status,
            'word' => $over ? $state['word'] : null,
        ];
    }

    /** "É" → "E", "à" → "A", "ç" → "C"… ; null si ce n'est pas une seule lettre. */
    public static function normalizeLetter(string $char): ?string
    {
        if (1 !== mb_strlen($char)) {
            return null;
        }
        $base = preg_replace('/\p{Mn}/u', '', (string) \Normalizer::normalize($char, \Normalizer::FORM_D));

        $base = mb_strtoupper((string) $base);

        return 1 === preg_match('/^[A-Z]$/', $base) ? $base : null;
    }

    /**
     * Lettres différentes du mot (A–Z, sans accents).
     *
     * @return list<string>
     */
    public static function lettersOf(string $word): array
    {
        $letters = [];
        foreach (mb_str_split($word) as $char) {
            $letter = self::normalizeLetter($char);
            if (null !== $letter && !\in_array($letter, $letters, true)) {
                $letters[] = $letter;
            }
        }

        return $letters;
    }
}
