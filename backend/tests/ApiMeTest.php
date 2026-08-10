<?php

namespace App\Tests;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class ApiMeTest extends WebTestCase
{
    public function testMeWithoutAuthentication(): void
    {
        $client = static::createClient();

        $client->request('GET', '/api/me');

        $this->assertResponseStatusCodeSame(401);
    }

public function testMeWithAuthentication(): void
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

    $response = $client->getResponse();
    $data = json_decode($response->getContent(), true);

    $this->assertArrayHasKey('token', $data);
    fwrite(STDERR, static::class . " TOKEN: " . $data['token'] . "\n");

    $client->setServerParameter(
        'HTTP_Authorization',
        'Bearer '.$data['token']
    );

    $client->request('GET', '/api/me');

    $this->assertResponseIsSuccessful();
}
}