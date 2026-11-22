<?php

namespace App\Tests\Controller\Api;

use App\Entity\Game;
use App\Entity\User;

/**
 * Données de la page de profil : GET /api/me/stats et l'historique GET /api/me/scores?limit=…
 */
final class ProfileStatsTest extends ApiTestCase
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

    /** Joue une partie de Pendu jusqu'au bout (en test, le mot est connu d'avance). */
    private function playPendu(string $letters): void
    {
        $id = $this->requestJson('POST', '/api/games/'.$this->pendu->getId().'/sessions', null, $this->alice)['id'];
        foreach (str_split($letters) as $letter) {
            $this->requestJson('POST', "/api/sessions/$id/guess", ['letter' => $letter], $this->alice);
        }
    }

    /** Gagne une partie de Mémoire sans erreur (en test, les paires sont côte à côte). */
    private function winMemoire(string $level, int $cards): void
    {
        $id = $this->requestJson('POST', '/api/games/'.$this->memoire->getId().'/sessions', ['level' => $level], $this->alice)['id'];
        for ($i = 0; $i < $cards; ++$i) {
            $this->requestJson('POST', "/api/sessions/$id/flip", ['index' => $i], $this->alice);
        }
    }

    public function testStatsRequireAToken(): void
    {
        $this->requestJson('GET', '/api/me/stats');

        self::assertResponseStatusCodeSame(401);
    }

    public function testANewPlayerHasNoRecordYet(): void
    {
        $data = $this->requestJson('GET', '/api/me/stats', as: $this->alice);

        self::assertResponseIsSuccessful();
        self::assertSame(['Mémoire', 'Pendu'], array_map(static fn ($g) => $g['game']['name'], $data['games']));
        self::assertSame(
            [['level' => 'facile', 'best' => null], ['level' => 'normal', 'best' => null], ['level' => 'difficile', 'best' => null]],
            $data['games'][0]['records'],
        );
        self::assertSame([['level' => null, 'best' => null]], $data['games'][1]['records']);
        self::assertSame([0, 0], [$data['games'][1]['played'], $data['games'][1]['won']]);
    }

    public function testRecordsAndPlayedGamesAreCounted(): void
    {
        // Scores ajoutés directement en base (avant les requêtes HTTP, qui redémarrent le noyau Symfony)
        $this->addScore($this->alice, $this->memoire, 500, level: 'facile'); // moins bon : ne change pas le record
        $bob = $this->createUser('bob@cat.fun');
        $this->addScore($bob, $this->pendu, 9999);                        // un autre joueur : ne compte pas

        $this->playPendu('MOUSTACHE');            // gagnée : 100 + 20 × 9 + 5 × 9 = 325
        $this->playPendu('BDFGIJKLP');            // perdue (RONRONNEMENT)
        $this->requestJson('POST', '/api/games/'.$this->pendu->getId().'/sessions', null, $this->alice); // abandonnée
        $this->winMemoire('facile', 12);          // gagnée sans erreur : 600

        $data = $this->requestJson('GET', '/api/me/stats', as: $this->alice);
        [$memoire, $pendu] = $data['games'];

        self::assertSame([['level' => null, 'best' => 325]], $pendu['records']);
        self::assertSame(2, $pendu['played'], 'une partie abandonnée ne compte pas');
        self::assertSame(1, $pendu['won']);

        self::assertSame(
            [['level' => 'facile', 'best' => 600], ['level' => 'normal', 'best' => null], ['level' => 'difficile', 'best' => null]],
            $memoire['records'],
        );
        self::assertSame([1, 1], [$memoire['played'], $memoire['won']]);
        self::assertSame(['facile', 'normal', 'difficile'], $memoire['game']['levels']);
    }

    public function testTheHistoryIsNewestFirstAndCanBeLimited(): void
    {
        $this->addScore($this->alice, $this->pendu, 100, '2026-01-01 10:00:00');
        $this->addScore($this->alice, $this->memoire, 600, '2026-01-03 10:00:00', 'facile');
        $this->addScore($this->alice, $this->pendu, 200, '2026-01-02 10:00:00');

        $all = $this->requestJson('GET', '/api/me/scores', as: $this->alice);
        self::assertSame([600, 200, 100], array_column($all, 'points'));
        self::assertSame(['facile', null, null], array_column($all, 'level'));
        self::assertSame('Mémoire', $all[0]['game']['name']);

        $two = $this->requestJson('GET', '/api/me/scores?limit=2', as: $this->alice);
        self::assertSame([600, 200], array_column($two, 'points'));

        foreach (['0', '101', 'abc'] as $limit) {
            $this->requestJson('GET', '/api/me/scores?limit='.$limit, as: $this->alice);
            self::assertResponseStatusCodeSame(400, "limit=$limit");
        }
    }
}
