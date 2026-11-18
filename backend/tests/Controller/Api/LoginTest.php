<?php

namespace App\Tests\Controller\Api;

use App\Entity\User;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

/**
 * Connexion à l'API : POST /api/login (json_login + LexikJWT).
 */
final class LoginTest extends ApiTestCase
{
    private const EMAIL = 'felix@cat.fun';
    private const PASSWORD = 'miaou123';

    protected function setUp(): void
    {
        parent::setUp();

        $user = (new User())->setEmail(self::EMAIL)->setPseudo('Félix');
        $user->setPassword(static::getContainer()->get(UserPasswordHasherInterface::class)->hashPassword($user, self::PASSWORD));
        $this->em->persist($user);
        $this->em->flush();
    }

    public function testValidCredentialsReturnAWorkingToken(): void
    {
        $data = $this->requestJson('POST', '/api/login', ['email' => self::EMAIL, 'password' => self::PASSWORD]);

        self::assertResponseIsSuccessful();
        self::assertNotEmpty($data['token']);

        $this->client->request('GET', '/api/me', [], [], ['HTTP_AUTHORIZATION' => 'Bearer '.$data['token']]);
        self::assertResponseIsSuccessful();
        self::assertSame('Félix', json_decode((string) $this->client->getResponse()->getContent(), true)['pseudo']);
    }

    public function testTheEmailIsNotCaseSensitive(): void
    {
        $this->requestJson('POST', '/api/login', ['email' => strtoupper(self::EMAIL), 'password' => self::PASSWORD]);

        self::assertResponseIsSuccessful();
    }

    public function testAWrongPasswordIsRefusedWithAFrenchMessage(): void
    {
        $data = $this->requestJson('POST', '/api/login', ['email' => self::EMAIL, 'password' => 'mauvais']);

        self::assertResponseStatusCodeSame(401);
        self::assertSame('Email ou mot de passe incorrect.', $data['message']);
        self::assertArrayNotHasKey('token', $data);
    }

    public function testAnUnknownEmailGetsTheSameAnswerAsAWrongPassword(): void
    {
        // Même réponse : on ne révèle pas si un compte existe pour cet email
        $unknown = $this->requestJson('POST', '/api/login', ['email' => 'inconnu@cat.fun', 'password' => self::PASSWORD]);
        $unknownStatus = $this->client->getResponse()->getStatusCode();
        $wrong = $this->requestJson('POST', '/api/login', ['email' => self::EMAIL, 'password' => 'mauvais']);

        self::assertSame(401, $unknownStatus);
        self::assertSame($wrong, $unknown);
    }

    /**
     * @dataProvider malformedProvider
     */
    public function testMalformedRequestsAreRefused(string $body): void
    {
        $this->requestJson('POST', '/api/login', $body);

        $status = $this->client->getResponse()->getStatusCode();
        self::assertContains($status, [400, 401], "statut reçu : $status");
        self::assertStringNotContainsString('token', (string) $this->client->getResponse()->getContent());
    }

    public static function malformedProvider(): iterable
    {
        yield 'JSON invalide' => ['{pas du json'];
        yield 'email manquant' => ['{"password": "miaou123"}'];
        yield 'mot de passe manquant' => ['{"email": "felix@cat.fun"}'];
        yield 'email vide' => ['{"email": "", "password": "miaou123"}'];
        yield 'email qui n’est pas du texte' => ['{"email": 42, "password": "miaou123"}'];
    }

    public function testOnlyPostIsAllowed(): void
    {
        $this->client->request('GET', '/api/login');

        self::assertResponseStatusCodeSame(405);
    }
}
