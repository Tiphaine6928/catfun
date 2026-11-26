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

    public function testALoginIsRecordedAndCancelsAnInactivityWarning(): void
    {
        // Compte inactif depuis longtemps, déjà prévenu de sa suppression
        $this->em->getConnection()->executeStatement(
            'UPDATE user SET last_login_at = ?, inactivity_notice_sent_at = ?',
            [(new \DateTimeImmutable('-3 years'))->format('Y-m-d H:i:s'), (new \DateTimeImmutable('-1 day'))->format('Y-m-d H:i:s')],
        );
        $this->em->clear(); // la requête relit le compte en base

        $this->requestJson('POST', '/api/login', ['email' => self::EMAIL, 'password' => self::PASSWORD]);
        self::assertResponseIsSuccessful();

        $row = $this->em->getConnection()->fetchAssociative('SELECT last_login_at, inactivity_notice_sent_at FROM user');
        self::assertGreaterThan(new \DateTimeImmutable('-1 minute'), new \DateTimeImmutable($row['last_login_at']));
        self::assertNull($row['inactivity_notice_sent_at']);
    }

    public function testAFailedLoginIsNotRecorded(): void
    {
        $longAgo = (new \DateTimeImmutable('-1 year'))->format('Y-m-d H:i:s');
        $this->em->getConnection()->executeStatement('UPDATE user SET last_login_at = ?', [$longAgo]);

        $this->requestJson('POST', '/api/login', ['email' => self::EMAIL, 'password' => 'mauvais']);

        self::assertSame($longAgo, $this->em->getConnection()->fetchOne('SELECT last_login_at FROM user'));
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
