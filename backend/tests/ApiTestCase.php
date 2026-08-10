namespace App\Tests;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

abstract class ApiTestCase extends WebTestCase
{
    protected $client;

    protected function setUp(): void
    {
        $this->client = static::createClient();
    }

    protected function login(): string
    {
        $this->client->jsonRequest('POST', '/api/login', [
            'email' => 'test@test.com',
            'password' => 'password'
        ]);

        $this->assertResponseIsSuccessful();

        $data = json_decode($this->client->getResponse()->getContent(), true);

        return $data['token'] ?? '';
    }

    protected function auth(): void
    {
        $token = $this->login();

        $this->client->setServerParameter(
            'HTTP_AUTHORIZATION',
            'Bearer ' . $token
        );
    }
}