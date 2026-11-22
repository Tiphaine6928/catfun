<?php

namespace App\Tests\Controller\Api;

use App\Entity\User;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

/**
 * Limites de tentatives : connexion (login_throttling) et inscription (rate limiter "registration"),
 * avec les seuils par défaut de .env (10 inscriptions par heure, 5 connexions par compte et 25 par adresse IP
 * par quart d'heure). Les compteurs sont vidés avant chaque test (voir ApiTestCase).
 */
final class RateLimitTest extends ApiTestCase
{
    private const PASSWORD = 'miaou123';

    private function createUserWithPassword(string $email): User
    {
        $user = $this->createUser($email);
        $user->setPassword(static::getContainer()->get(UserPasswordHasherInterface::class)->hashPassword($user, self::PASSWORD));
        $this->em->flush();

        return $user;
    }

    private function login(string $email, string $password, string $ip = '127.0.0.1'): int
    {
        $this->client->request('POST', '/api/login', [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
            'REMOTE_ADDR' => $ip,
        ], json_encode(['email' => $email, 'password' => $password], \JSON_THROW_ON_ERROR));

        return $this->client->getResponse()->getStatusCode();
    }

    private function register(array $body, string $ip = '127.0.0.1'): int
    {
        $this->client->request('POST', '/api/register', [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
            'REMOTE_ADDR' => $ip,
        ], json_encode($body, \JSON_THROW_ON_ERROR));

        return $this->client->getResponse()->getStatusCode();
    }

    private function responseJson(): array
    {
        return json_decode((string) $this->client->getResponse()->getContent(), true);
    }

    // --- Connexion ---------------------------------------------------------

    public function testLoginIsBlockedAfterFiveFailedAttempts(): void
    {
        $this->createUserWithPassword('alice@cat.fun');

        for ($i = 1; $i <= 5; ++$i) {
            self::assertSame(401, $this->login('alice@cat.fun', 'mauvais'), "tentative $i");
        }

        self::assertSame(429, $this->login('alice@cat.fun', 'mauvais'));
        // Durée restante arrondie à la minute supérieure : 15 ou 16 minutes selon les secondes écoulées
        $message = $this->responseJson()['message'];
        self::assertMatchesRegularExpression('/^Trop de tentatives de connexion\. Réessaie dans (\d+) minutes\.$/', $message);
        preg_match('/(\d+) minutes/', $message, $m);
        self::assertContains((int) $m[1], [15, 16]);
        self::assertSame((string) ($m[1] * 60), $this->client->getResponse()->headers->get('Retry-After'));

        // Même le bon mot de passe est refusé pendant le blocage
        self::assertSame(429, $this->login('alice@cat.fun', self::PASSWORD));
        self::assertArrayNotHasKey('token', $this->responseJson());
    }

    public function testTheBlockIsPerEmailAndIpAddress(): void
    {
        $this->createUserWithPassword('alice@cat.fun');
        $this->createUserWithPassword('bob@cat.fun');
        for ($i = 1; $i <= 6; ++$i) {
            $this->login('alice@cat.fun', 'mauvais');
        }
        self::assertSame(429, $this->login('alice@cat.fun', self::PASSWORD));

        // Un autre compte depuis la même adresse, ou le même compte depuis une autre adresse : pas bloqués
        self::assertSame(200, $this->login('bob@cat.fun', self::PASSWORD));
        self::assertSame(200, $this->login('alice@cat.fun', self::PASSWORD, '203.0.113.7'));
    }

    public function testOnlyFailedAttemptsCount(): void
    {
        // Comportement de Symfony : une connexion réussie ne consomme pas de tentative,
        // mais n'efface pas les échecs précédents (ils expirent avec la fenêtre de 15 minutes).
        $this->createUserWithPassword('alice@cat.fun');
        for ($i = 1; $i <= 4; ++$i) {
            self::assertSame(401, $this->login('alice@cat.fun', 'mauvais'));
        }
        for ($i = 1; $i <= 10; ++$i) {
            self::assertSame(200, $this->login('alice@cat.fun', self::PASSWORD), "connexion réussie $i");
        }

        self::assertSame(401, $this->login('alice@cat.fun', 'mauvais'), '5e échec');
        self::assertSame(429, $this->login('alice@cat.fun', 'mauvais'), '6e échec');
    }

    public function testManyEmailsFromTheSameAddressAreBlockedToo(): void
    {
        // Un robot qui essaie un mot de passe sur beaucoup de comptes : limite globale par adresse IP
        $statuses = [];
        for ($i = 1; $i <= 26; ++$i) {
            $statuses[] = $this->login("inconnu$i@cat.fun", 'mauvais', '198.51.100.9');
        }

        self::assertSame(array_fill(0, 25, 401), \array_slice($statuses, 0, 25));
        self::assertSame(429, $statuses[25]);
    }

    // --- Inscription -------------------------------------------------------

    public function testRegistrationIsLimitedToTenAttemptsPerHourAndAddress(): void
    {
        // Les tentatives refusées comptent aussi
        for ($i = 1; $i <= 5; ++$i) {
            self::assertSame(422, $this->register(['email' => 'toto']), "tentative refusée $i");
        }
        for ($i = 1; $i <= 5; ++$i) {
            self::assertSame(201, $this->register(['email' => "chat$i@cat.fun", 'pseudo' => "Chat$i", 'password' => self::PASSWORD]), "inscription $i");
        }

        self::assertSame(429, $this->register(['email' => 'chat11@cat.fun', 'pseudo' => 'Chat11', 'password' => self::PASSWORD]));
        self::assertStringStartsWith('Trop de tentatives d\'inscription. Réessaie dans ', $this->responseJson()['message']);
        self::assertGreaterThan(0, (int) $this->client->getResponse()->headers->get('Retry-After'));
        self::assertNull($this->em->getRepository(User::class)->findOneBy(['email' => 'chat11@cat.fun']), 'aucun compte créé');

        // Une autre adresse IP peut toujours s'inscrire
        self::assertSame(201, $this->register(['email' => 'autre@cat.fun', 'pseudo' => 'Autre', 'password' => self::PASSWORD], '203.0.113.7'));
    }
}
