<?php

namespace App\Game;

/**
 * Hasard prévisible, utilisé seulement dans l'environnement de test (voir config/services.yaml) :
 * toujours le premier élément, et aucun mélange.
 * Exemples : premier mot du Pendu = MOUSTACHES ; cartes du Mémoire dans l'ordre 0,0,1,1,2,2…
 */
final class PredictableRandomizer implements Randomizer
{
    public function pick(array $items): mixed
    {
        return $items[0];
    }

    public function shuffle(array $items): array
    {
        return array_values($items);
    }
}
