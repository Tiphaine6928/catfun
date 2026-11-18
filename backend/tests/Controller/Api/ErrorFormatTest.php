<?php

namespace App\Tests\Controller\Api;

/**
 * Les erreurs de l'API doivent rester en JSON (format "problem details"), jamais en page HTML :
 * le frontend lit ces réponses. Symfony s'appuie pour cela sur symfony/serializer.
 */
final class ErrorFormatTest extends ApiTestCase
{
    /**
     * @dataProvider errorProvider
     */
    public function testApiErrorsAreJson(string $method, string $uri, ?string $body, int $status): void
    {
        $data = $this->requestJson($method, $uri, $body);

        self::assertResponseStatusCodeSame($status);
        self::assertStringContainsString('json', (string) $this->client->getResponse()->headers->get('Content-Type'));
        self::assertIsArray($data, 'le corps de la réponse doit être du JSON');
    }

    public static function errorProvider(): iterable
    {
        yield 'route inconnue' => ['GET', '/api/nimporte', null, 404];
        yield 'méthode non autorisée' => ['DELETE', '/api/games', null, 405];
        yield 'connexion sans email' => ['POST', '/api/login', '{"password": "miaou123"}', 400];
        yield 'connexion avec du JSON invalide' => ['POST', '/api/login', '{pas du json', 400];
        yield 'jeton absent' => ['GET', '/api/me', null, 401];
    }

    public function testTheErrorExplainsWhatIsWrong(): void
    {
        $data = $this->requestJson('POST', '/api/login', '{"password": "miaou123"}');

        self::assertSame(400, $data['status']);
        self::assertStringContainsString('email', $data['detail']);
    }
}
