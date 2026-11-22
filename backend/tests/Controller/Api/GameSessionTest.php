<?php

namespace App\Tests\Controller\Api;

use App\Entity\Game;
use App\Entity\Score;
use App\Entity\User;

/**
 * Parties jouées côté serveur (anti-triche).
 * En test, le hasard est prévisible : premier mot du Pendu = MOUSTACHES (puis RONRONNEMENT),
 * cartes du Mémoire dans l'ordre 0,0,1,1,2,2… (les paires sont côte à côte).
 */
final class GameSessionTest extends ApiTestCase
{
    private Game $pendu;
    private Game $memoire;
    private User $alice;

    protected function setUp(): void
    {
        parent::setUp();
        $this->pendu = $this->createGame('Pendu');
        $this->memoire = $this->createGame('Mémoire', ['facile', 'normal', 'difficile']);
        $this->alice = $this->createUser('alice@cat.fun');
    }

    private function start(Game $game, ?string $level = null, ?User $as = null): mixed
    {
        return $this->requestJson('POST', '/api/games/'.$game->getId().'/sessions', null === $level ? null : ['level' => $level], $as ?? $this->alice);
    }

    private function guess(string $session, string $letter, ?User $as = null): mixed
    {
        return $this->requestJson('POST', "/api/sessions/$session/guess", ['letter' => $letter], $as ?? $this->alice);
    }

    private function flip(string $session, int $index): mixed
    {
        return $this->requestJson('POST', "/api/sessions/$session/flip", ['index' => $index], $this->alice);
    }

    private function rawResponse(): string
    {
        return (string) $this->client->getResponse()->getContent();
    }

    // --- Démarrage ---------------------------------------------------------

    public function testAnInvalidTokenIsRefusedEvenToPlayAsAGuest(): void
    {
        $this->client->request('POST', '/api/games/'.$this->pendu->getId().'/sessions', server: ['HTTP_AUTHORIZATION' => 'Bearer pas-un-token']);

        self::assertResponseStatusCodeSame(401);
    }

    public function testANewPenduGameHidesTheWord(): void
    {
        $data = $this->start($this->pendu);

        self::assertResponseStatusCodeSame(201);
        self::assertMatchesRegularExpression('/^[0-9a-f]{32}$/', $data['id']);
        self::assertSame('playing', $data['status']);
        self::assertSame(9, $data['state']['lives']);
        self::assertCount(10, $data['state']['cells']);
        self::assertSame([null], array_unique(array_column($data['state']['cells'], 'char')));
        self::assertNull($data['state']['word']);
        self::assertStringNotContainsString('MOUSTACHES', $this->rawResponse());
    }

    public function testANewMemoireGameHidesEveryCard(): void
    {
        $data = $this->start($this->memoire, 'facile');

        self::assertResponseStatusCodeSame(201);
        self::assertSame('facile', $data['level']);
        self::assertCount(12, $data['state']['cards']);
        self::assertSame([null], array_unique(array_column($data['state']['cards'], 'symbol')));
        self::assertStringNotContainsString('😺', $this->rawResponse());
    }

    /**
     * @dataProvider invalidStartProvider
     */
    public function testTheLevelMustMatchTheGame(string $game, mixed $level, string $message): void
    {
        $data = $this->start('memoire' === $game ? $this->memoire : $this->pendu, null, null);
        if (null !== $level) {
            $data = $this->requestJson('POST', '/api/games/'.('memoire' === $game ? $this->memoire : $this->pendu)->getId().'/sessions', ['level' => $level], $this->alice);
        }

        self::assertResponseStatusCodeSame(422);
        self::assertStringContainsString($message, $data['errors']['level']);
    }

    public static function invalidStartProvider(): iterable
    {
        yield 'Mémoire sans niveau' => ['memoire', null, 'facile, normal, difficile'];
        yield 'Mémoire, niveau inconnu' => ['memoire', 'expert', 'facile, normal, difficile'];
        yield 'Mémoire, niveau en majuscules' => ['memoire', 'Facile', 'facile, normal, difficile'];
        yield 'Mémoire, niveau qui n’est pas du texte' => ['memoire', 2, 'chaîne de caractères'];
        yield 'Pendu avec un niveau' => ['pendu', 'facile', 'pas de niveaux'];
    }

    public function testAnUnknownGameOrAGameWithoutRulesCannotBePlayed(): void
    {
        $this->requestJson('POST', '/api/games/123456/sessions', null, $this->alice);
        self::assertResponseStatusCodeSame(404);

        $this->start($this->createGame('Échecs'));
        self::assertResponseStatusCodeSame(404);
    }

    // --- Pendu -------------------------------------------------------------

    public function testAPenduWinIsScoredAndSavedByTheServer(): void
    {
        $id = $this->start($this->pendu)['id'];

        $wrong = $this->guess($id, 'z');
        self::assertResponseIsSuccessful();
        self::assertSame('wrong', $wrong['result']);
        self::assertSame(8, $wrong['state']['lives']);
        self::assertSame(['Z'], $wrong['state']['wrong']);

        $correct = $this->guess($id, 's');
        self::assertSame('correct', $correct['result']);
        self::assertSame('___S_____S', implode('', array_map(static fn ($c) => $c['char'] ?? '_', $correct['state']['cells'])));

        self::assertSame('already-guessed', $this->guess($id, 'S')['result']);
        self::assertSame('invalid', $this->guess($id, '5')['result']);
        self::assertSame('correct', $this->guess($id, 'é')['result'], 'une lettre accentuée compte comme la lettre de base');

        foreach (str_split('MOUTACH') as $letter) {
            $last = $this->guess($id, $letter);
        }

        $expected = 100 + 20 * 8 + 5 * 9;
        self::assertSame('won', $last['status']);
        self::assertSame('MOUSTACHES', $last['state']['word']);
        self::assertSame(['points' => $expected, 'best' => $expected, 'isRecord' => true], $last['score']);

        $this->em->clear();
        $scores = $this->em->getRepository(Score::class)->findAll();
        self::assertCount(1, $scores);
        self::assertSame($expected, $scores[0]->getPoints());
        self::assertSame('alice@cat.fun', $scores[0]->getPlayer()->getEmail());
        self::assertNull($scores[0]->getLevel());

        // Partie terminée : plus aucun coup accepté
        $this->guess($id, 'x');
        self::assertResponseStatusCodeSame(409);
    }

    public function testAPenduLossSavesNoScoreAndRevealsTheWord(): void
    {
        $id = $this->start($this->pendu)['id'];
        foreach (str_split('BDFGIJKLP') as $letter) {
            $last = $this->guess($id, $letter);
        }

        self::assertSame('lost', $last['status']);
        self::assertSame(0, $last['state']['lives']);
        self::assertSame('MOUSTACHES', $last['state']['word']);
        self::assertNull($last['score']);
        self::assertSame(0, $this->em->getRepository(Score::class)->count([]));
    }

    public function testTheNextGameNeverHasTheSameWord(): void
    {
        $first = $this->start($this->pendu)['id'];
        foreach (str_split('MOUSTACHE') as $letter) {
            $won = $this->guess($first, $letter);
        }
        self::assertSame('MOUSTACHES', $won['state']['word']);

        $second = $this->start($this->pendu)['id'];
        foreach (str_split('BDFGIJKLP') as $letter) {
            $lost = $this->guess($second, $letter);
        }
        self::assertSame('RONRONNEMENT', $lost['state']['word']);
    }

    public function testARecordIsOnlyAnnouncedWhenItIsBeaten(): void
    {
        $this->addScore($this->alice, $this->pendu, 9999);
        $id = $this->start($this->pendu)['id'];
        foreach (str_split('MOUSTACHE') as $letter) {
            $won = $this->guess($id, $letter);
        }

        self::assertSame(['points' => 325, 'best' => 9999, 'isRecord' => false], $won['score']);
    }

    // --- Mémoire -----------------------------------------------------------

    public function testAMemoireGameRevealsOnlyTheFlippedCards(): void
    {
        $id = $this->start($this->memoire, 'facile')['id'];

        $first = $this->flip($id, 0);
        self::assertSame('first', $first['result']);
        self::assertSame(['emoji' => '😺', 'label' => 'chat souriant'], $first['state']['cards'][0]['symbol']);
        self::assertCount(11, array_filter($first['state']['cards'], static fn ($c) => null === $c['symbol']));

        $mismatch = $this->flip($id, 2);
        self::assertSame('mismatch', $mismatch['result']);
        self::assertSame(1, $mismatch['state']['mistakes']);

        // La carte suivante cache les deux cartes différentes
        $next = $this->flip($id, 4);
        self::assertNull($next['state']['cards'][0]['symbol']);
        self::assertNull($next['state']['cards'][2]['symbol']);

        $match = $this->flip($id, 5);
        self::assertSame('match', $match['result']);
        self::assertTrue($match['state']['cards'][4]['matched']);
        self::assertSame('ignored', $this->flip($id, 4)['result'], 'carte déjà trouvée');
        self::assertSame('ignored', $this->flip($id, 99)['result'], 'carte inexistante');
    }

    public function testAMemoireWinIsScoredWithItsLevel(): void
    {
        $id = $this->start($this->memoire, 'facile')['id'];
        $this->flip($id, 0);
        $this->flip($id, 2); // une erreur
        for ($i = 0; $i < 12; $i += 2) {
            $this->flip($id, $i);
            $last = $this->flip($id, $i + 1);
        }

        self::assertSame('won', $last['status']);
        self::assertSame(['points' => 300 + 300 - 10, 'best' => 590, 'isRecord' => true], $last['score']);

        $this->em->clear();
        $score = $this->em->getRepository(Score::class)->findAll()[0];
        self::assertSame(590, $score->getPoints());
        self::assertSame('facile', $score->getLevel());
    }

    // --- Sécurité ----------------------------------------------------------

    public function testAnotherPlayersGameCannotBeSeenOrPlayed(): void
    {
        $id = $this->start($this->pendu)['id'];
        $bob = $this->createUser('bob@cat.fun');

        $this->requestJson('GET', "/api/sessions/$id", as: $bob);
        self::assertResponseStatusCodeSame(404);

        $this->guess($id, 'm', $bob);
        self::assertResponseStatusCodeSame(404);

        // Ni par un visiteur
        $this->requestJson('GET', "/api/sessions/$id");
        self::assertResponseStatusCodeSame(404);
        $this->requestJson('POST', "/api/sessions/$id/guess", ['letter' => 'm']);
        self::assertResponseStatusCodeSame(404);
    }

    public function testAGameCanBeResumedWithoutLeakingTheWord(): void
    {
        $id = $this->start($this->pendu)['id'];
        $this->guess($id, 's');

        $data = $this->requestJson('GET', "/api/sessions/$id", as: $this->alice);

        self::assertResponseIsSuccessful();
        self::assertSame(['S'], $data['state']['guessed']);
        self::assertStringNotContainsString('MOUSTACHES', $this->rawResponse());
    }

    public function testAMoveMustMatchTheGame(): void
    {
        $pendu = $this->start($this->pendu)['id'];
        $this->flip($pendu, 0);
        self::assertResponseStatusCodeSame(400);

        $memoire = $this->start($this->memoire, 'facile')['id'];
        $this->guess($memoire, 'a');
        self::assertResponseStatusCodeSame(400);
    }

    /**
     * @dataProvider invalidMoveProvider
     */
    public function testInvalidMovesAreRefused(string $action, array|string $body, int $status): void
    {
        $id = $this->start('flip' === $action ? $this->memoire : $this->pendu, 'flip' === $action ? 'facile' : null)['id'];

        $this->requestJson('POST', "/api/sessions/$id/$action", $body, $this->alice);

        self::assertResponseStatusCodeSame($status);
    }

    public static function invalidMoveProvider(): iterable
    {
        yield 'lettre manquante' => ['guess', [], 422];
        yield 'lettre qui n’est pas du texte' => ['guess', ['letter' => 5], 422];
        yield 'JSON invalide' => ['guess', '{pas du json', 400];
        yield 'carte manquante' => ['flip', [], 422];
        yield 'carte qui n’est pas un entier' => ['flip', ['index' => '3'], 422];
    }

    public function testAnUnknownSessionDoesNotExist(): void
    {
        $this->guess(str_repeat('a', 32), 'm');
        self::assertResponseStatusCodeSame(404);

        $this->requestJson('GET', '/api/sessions/pas-un-identifiant', as: $this->alice);
        self::assertResponseStatusCodeSame(404);
    }
}
