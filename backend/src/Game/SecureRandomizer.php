<?php

namespace App\Game;

/**
 * Hasard cryptographique (random_int) : impossible à prévoir pour un joueur.
 */
final class SecureRandomizer implements Randomizer
{
    public function pick(array $items): mixed
    {
        return $items[random_int(0, \count($items) - 1)];
    }

    public function shuffle(array $items): array
    {
        // Mélange de Fisher-Yates
        $items = array_values($items);
        for ($i = \count($items) - 1; $i > 0; --$i) {
            $j = random_int(0, $i);
            [$items[$i], $items[$j]] = [$items[$j], $items[$i]];
        }

        return $items;
    }
}
