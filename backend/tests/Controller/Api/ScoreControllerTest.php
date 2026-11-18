<?php

namespace App\Tests\Controller\Api;

use App\Entity\Score;

final class ScoreControllerTest extends ApiTestCase
{
    public function testListGamesIsPublic(): void
    {
        $this->createGame('Pendu');
        $this->createGame('Mémoire');

        $data = $this->requestJson('GET', '/api/games');

        self::assertResponseIsSuccessful();
        self::assertSame(['Mémoire', 'Pendu'], array_column($data, 'name'));
    }

    public function testCreateScoreRequiresAToken(): void
    {
        $game = $this->createGame('Pendu');

        $this->requestJson('POST', '/api/scores', ['gameId' => $game->getId(), 'points' => 10]);

        self::assertResponseStatusCodeSame(401);
    }

    public function testCreateScoreForTheConnectedUser(): void
    {
        $alice = $this->createUser('alice@cat.fun');
        $game = $this->createGame('Pendu');

        $data = $this->requestJson('POST', '/api/scores', ['gameId' => $game->getId(), 'points' => 120], $alice);

        self::assertResponseStatusCodeSame(201);
        self::assertSame(120, $data['points']);
        self::assertSame('Pendu', $data['game']['name']);

        $this->em->clear();
        $score = $this->em->getRepository(Score::class)->find($data['id']);
        self::assertSame('alice@cat.fun', $score->getPlayer()->getEmail());
    }

    /**
     * @dataProvider invalidScoreProvider
     */
    public function testCreateScoreRejectsInvalidData(callable $body, int $status, ?string $field): void
    {
        $alice = $this->createUser('alice@cat.fun');
        $game = $this->createGame('Pendu');

        $data = $this->requestJson('POST', '/api/scores', $body($game->getId()), $alice);

        self::assertResponseStatusCodeSame($status);
        if (null !== $field) {
            self::assertArrayHasKey($field, $data['errors']);
        }
        self::assertSame(0, $this->em->getRepository(Score::class)->count([]));
    }

    public static function invalidScoreProvider(): iterable
    {
        yield 'JSON invalide' => [fn (int $id) => '{pas du json', 400, null];
        yield 'pas un objet' => [fn (int $id) => '42', 400, null];
        yield 'points manquants' => [fn (int $id) => ['gameId' => $id], 422, 'points'];
        yield 'points en texte' => [fn (int $id) => ['gameId' => $id, 'points' => '10'], 422, 'points'];
        yield 'points négatifs' => [fn (int $id) => ['gameId' => $id, 'points' => -5], 422, 'points'];
        yield 'jeu manquant' => [fn (int $id) => ['points' => 10], 422, 'gameId'];
        yield 'jeu inexistant' => [fn (int $id) => ['gameId' => $id + 999, 'points' => 10], 422, 'gameId'];
    }

    public function testLeaderboardIsPublicAndSorted(): void
    {
        $alice = $this->createUser('alice@cat.fun');
        $bob = $this->createUser('bob@cat.fun');
        $pendu = $this->createGame('Pendu');
        $memoire = $this->createGame('Mémoire');

        $this->requestJson('POST', '/api/scores', ['gameId' => $pendu->getId(), 'points' => 50], $alice);
        $this->requestJson('POST', '/api/scores', ['gameId' => $pendu->getId(), 'points' => 90], $bob);
        $this->requestJson('POST', '/api/scores', ['gameId' => $pendu->getId(), 'points' => 70], $alice);
        $this->requestJson('POST', '/api/scores', ['gameId' => $memoire->getId(), 'points' => 999], $alice);

        $data = $this->requestJson('GET', '/api/games/'.$pendu->getId().'/leaderboard');

        self::assertResponseIsSuccessful();
        self::assertSame('Pendu', $data['game']['name']);
        self::assertSame([90, 70, 50], array_column($data['scores'], 'points'));
        self::assertSame([1, 2, 3], array_column($data['scores'], 'rank'));
        self::assertSame(['bob', 'alice', 'alice'], array_column($data['scores'], 'player'));
        self::assertStringNotContainsString('@', (string) $this->client->getResponse()->getContent());

        $data = $this->requestJson('GET', '/api/games/'.$pendu->getId().'/leaderboard?limit=1');
        self::assertCount(1, $data['scores']);

        $this->requestJson('GET', '/api/games/'.$pendu->getId().'/leaderboard?limit=0');
        self::assertResponseStatusCodeSame(400);
    }

    public function testLeaderboardShowsPseudosNotEmails(): void
    {
        $user = $this->createUser('tiphaine.chat@example.com', 'MinouDu69');
        $game = $this->createGame('Pendu');
        $this->requestJson('POST', '/api/scores', ['gameId' => $game->getId(), 'points' => 10], $user);

        $data = $this->requestJson('GET', '/api/games/'.$game->getId().'/leaderboard');

        self::assertSame('MinouDu69', $data['scores'][0]['player']);
        self::assertStringNotContainsString('tiphaine', (string) $this->client->getResponse()->getContent());
    }

    public function testLeaderboardOfUnknownGame(): void
    {
        $data = $this->requestJson('GET', '/api/games/123456/leaderboard');

        self::assertResponseStatusCodeSame(404);
        self::assertSame('Ce jeu n\'existe pas.', $data['message']);
    }

    public function testMyScoresOnlyReturnsMyOwnScores(): void
    {
        $alice = $this->createUser('alice@cat.fun');
        $bob = $this->createUser('bob@cat.fun');
        $pendu = $this->createGame('Pendu');
        $memoire = $this->createGame('Mémoire');

        $this->requestJson('POST', '/api/scores', ['gameId' => $pendu->getId(), 'points' => 10], $alice);
        $this->requestJson('POST', '/api/scores', ['gameId' => $memoire->getId(), 'points' => 20], $alice);
        $this->requestJson('POST', '/api/scores', ['gameId' => $pendu->getId(), 'points' => 30], $bob);

        $data = $this->requestJson('GET', '/api/me/scores', as: $alice);
        self::assertResponseIsSuccessful();
        self::assertEqualsCanonicalizing([10, 20], array_column($data, 'points'));

        $data = $this->requestJson('GET', '/api/me/scores?game='.$pendu->getId(), as: $alice);
        self::assertSame([10], array_column($data, 'points'));

        $this->requestJson('GET', '/api/me/scores?game=123456', as: $alice);
        self::assertResponseStatusCodeSame(404);

        $this->requestJson('GET', '/api/me/scores');
        self::assertResponseStatusCodeSame(401);
    }

    public function testMyBestScore(): void
    {
        $alice = $this->createUser('alice@cat.fun');
        $pendu = $this->createGame('Pendu');

        $data = $this->requestJson('GET', '/api/me/games/'.$pendu->getId().'/best', as: $alice);
        self::assertResponseIsSuccessful();
        self::assertNull($data['best']);

        $this->requestJson('POST', '/api/scores', ['gameId' => $pendu->getId(), 'points' => 40], $alice);
        $this->requestJson('POST', '/api/scores', ['gameId' => $pendu->getId(), 'points' => 75], $alice);

        $data = $this->requestJson('GET', '/api/me/games/'.$pendu->getId().'/best', as: $alice);
        self::assertSame(75, $data['best']);
    }
}
