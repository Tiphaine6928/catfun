<?php

namespace App\Tests;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class ApiRegisterTest extends WebTestCase
{
    public function testRegisterSuccess(): void
    {
        $client = static::createClient();

        $client->request(
            'POST',
            '/api/register',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'pseudo' => 'testeur',
                'email' => 'testeur_' . uniqid() . '@test.fr',
                'password' => 'password123'
            ])
        );

        $this->assertResponseStatusCodeSame(201);
    }
}