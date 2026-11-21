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

    public function testAScoreCanNoLongerBePostedDirectly(): void
    {
        // Anti-triche : un score ne s'obtient qu'en gagnant une partie jouée par le serveur
        $alice = $this->createUser('alice@cat.fun');
        $game = $this->createGame('Pendu');

        $this->requestJson('POST', '/api/scores', ['gameId' => $game->getId(), 'points' => 999999], $alice);

        self::assertContains($this->client->getResponse()->getStatusCode(), [404, 405]);
        self::assertSame(0, $this->em->getRepository(Score::class)->count([]));
    }

    public function testLeaderboardIsPublicAndSorted(): void
    {
        $alice = $this->createUser('alice@cat.fun');
        $bob = $this->createUser('bob@cat.fun');
        $pendu = $this->createGame('Pendu');
        $memoire = $this->createGame('Mémoire');

        $this->addScore($alice, $pendu, 50);
        $this->addScore($bob, $pendu, 90);
        $this->addScore($alice, $pendu, 70);
        $this->addScore($alice, $memoire, 999);

        $data = $this->requestJson('GET', '/api/games/'.$pendu->getId().'/leaderboard');

        self::assertResponseIsSuccessful();
        self::assertSame('Pendu', $data['game']['name']);
        // Une seule ligne par joueur (son meilleur score), le Mémoire n'est pas compté
        self::assertSame([90, 70], array_column($data['scores'], 'points'));
        self::assertSame([1, 2], array_column($data['scores'], 'rank'));
        self::assertSame(['bob', 'alice'], array_column($data['scores'], 'player'));
        self::assertSame(2, $data['totalPlayers']);
        self::assertStringNotContainsString('@', (string) $this->client->getResponse()->getContent());

        $data = $this->requestJson('GET', '/api/games/'.$pendu->getId().'/leaderboard?limit=1');
        self::assertCount(1, $data['scores']);

        $this->requestJson('GET', '/api/games/'.$pendu->getId().'/leaderboard?limit=0');
        self::assertResponseStatusCodeSame(400);
    }

    public function testLeaderboardSharesTheRankOnTiesAndLimitsPlayers(): void
    {
        $game = $this->createGame('Pendu');
        $players = [];
        foreach (['ana' => 80, 'bea' => 100, 'cle' => 80, 'dan' => 60, 'eve' => 80] as $pseudo => $points) {
            $players[$pseudo] = $this->createUser("$pseudo@cat.fun");
            $this->addScore($players[$pseudo], $game, $points, "2026-01-0{$this->dayFor($pseudo)} 10:00:00");
        }

        $data = $this->requestJson('GET', '/api/games/'.$game->getId().'/leaderboard');

        // À égalité, le score obtenu en premier passe devant, mais le rang est partagé
        self::assertSame(['bea', 'ana', 'cle', 'eve', 'dan'], array_column($data['scores'], 'player'));
        self::assertSame([1, 2, 2, 2, 5], array_column($data['scores'], 'rank'));

        // La limite porte sur le nombre de joueurs, le total reste le nombre de joueurs classés
        $data = $this->requestJson('GET', '/api/games/'.$game->getId().'/leaderboard?limit=2');
        self::assertSame(['bea', 'ana'], array_column($data['scores'], 'player'));
        self::assertSame(5, $data['totalPlayers']);
    }

    public function testLeaderboardKeepsTheFirstTimeAPlayerReachedTheirRecord(): void
    {
        $game = $this->createGame('Pendu');
        $alice = $this->createUser('alice@cat.fun');
        $this->addScore($alice, $game, 50, '2026-01-01 10:00:00');
        $first = $this->addScore($alice, $game, 90, '2026-01-02 10:00:00');
        $this->addScore($alice, $game, 90, '2026-01-03 10:00:00');

        $data = $this->requestJson('GET', '/api/games/'.$game->getId().'/leaderboard');

        self::assertCount(1, $data['scores']);
        self::assertSame($first->getId(), $data['scores'][0]['id']);
        self::assertStringStartsWith('2026-01-02', $data['scores'][0]['date']);
    }

    public function testLeaderboardOfAGameWithoutScores(): void
    {
        $game = $this->createGame('Mémoire');

        $data = $this->requestJson('GET', '/api/games/'.$game->getId().'/leaderboard');

        self::assertResponseIsSuccessful();
        self::assertSame([], $data['scores']);
        self::assertSame(0, $data['totalPlayers']);
    }

    public function testLeaderboardShowsPseudosNotEmails(): void
    {
        $user = $this->createUser('tiphaine.chat@example.com', 'MinouDu69');
        $game = $this->createGame('Pendu');
        $this->addScore($user, $game, 10);

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

        $this->addScore($alice, $pendu, 10);
        $this->addScore($alice, $memoire, 20);
        $this->addScore($bob, $pendu, 30);

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

        $this->addScore($alice, $pendu, 40);
        $this->addScore($alice, $pendu, 75);

        $data = $this->requestJson('GET', '/api/me/games/'.$pendu->getId().'/best', as: $alice);
        self::assertSame(75, $data['best']);
    }

    /** Jour d'obtention du score, pour départager les égalités dans un ordre connu. */
    private function dayFor(string $pseudo): int
    {
        return ['ana' => 1, 'bea' => 2, 'cle' => 3, 'dan' => 4, 'eve' => 5][$pseudo];
    }
}
