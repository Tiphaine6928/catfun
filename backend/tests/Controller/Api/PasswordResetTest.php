<?php

namespace App\Tests\Controller\Api;

use App\Controller\Api\PasswordResetController;
use App\Entity\User;
use Symfony\Component\Mime\Email;

/**
 * « Mot de passe oublié » : lien envoyé par email, puis nouveau mot de passe.
 * En test, les emails ne partent pas (MAILER_DSN=null://null) mais sont inspectables.
 */
final class PasswordResetTest extends ApiTestCase
{
    private User $alice;

    protected function setUp(): void
    {
        parent::setUp();
        $this->alice = $this->createUser('alice@cat.fun');
    }

    private function forgot(string $email): mixed
    {
        return $this->requestJson('POST', '/api/password/forgot', ['email' => $email]);
    }

    private function reset(string $token, string $password): mixed
    {
        return $this->requestJson('POST', '/api/password/reset', ['token' => $token, 'password' => $password]);
    }

    /** Jeton contenu dans le lien du dernier email envoyé. */
    private function tokenFromLastEmail(): string
    {
        $email = self::getMailerMessage();
        self::assertInstanceOf(Email::class, $email);
        self::assertSame(1, preg_match('~/#/nouveau-mot-de-passe\?token=([0-9a-f]{64})~', (string) $email->getTextBody(), $matches));

        return $matches[1];
    }

    private function login(string $password): int
    {
        $this->requestJson('POST', '/api/login', ['email' => 'alice@cat.fun', 'password' => $password]);

        return $this->client->getResponse()->getStatusCode();
    }

    public function testALinkIsSentAndLetsTheUserChooseANewPassword(): void
    {
        $response = $this->forgot('ALICE@cat.fun');

        self::assertResponseStatusCodeSame(202);
        self::assertSame(PasswordResetController::SENT_MESSAGE, $response['message']);
        self::assertEmailCount(1);
        $email = self::getMailerMessage();
        self::assertEmailAddressContains($email, 'To', 'alice@cat.fun');
        self::assertEmailHeaderSame($email, 'Subject', 'CatFun : choisis un nouveau mot de passe');
        self::assertEmailTextBodyContains($email, 'Bonjour alice');
        self::assertEmailHtmlBodyContains($email, 'Choisir un nouveau mot de passe');
        self::assertEmailTextBodyContains($email, 'http://localhost:8081/#/nouveau-mot-de-passe?token=');

        $token = $this->tokenFromLastEmail();
        $this->reset($token, 'nouveau-miaou');
        self::assertResponseIsSuccessful();

        self::assertSame(200, $this->login('nouveau-miaou'));

        // Le lien ne sert qu'une fois
        $again = $this->reset($token, 'encore-autre');
        self::assertResponseStatusCodeSame(410);
        self::assertStringContainsString('plus valable', $again['message']);
    }

    public function testTheTokenIsNotStoredInClear(): void
    {
        $this->forgot('alice@cat.fun');
        $token = $this->tokenFromLastEmail();

        $stored = $this->em->getConnection()->fetchOne('SELECT token_hash FROM reset_password_request');
        self::assertSame(hash('sha256', $token), $stored);
    }

    public function testAnUnknownEmailGetsTheSameAnswerAndNoEmail(): void
    {
        $response = $this->forgot('personne@cat.fun');

        self::assertResponseStatusCodeSame(202);
        self::assertSame(PasswordResetController::SENT_MESSAGE, $response['message']);
        self::assertEmailCount(0);
    }

    public function testAnExpiredLinkIsRefused(): void
    {
        $this->forgot('alice@cat.fun');
        $token = $this->tokenFromLastEmail();
        $this->em->getConnection()->executeStatement('UPDATE reset_password_request SET expires_at = ?', [(new \DateTimeImmutable('-1 minute'))->format('Y-m-d H:i:s')]);

        $this->reset($token, 'nouveau-miaou');

        self::assertResponseStatusCodeSame(410);
        self::assertSame(401, $this->login('nouveau-miaou'));
    }

    public function testANewRequestCancelsThePreviousLink(): void
    {
        $this->forgot('alice@cat.fun');
        $first = $this->tokenFromLastEmail();
        $this->forgot('alice@cat.fun');
        $second = $this->tokenFromLastEmail();

        $this->reset($first, 'nouveau-miaou');
        self::assertResponseStatusCodeSame(410);

        $this->reset($second, 'nouveau-miaou');
        self::assertResponseIsSuccessful();
    }

    public function testTheNewPasswordFollowsTheRegistrationRules(): void
    {
        $this->forgot('alice@cat.fun');
        $token = $this->tokenFromLastEmail();

        $response = $this->reset($token, '123');
        self::assertResponseStatusCodeSame(422);
        self::assertSame('Le mot de passe doit faire au moins 6 caractères.', $response['errors']['password']);

        // Le lien reste valable après une erreur de saisie
        $this->reset($token, 'nouveau-miaou');
        self::assertResponseIsSuccessful();
    }

    /**
     * @dataProvider invalidRequestProvider
     */
    public function testInvalidRequestsAreRefused(string $uri, array|string $body, int $status): void
    {
        $this->requestJson('POST', $uri, $body);

        self::assertResponseStatusCodeSame($status);
    }

    public static function invalidRequestProvider(): iterable
    {
        yield 'email manquant' => ['/api/password/forgot', [], 422];
        yield 'email vide' => ['/api/password/forgot', ['email' => ' '], 422];
        yield 'JSON invalide' => ['/api/password/forgot', '{pas du json', 400];
        yield 'jeton inconnu' => ['/api/password/reset', ['token' => str_repeat('a', 64), 'password' => 'nouveau-miaou'], 410];
        yield 'jeton mal formé' => ['/api/password/reset', ['token' => 'abc', 'password' => 'nouveau-miaou'], 410];
        yield 'mot de passe manquant' => ['/api/password/reset', ['token' => str_repeat('a', 64)], 422];
    }

    public function testAnAccountReceivesAtMostThreeEmailsPerHour(): void
    {
        for ($i = 0; $i < 3; ++$i) {
            $this->forgot('alice@cat.fun');
            self::assertEmailCount(1);
        }

        // La 4e demande reçoit la même réponse, mais aucun email ne part
        $this->forgot('alice@cat.fun');
        self::assertResponseStatusCodeSame(202);
        self::assertEmailCount(0);
    }

    public function testRequestsAreLimitedPerIpAddress(): void
    {
        // PASSWORD_RESET_MAX_PER_HOUR=10 (.env)
        for ($i = 0; $i < 10; ++$i) {
            $this->forgot("chat$i@cat.fun");
            self::assertResponseStatusCodeSame(202);
        }

        $response = $this->forgot('alice@cat.fun');
        self::assertResponseStatusCodeSame(429);
        self::assertStringContainsString('Trop de demandes', $response['message']);
        self::assertEmailCount(0);
    }
}
