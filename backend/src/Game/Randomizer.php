<?php

namespace App\Game;

/**
 * Le hasard des jeux (tirage du mot, mélange des cartes).
 * En production : SecureRandomizer. En test : PredictableRandomizer, pour des parties reproductibles.
 */
interface Randomizer
{
    /**
     * @template T
     *
     * @param non-empty-list<T> $items
     *
     * @return T
     */
    public function pick(array $items): mixed;

    /**
     * @template T
     *
     * @param list<T> $items
     *
     * @return list<T>
     */
    public function shuffle(array $items): array;
}
