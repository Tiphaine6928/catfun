<?php

namespace App\Game;

use App\Entity\Game;
use App\Game\Memoire\MemoireEngine;
use App\Game\Pendu\PenduEngine;

/**
 * Retrouve les règles d'un jeu à partir de son nom en base.
 */
final class GameEngines
{
    /** @var array<string, GameEngine> */
    private array $engines = [];

    public function __construct(PenduEngine $pendu, MemoireEngine $memoire)
    {
        foreach ([$pendu, $memoire] as $engine) {
            $this->engines[$engine->gameName()] = $engine;
        }
    }

    public function forGame(Game $game): ?GameEngine
    {
        return $this->engines[$game->getName()] ?? null;
    }
}
