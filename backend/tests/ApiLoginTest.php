<?php

namespace App\Tests;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class ApiLoginTest extends WebTestCase
{
    public function testLoginInvalid(): void
    {
        $client = static::createClient();

        $client->request(
            'POST',
            '/api/login',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'email' => 'inexistant@test.fr',
                'password' => 'mauvaismotdepasse'
            ])
        );

        $this->assertResponseStatusCodeSame(401);
    }
}