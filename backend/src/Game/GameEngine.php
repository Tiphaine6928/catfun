<?php

namespace App\Game;

/**
 * Règles d'un jeu, exécutées par le serveur : le navigateur ne voit que ce que publicState() renvoie.
 * L'état d'une partie est un tableau sérialisable en JSON (stocké dans GameSession).
 */
interface GameEngine
{
    public const PLAYING = 'playing';
    public const WON = 'won';
    public const LOST = 'lost';

    /** Nom du jeu en base (Game::name). */
    public function gameName(): string;

    /**
     * Nouvelle partie.
     *
     * @param array<string, mixed>|null $previousState état de la partie précédente du joueur (pour ne pas
     *                                                 retomber sur le même mot, par exemple)
     *
     * @return array<string, mixed>
     */
    public function start(?string $level, ?array $previousState): array;

    /** @param array<string, mixed> $state */
    public function status(array $state): string;

    /**
     * Score d'une partie gagnée (0 sinon).
     *
     * @param array<string, mixed> $state
     */
    public function score(array $state): int;

    /**
     * Ce que le joueur a le droit de voir : jamais le mot caché ni les cartes non retournées.
     *
     * @param array<string, mixed> $state
     *
     * @return array<string, mixed>
     */
    public function publicState(array $state): array;
}
