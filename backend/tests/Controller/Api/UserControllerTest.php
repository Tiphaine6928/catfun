<?php

namespace App\Tests\Controller\Api;

final class UserControllerTest extends ApiTestCase
{
    public function testMeRequiresAToken(): void
    {
        $this->requestJson('GET', '/api/me');

        self::assertResponseStatusCodeSame(401);
    }

    public function testMeReturnsTheConnectedUser(): void
    {
        $user = $this->createUser('alice@cat.fun', 'Alice_99');

        $data = $this->requestJson('GET', '/api/me', as: $user);

        self::assertResponseIsSuccessful();
        self::assertSame('alice@cat.fun', $data['user']);
        self::assertSame('Alice_99', $data['pseudo']);
    }

    public function testUpdatePseudo(): void
    {
        $user = $this->createUser('alice@cat.fun', 'joueur_1');

        $data = $this->requestJson('PATCH', '/api/me', ['pseudo' => '  Félix-le-Chat  '], $user);

        self::assertResponseIsSuccessful();
        self::assertSame('Félix-le-Chat', $data['pseudo']);
        self::assertSame('Félix-le-Chat', $this->reloadPseudo($user));

        // Le nouveau pseudo est renvoyé ensuite par GET /api/me
        $data = $this->requestJson('GET', '/api/me', as: $user);
        self::assertSame('Félix-le-Chat', $data['pseudo']);
    }

    public function testUpdatePseudoIsShownInTheLeaderboard(): void
    {
        $user = $this->createUser('alice@cat.fun', 'joueur_1');
        $game = $this->createGame('Pendu');
        $this->addScore($user, $game, 10);

        $this->requestJson('PATCH', '/api/me', ['pseudo' => 'Minou'], $user);
        $data = $this->requestJson('GET', '/api/games/'.$game->getId().'/leaderboard');

        self::assertSame('Minou', $data['scores'][0]['player']);
    }

    public function testUpdatePseudoCanChangeOnlyTheCaseOfMyOwnPseudo(): void
    {
        $user = $this->createUser('alice@cat.fun', 'minou');

        $data = $this->requestJson('PATCH', '/api/me', ['pseudo' => 'Minou'], $user);

        self::assertResponseIsSuccessful();
        self::assertSame('Minou', $data['pseudo']);
    }

    public function testUpdatePseudoRejectsAPseudoTakenByAnotherUser(): void
    {
        $this->createUser('bob@cat.fun', 'Minou');
        $alice = $this->createUser('alice@cat.fun', 'alice');

        $data = $this->requestJson('PATCH', '/api/me', ['pseudo' => 'MINOU'], $alice);

        self::assertResponseStatusCodeSame(422);
        self::assertSame('Ce pseudo est déjà pris.', $data['errors']['pseudo']);
        self::assertSame('alice', $this->reloadPseudo($alice));
    }

    /**
     * @dataProvider invalidUpdateProvider
     */
    public function testUpdatePseudoRejectsInvalidData(array|string $body, int $status, array $fields): void
    {
        $user = $this->createUser('alice@cat.fun', 'alice');

        $data = $this->requestJson('PATCH', '/api/me', $body, $user);

        self::assertResponseStatusCodeSame($status);
        foreach ($fields as $field) {
            self::assertArrayHasKey($field, $data['errors']);
        }
        self::assertSame('alice', $this->reloadPseudo($user));
    }

    public static function invalidUpdateProvider(): iterable
    {
        yield 'JSON invalide' => ['{pas du json', 400, []];
        yield 'tableau JSON' => ['["Minou"]', 400, []];
        yield 'objet vide' => [[], 422, ['pseudo']];
        yield 'pseudo pas une chaîne' => [['pseudo' => 42], 422, ['pseudo']];
        yield 'pseudo trop court' => [['pseudo' => 'ab'], 422, ['pseudo']];
        yield 'pseudo avec espace' => [['pseudo' => 'Minou 69'], 422, ['pseudo']];
        yield 'pseudo vide' => [['pseudo' => '   '], 422, ['pseudo']];
        yield 'champ non modifiable' => [['pseudo' => 'Minou', 'email' => 'pirate@cat.fun'], 422, ['email']];
        yield 'rôles non modifiables' => [['pseudo' => 'Minou', 'roles' => ['ROLE_ADMIN']], 422, ['roles']];
    }

    public function testUpdatePseudoRequiresAToken(): void
    {
        $this->requestJson('PATCH', '/api/me', ['pseudo' => 'Minou']);

        self::assertResponseStatusCodeSame(401);
    }

    private function reloadPseudo(\App\Entity\User $user): ?string
    {
        $this->em->clear();

        return $this->em->find(\App\Entity\User::class, $user->getId())?->getPseudo();
    }
}
