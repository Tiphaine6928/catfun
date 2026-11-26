<?php

namespace App\Tests\Controller\Api;

use App\Entity\Game;
use App\Entity\GameSession;
use App\Entity\Score;
use App\Entity\User;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

/**
 * Droits RGPD : export des données (GET /api/me/export) et suppression du compte (DELETE /api/me).
 */
final class MyDataTest extends ApiTestCase
{
    private Game $pendu;
    private User $alice;

    protected function setUp(): void
    {
        parent::setUp();
        $this->pendu = $this->createGame('Pendu');
        $this->alice = $this->createUser('alice@cat.fun', 'Alice');
        $hasher = static::getContainer()->get(UserPasswordHasherInterface::class);
        $this->alice->setPassword($hasher->hashPassword($this->alice, 'miaou123'));
        $this->em->flush();
    }

    /** Gagne une partie de Pendu (en test, le premier mot est MOUSTACHES) et en commence une autre. */
    private function playSomeGames(User $player): void
    {
        $id = $this->requestJson('POST', '/api/games/'.$this->pendu->getId().'/sessions', null, $player)['id'];
        foreach (str_split('MOUSTACHE') as $letter) {
            $this->requestJson('POST', "/api/sessions/$id/guess", ['letter' => $letter], $player);
        }
        $this->requestJson('POST', '/api/games/'.$this->pendu->getId().'/sessions', null, $player);
    }

    private function rows(string $entity): int
    {
        return $this->em->getRepository($entity)->count([]);
    }

    public function testTheExportContainsTheAccountScoresAndGames(): void
    {
        $this->playSomeGames($this->alice);

        $this->client->request('GET', '/api/me/export', server: [
            'HTTP_AUTHORIZATION' => 'Bearer '.static::getContainer()->get('lexik_jwt_authentication.jwt_manager')->create($this->alice),
        ]);

        self::assertResponseIsSuccessful();
        $response = $this->client->getResponse();
        self::assertSame('attachment; filename="catfun-mes-donnees.json"', $response->headers->get('Content-Disposition'));
        self::assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));

        $data = json_decode((string) $response->getContent(), true);
        self::assertSame(['email' => 'alice@cat.fun', 'pseudo' => 'Alice'], $data['compte']);
        self::assertCount(1, $data['scores']);
        self::assertSame(['jeu' => 'Pendu', 'niveau' => null, 'points' => 325], array_diff_key($data['scores'][0], ['date' => true]));
        self::assertCount(2, $data['parties']);
        self::assertSame('gagnée', $data['parties'][0]['statut']);
        self::assertSame(325, $data['parties'][0]['points']);
        self::assertSame('en cours', $data['parties'][1]['statut']);
        self::assertNull($data['parties'][1]['terminee_le']);

        // Ni le mot de passe, ni le mot caché d'une partie en cours
        self::assertStringNotContainsString('password', (string) $response->getContent());
        self::assertStringNotContainsString('RONRONNEMENT', (string) $response->getContent());
    }

    public function testTheExportOnlyContainsTheUsersOwnData(): void
    {
        $bob = $this->createUser('bob@cat.fun', 'Bob');
        $this->playSomeGames($bob);

        $data = $this->requestJson('GET', '/api/me/export', as: $this->alice);

        self::assertSame([], $data['scores']);
        self::assertSame([], $data['parties']);
        self::assertStringNotContainsString('bob@cat.fun', (string) $this->client->getResponse()->getContent());
    }

    public function testExportAndDeletionRequireAToken(): void
    {
        $this->requestJson('GET', '/api/me/export');
        self::assertResponseStatusCodeSame(401);

        $this->requestJson('DELETE', '/api/me', ['password' => 'miaou123']);
        self::assertResponseStatusCodeSame(401);
    }

    public function testDeletingTheAccountErasesEverythingLinkedToIt(): void
    {
        $bob = $this->createUser('bob@cat.fun', 'Bob');
        $this->playSomeGames($this->alice);
        $this->playSomeGames($bob);
        $this->requestJson('POST', '/api/password/forgot', ['email' => 'alice@cat.fun']);
        $leaderboard = '/api/games/'.$this->pendu->getId().'/leaderboard';
        self::assertCount(2, $this->requestJson('GET', $leaderboard)['scores']);

        $this->requestJson('DELETE', '/api/me', ['password' => 'miaou123'], $this->alice);

        self::assertResponseStatusCodeSame(204);
        $this->em->clear();
        self::assertNull($this->em->getRepository(User::class)->findOneBy(['email' => 'alice@cat.fun']));
        self::assertSame(1, $this->rows(Score::class), 'seul le score de Bob reste');
        self::assertSame(2, $this->rows(GameSession::class), 'seules les parties de Bob restent');
        self::assertSame(0, (int) $this->em->getConnection()->fetchOne('SELECT COUNT(*) FROM reset_password_request'));

        // Alice disparaît du classement
        $scores = $this->requestJson('GET', $leaderboard)['scores'];
        self::assertSame(['Bob'], array_column($scores, 'player'));

        // Son ancien jeton ne donne plus accès à rien
        $this->requestJson('GET', '/api/me', as: $this->alice);
        self::assertResponseStatusCodeSame(401);
    }

    public function testTheWrongPasswordDeletesNothing(): void
    {
        $response = $this->requestJson('DELETE', '/api/me', ['password' => 'pas-le-bon'], $this->alice);

        self::assertResponseStatusCodeSame(422);
        self::assertSame('Mot de passe incorrect.', $response['errors']['password']);
        $this->em->clear();
        self::assertNotNull($this->em->getRepository(User::class)->findOneBy(['email' => 'alice@cat.fun']));
    }

    public function testThePasswordIsRequired(): void
    {
        $response = $this->requestJson('DELETE', '/api/me', [], $this->alice);

        self::assertResponseStatusCodeSame(422);
        self::assertSame('Merci de saisir ton mot de passe pour confirmer.', $response['errors']['password']);
    }

    public function testPasswordGuessesAreLimited(): void
    {
        for ($i = 0; $i < 5; ++$i) {
            $this->requestJson('DELETE', '/api/me', ['password' => "essai-$i"], $this->alice);
            self::assertResponseStatusCodeSame(422);
        }

        // Même le bon mot de passe est refusé tant que la limite est atteinte
        $this->requestJson('DELETE', '/api/me', ['password' => 'miaou123'], $this->alice);
        self::assertResponseStatusCodeSame(429);
    }
}
