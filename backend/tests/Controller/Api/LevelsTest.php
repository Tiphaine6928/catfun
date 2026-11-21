<?php

namespace App\Tests\Controller\Api;

use App\Entity\Game;
use App\Entity\User;

/**
 * Niveaux de difficulté : classement et meilleur score par niveau.
 * (Le niveau d'une partie est vérifié à son démarrage : voir GameSessionTest.)
 */
final class LevelsTest extends ApiTestCase
{
    private const LEVELS = ['facile', 'normal', 'difficile'];

    private Game $memoire;
    private Game $pendu;

    protected function setUp(): void
    {
        parent::setUp();
        $this->memoire = $this->createGame('Mémoire', self::LEVELS);
        $this->pendu = $this->createGame('Pendu');
    }

    public function testTheGameListShowsTheLevels(): void
    {
        $games = $this->requestJson('GET', '/api/games');

        self::assertSame(['Mémoire' => self::LEVELS, 'Pendu' => []], array_column($games, 'levels', 'name'));
    }

    public function testTheLeaderboardCanBeFilteredByLevel(): void
    {
        $alice = $this->createUser('alice@cat.fun');
        $bob = $this->createUser('bob@cat.fun');
        $chloe = $this->createUser('chloe@cat.fun');
        $this->addMemoireScore($alice, 'facile', 600);
        $this->addMemoireScore($alice, 'difficile', 900);
        $this->addMemoireScore($bob, 'facile', 550);
        $this->addMemoireScore($bob, 'normal', 800);
        $this->addMemoireScore($chloe, 'difficile', 1200);
        $this->addMemoireScore($chloe, null, 1500); // ancien score, sans niveau

        $base = '/api/games/'.$this->memoire->getId().'/leaderboard';

        $facile = $this->requestJson('GET', $base.'?level=facile');
        self::assertResponseIsSuccessful();
        self::assertSame('facile', $facile['level']);
        self::assertSame(self::LEVELS, $facile['game']['levels']);
        self::assertSame(['alice' => 600, 'bob' => 550], array_column($facile['scores'], 'points', 'player'));
        self::assertSame(2, $facile['totalPlayers']);

        $normal = $this->requestJson('GET', $base.'?level=normal');
        self::assertSame(['bob' => 800], array_column($normal['scores'], 'points', 'player'));
        self::assertSame(1, $normal['totalPlayers']);

        $difficile = $this->requestJson('GET', $base.'?level=difficile');
        self::assertSame(['chloe' => 1200, 'alice' => 900], array_column($difficile['scores'], 'points', 'player'));

        // Sans niveau : meilleur score de chaque joueur, tous niveaux confondus (anciens scores compris)
        $all = $this->requestJson('GET', $base);
        self::assertNull($all['level']);
        self::assertSame(['chloe' => 1500, 'alice' => 900, 'bob' => 800], array_column($all['scores'], 'points', 'player'));
        self::assertSame(3, $all['totalPlayers']);
    }

    /**
     * @dataProvider invalidLevelQueryProvider
     */
    public function testAnInvalidLevelInTheUrlIsRefused(string $game, string $level, string $message): void
    {
        $gameId = ('memoire' === $game ? $this->memoire : $this->pendu)->getId();

        $data = $this->requestJson('GET', '/api/games/'.$gameId.'/leaderboard?level='.urlencode($level));

        self::assertResponseStatusCodeSame(400);
        self::assertStringContainsString($message, $data['message']);
    }

    public static function invalidLevelQueryProvider(): iterable
    {
        yield 'niveau inconnu' => ['memoire', 'expert', 'facile, normal, difficile'];
        yield 'niveau vide' => ['memoire', '', 'facile, normal, difficile'];
        yield 'jeu sans niveaux' => ['pendu', 'facile', 'pas de niveaux'];
    }

    public function testMyBestScoreByLevel(): void
    {
        $alice = $this->createUser('alice@cat.fun');
        $this->addMemoireScore($alice, 'facile', 600);
        $this->addMemoireScore($alice, 'facile', 450);
        $this->addMemoireScore($alice, 'difficile', 900);

        $best = fn (string $query) => $this->requestJson('GET', '/api/me/games/'.$this->memoire->getId().'/best'.$query, as: $alice)['best'];

        self::assertSame(600, $best('?level=facile'));
        self::assertNull($best('?level=normal'), 'jamais joué en Normal');
        self::assertSame(900, $best('?level=difficile'));
        self::assertSame(900, $best(''), 'sans niveau : tous niveaux confondus');

        $this->requestJson('GET', '/api/me/games/'.$this->memoire->getId().'/best?level=expert', as: $alice);
        self::assertResponseStatusCodeSame(400);
    }

    private function addMemoireScore(User $player, ?string $level, int $points): void
    {
        $this->addScore($player, $this->memoire, $points, level: $level);
    }
}
