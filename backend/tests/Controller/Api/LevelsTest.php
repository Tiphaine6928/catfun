<?php

namespace App\Tests\Controller\Api;

use App\Entity\Game;
use App\Entity\Score;
use App\Entity\User;

/**
 * Niveaux de difficulté : enregistrement du niveau avec le score,
 * classement et meilleur score par niveau.
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

    public function testAScoreIsSavedWithItsLevel(): void
    {
        $alice = $this->createUser('alice@cat.fun');

        $data = $this->requestJson('POST', '/api/scores', ['gameId' => $this->memoire->getId(), 'points' => 600, 'level' => 'facile'], $alice);

        self::assertResponseStatusCodeSame(201);
        self::assertSame('facile', $data['level']);
        $this->em->clear();
        self::assertSame('facile', $this->em->find(Score::class, $data['id'])->getLevel());

        $history = $this->requestJson('GET', '/api/me/scores', as: $alice);
        self::assertSame('facile', $history[0]['level']);
    }

    /**
     * @dataProvider invalidLevelProvider
     */
    public function testTheLevelMustMatchTheGame(string $game, array $extra, string $message): void
    {
        $alice = $this->createUser('alice@cat.fun');
        $gameId = ('memoire' === $game ? $this->memoire : $this->pendu)->getId();

        $data = $this->requestJson('POST', '/api/scores', ['gameId' => $gameId, 'points' => 100] + $extra, $alice);

        self::assertResponseStatusCodeSame(422);
        self::assertStringContainsString($message, $data['errors']['level']);
        self::assertSame(0, $this->em->getRepository(Score::class)->count([]));
    }

    public static function invalidLevelProvider(): iterable
    {
        yield 'Mémoire sans niveau' => ['memoire', [], 'facile, normal, difficile'];
        yield 'Mémoire, niveau inconnu' => ['memoire', ['level' => 'expert'], 'facile, normal, difficile'];
        yield 'Mémoire, niveau en majuscules' => ['memoire', ['level' => 'Facile'], 'facile, normal, difficile'];
        yield 'Mémoire, niveau qui n’est pas du texte' => ['memoire', ['level' => 2], 'chaîne de caractères'];
        yield 'Pendu avec un niveau' => ['pendu', ['level' => 'facile'], 'pas de niveaux'];
    }

    public function testAGameWithoutLevelsStillWorksWithoutLevel(): void
    {
        $alice = $this->createUser('alice@cat.fun');

        $data = $this->requestJson('POST', '/api/scores', ['gameId' => $this->pendu->getId(), 'points' => 300], $alice);

        self::assertResponseStatusCodeSame(201);
        self::assertNull($data['level']);
    }

    public function testTheLeaderboardCanBeFilteredByLevel(): void
    {
        $alice = $this->createUser('alice@cat.fun');
        $bob = $this->createUser('bob@cat.fun');
        $chloe = $this->createUser('chloe@cat.fun');
        $this->addScore($alice, 'facile', 600);
        $this->addScore($alice, 'difficile', 900);
        $this->addScore($bob, 'facile', 550);
        $this->addScore($bob, 'normal', 800);
        $this->addScore($chloe, 'difficile', 1200);
        $this->addScore($chloe, null, 1500); // ancien score, sans niveau

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
        $this->addScore($alice, 'facile', 600);
        $this->addScore($alice, 'facile', 450);
        $this->addScore($alice, 'difficile', 900);

        $best = fn (string $query) => $this->requestJson('GET', '/api/me/games/'.$this->memoire->getId().'/best'.$query, as: $alice)['best'];

        self::assertSame(600, $best('?level=facile'));
        self::assertNull($best('?level=normal'), 'jamais joué en Normal');
        self::assertSame(900, $best('?level=difficile'));
        self::assertSame(900, $best(''), 'sans niveau : tous niveaux confondus');

        $this->requestJson('GET', '/api/me/games/'.$this->memoire->getId().'/best?level=expert', as: $alice);
        self::assertResponseStatusCodeSame(400);
    }

    private function addScore(User $player, ?string $level, int $points): void
    {
        $score = (new Score())->setPlayer($player)->setGame($this->memoire)->setPoints($points)->setLevel($level);
        $this->em->persist($score);
        $this->em->flush();
    }
}
