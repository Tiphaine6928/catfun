<?php

namespace App\Game\Memoire;

use App\Game\GameEngine;
use App\Game\Randomizer;

/**
 * Règles du Mémoire, côté serveur : le joueur ne connaît une carte qu'en la retournant.
 *
 * État : ['level' => 'normal', 'cards' => [3, 7, 3, …] (n° de symbole de chaque carte),
 *         'matched' => [0, 2] (cartes trouvées), 'faceUp' => [5] (cartes retournées non appariées), 'moves' => 4]
 */
final class MemoireEngine implements GameEngine
{
    public const FIRST = 'first';
    public const MATCH = 'match';
    public const MISMATCH = 'mismatch';
    public const IGNORED = 'ignored';

    /** Nombre de paires par niveau. */
    public const LEVELS = ['facile' => 6, 'normal' => 8, 'difficile' => 12];

    /** Symboles des cartes, avec le nom lu par les lecteurs d'écran. */
    public const SYMBOLS = [
        ['emoji' => '😺', 'label' => 'chat souriant'],
        ['emoji' => '😹', 'label' => 'chat qui pleure de rire'],
        ['emoji' => '😻', 'label' => 'chat amoureux'],
        ['emoji' => '😼', 'label' => 'chat malicieux'],
        ['emoji' => '😽', 'label' => 'chat qui fait un bisou'],
        ['emoji' => '🙀', 'label' => 'chat effrayé'],
        ['emoji' => '😿', 'label' => 'chat triste'],
        ['emoji' => '😾', 'label' => 'chat boudeur'],
        ['emoji' => '🐈', 'label' => 'chat qui marche'],
        ['emoji' => '🐈‍⬛', 'label' => 'chat noir'],
        ['emoji' => '🧶', 'label' => 'pelote de laine'],
        ['emoji' => '🐟', 'label' => 'poisson'],
        ['emoji' => '🐭', 'label' => 'souris'],
        ['emoji' => '🥛', 'label' => 'bol de lait'],
        ['emoji' => '🐾', 'label' => 'empreintes de pattes'],
        ['emoji' => '🛋️', 'label' => 'canapé griffé'],
    ];

    public function __construct(private readonly Randomizer $randomizer)
    {
    }

    public function gameName(): string
    {
        return 'Mémoire';
    }

    public function start(?string $level, ?array $previousState): array
    {
        if (null === $level || !isset(self::LEVELS[$level])) {
            throw new \InvalidArgumentException(sprintf('Niveau inconnu : %s.', $level ?? '(aucun)'));
        }
        $pairs = self::LEVELS[$level];

        // `pairs` symboles tirés au hasard, chacun en deux exemplaires, puis mélangés
        $symbols = \array_slice($this->randomizer->shuffle(array_keys(self::SYMBOLS)), 0, $pairs);
        $deck = $this->randomizer->shuffle(array_merge(...array_map(static fn (int $s) => [$s, $s], $symbols)));

        return ['level' => $level, 'cards' => $deck, 'matched' => [], 'faceUp' => [], 'moves' => 0];
    }

    /**
     * Retourne une carte. Si deux cartes différentes sont encore visibles, elles sont d'abord cachées.
     *
     * @param array<string, mixed> $state
     *
     * @return array{0: array<string, mixed>, 1: string} [nouvel état, résultat]
     */
    public function flip(array $state, int $index): array
    {
        if (!isset($state['cards'][$index]) || \in_array($index, $state['matched'], true) || self::WON === $this->status($state)) {
            return [$state, self::IGNORED];
        }

        $current = $state;
        if (2 === \count($current['faceUp'])) {
            $current['faceUp'] = [];
        }
        if (\in_array($index, $current['faceUp'], true)) {
            return [$state, self::IGNORED];
        }

        if ([] === $current['faceUp']) {
            $current['faceUp'] = [$index];

            return [$current, self::FIRST];
        }

        $first = $current['faceUp'][0];
        ++$current['moves'];

        if ($current['cards'][$first] === $current['cards'][$index]) {
            $current['matched'][] = $first;
            $current['matched'][] = $index;
            $current['faceUp'] = [];

            return [$current, self::MATCH];
        }

        $current['faceUp'] = [$first, $index];

        return [$current, self::MISMATCH];
    }

    public function status(array $state): string
    {
        return \count($state['matched']) === \count($state['cards']) ? self::WON : self::PLAYING;
    }

    /** Erreurs = coups en trop par rapport à une partie parfaite (un coup par paire). */
    public function mistakes(array $state): int
    {
        return max(0, $state['moves'] - intdiv(\count($state['matched']), 2));
    }

    /**
     * 50 points par paire + bonus de précision de 50 par paire, moins 10 par erreur (jamais négatif).
     */
    public function score(array $state): int
    {
        if (self::WON !== $this->status($state)) {
            return 0;
        }
        $pairs = intdiv(\count($state['cards']), 2);

        return 50 * $pairs + max(0, 50 * $pairs - 10 * $this->mistakes($state));
    }

    public function publicState(array $state): array
    {
        $visible = array_merge($state['matched'], $state['faceUp']);
        $cards = [];
        foreach ($state['cards'] as $index => $symbol) {
            $up = \in_array($index, $visible, true);
            $cards[] = [
                'index' => $index,
                // Le symbole n'est envoyé que pour une carte retournée
                'symbol' => $up ? self::SYMBOLS[$symbol] : null,
                'matched' => \in_array($index, $state['matched'], true),
                'faceUp' => \in_array($index, $state['faceUp'], true),
            ];
        }

        return [
            'level' => $state['level'],
            'cards' => $cards,
            'pairsFound' => intdiv(\count($state['matched']), 2),
            'totalPairs' => intdiv(\count($state['cards']), 2),
            'moves' => $state['moves'],
            'mistakes' => $this->mistakes($state),
            'status' => $this->status($state),
        ];
    }
}
