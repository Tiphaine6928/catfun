<?php

namespace App\Tests\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class UserControllerTest extends WebTestCase
{
    public function testIndex(): void
    {
        $client = static::createClient();

        $client->request(
            'POST',
            '/api/login_check',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'email' => 'test@test.com',
                'password' => 'password',
            ])
        );

        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('token', $data);
        fwrite(STDERR, static::class . " TOKEN: " . $data['token'] . "\n");

        $client->setServerParameter(
            'HTTP_Authorization',
            'Bearer '.$data['token']
        );

        $client->request('GET', '/api/me');

        self::assertResponseIsSuccessful();
    }
}
