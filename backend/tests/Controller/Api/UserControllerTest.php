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
}
