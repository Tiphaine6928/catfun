<?php

namespace App\Tests\Controller\Api;

use App\Entity\Game;
use App\Entity\GameSession;
use App\Entity\Score;
use App\Entity\User;

/**
 * Jouer sans compte : la partie se joue normalement, mais le score n'est enregistré
 * que si le visiteur s'inscrit ou se connecte peu après (POST /api/sessions/{id}/claim).
 * En test, le premier mot du Pendu est MOUSTACHES, puis RONRONNEMENT.
 */
final class GuestPlayTest extends ApiTestCase
{
    /** MOUSTACHES trouvé sans erreur : 100 + 20 × 9 vies + 5 × 9 lettres différentes. */
    private const WIN_POINTS = 325;

    private Game $pendu;
    private User $alice;

    protected function setUp(): void
    {
        parent::setUp();
        $this->pendu = $this->createGame('Pendu');
        $this->alice = $this->createUser('alice@cat.fun');
    }

    /**
     * @param array<string, mixed> $body
     */
    private function startAsGuest(array $body = []): mixed
    {
        return $this->requestJson('POST', '/api/games/'.$this->pendu->getId().'/sessions', $body);
    }

    private function play(string $id, string $letters, ?User $as = null): mixed
    {
        foreach (str_split($letters) as $letter) {
            $last = $this->requestJson('POST', "/api/sessions/$id/guess", ['letter' => $letter], $as);
        }

        return $last ?? null;
    }

    private function claim(string $id, ?User $as): mixed
    {
        return $this->requestJson('POST', "/api/sessions/$id/claim", as: $as);
    }

    private function scoreCount(): int
    {
        return $this->em->getRepository(Score::class)->count([]);
    }

    public function testAGuestCanPlayButNoScoreIsSaved(): void
    {
        $start = $this->startAsGuest();
        self::assertResponseStatusCodeSame(201);
        self::assertNull($start['unsavedPoints']);

        $won = $this->play($start['id'], 'MOUSTACHE');

        self::assertSame('won', $won['status']);
        self::assertNull($won['score']);
        self::assertSame(self::WIN_POINTS, $won['unsavedPoints'], 'les points sont annoncés, pas enregistrés');
        self::assertSame(0, $this->scoreCount());

        // La partie peut être reprise sans compte
        $this->requestJson('GET', '/api/sessions/'.$start['id']);
        self::assertResponseIsSuccessful();
    }

    public function testALostGuestGameHasNoPoints(): void
    {
        $lost = $this->play($this->startAsGuest()['id'], 'BDFGIJKLP');

        self::assertSame('lost', $lost['status']);
        self::assertNull($lost['unsavedPoints']);
    }

    public function testTheScoreIsSavedOnceTheGuestLogsIn(): void
    {
        $id = $this->startAsGuest()['id'];
        $this->play($id, 'MOUSTACHE');

        $claimed = $this->claim($id, $this->alice);

        self::assertResponseIsSuccessful();
        self::assertSame(['points' => self::WIN_POINTS, 'best' => self::WIN_POINTS, 'isRecord' => true], $claimed['score']);
        self::assertNull($claimed['unsavedPoints']);

        $this->em->clear();
        $scores = $this->em->getRepository(Score::class)->findAll();
        self::assertCount(1, $scores);
        self::assertSame('alice@cat.fun', $scores[0]->getPlayer()->getEmail());
        self::assertSame(self::WIN_POINTS, $scores[0]->getPoints());

        // La partie appartient maintenant à Alice : plus accessible sans compte
        $this->requestJson('GET', "/api/sessions/$id");
        self::assertResponseStatusCodeSame(404);

        // Renvoyer la demande ne crée pas un second score
        $again = $this->claim($id, $this->alice);
        self::assertResponseIsSuccessful();
        self::assertSame(self::WIN_POINTS, $again['score']['points']);
        self::assertSame(1, $this->scoreCount());

        // Et personne d'autre ne peut la prendre
        $this->claim($id, $this->createUser('bob@cat.fun'));
        self::assertResponseStatusCodeSame(404);
    }

    public function testClaimingAScoreRequiresAnAccount(): void
    {
        $id = $this->startAsGuest()['id'];
        $this->play($id, 'MOUSTACHE');

        $this->claim($id, null);

        self::assertResponseStatusCodeSame(401);
        self::assertSame(0, $this->scoreCount());
    }

    public function testOnlyAWonGuestGameCanBeClaimed(): void
    {
        $unfinished = $this->startAsGuest()['id'];
        $this->claim($unfinished, $this->alice);
        self::assertResponseStatusCodeSame(409);

        $lost = $this->startAsGuest(['previous' => $unfinished])['id'];
        $this->play($lost, 'BDFGIJKLP');
        $this->claim($lost, $this->alice);
        self::assertResponseStatusCodeSame(409);

        $this->claim(str_repeat('a', 32), $this->alice);
        self::assertResponseStatusCodeSame(404);

        self::assertSame(0, $this->scoreCount());
    }

    public function testAnOldGuestGameCanNoLongerBeClaimed(): void
    {
        $id = $this->startAsGuest()['id'];
        $this->play($id, 'MOUSTACHE');
        $this->em->getConnection()->executeStatement(
            'UPDATE game_session SET finished_at = ? WHERE id = ?',
            [(new \DateTimeImmutable('-'.GameSession::CLAIM_DELAY.' -1 minute'))->format('Y-m-d H:i:s'), $id],
        );

        $old = $this->requestJson('GET', "/api/sessions/$id");
        self::assertNull($old['unsavedPoints']);

        $response = $this->claim($id, $this->alice);
        self::assertResponseStatusCodeSame(409);
        self::assertStringContainsString('trop ancienne', $response['message']);
        self::assertSame(0, $this->scoreCount());
    }

    public function testTheNextGuestGameNeverHasTheSameWord(): void
    {
        $first = $this->startAsGuest()['id'];
        self::assertSame('MOUSTACHES', $this->play($first, 'BDFGIJKLP')['state']['word']);

        $second = $this->startAsGuest(['previous' => $first])['id'];
        self::assertSame('RONRONNEMENT', $this->play($second, 'BDFGIJKLP')['state']['word']);
    }

    public function testAGuestCannotUseAnotherPlayersGameAsPrevious(): void
    {
        $alicesGame = $this->requestJson('POST', '/api/games/'.$this->pendu->getId().'/sessions', as: $this->alice)['id'];

        $guest = $this->startAsGuest(['previous' => $alicesGame]);
        self::assertResponseStatusCodeSame(201);
        self::assertSame('MOUSTACHES', $this->play($guest['id'], 'BDFGIJKLP')['state']['word'], 'la partie d’Alice est ignorée');

        $this->startAsGuest(['previous' => 'pas-un-identifiant']);
        self::assertResponseStatusCodeSame(422);
    }

    public function testGuestGamesAreLimitedPerIpAddress(): void
    {
        // GUEST_GAMES_MAX_PER_HOUR=20 en test (.env.test)
        for ($i = 0; $i < 20; ++$i) {
            $this->startAsGuest();
            self::assertResponseStatusCodeSame(201);
        }

        $response = $this->startAsGuest();
        self::assertResponseStatusCodeSame(429);
        self::assertStringContainsString('connecte-toi', $response['message']);
        self::assertTrue($this->client->getResponse()->headers->has('Retry-After'));

        // Un joueur connecté n'est pas concerné
        $this->requestJson('POST', '/api/games/'.$this->pendu->getId().'/sessions', as: $this->alice);
        self::assertResponseStatusCodeSame(201);
    }
}
