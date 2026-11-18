<?php

namespace App\Tests\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Le backend ne sert que l'API : son adresse racine renvoie vers le site.
 */
final class HomeRedirectTest extends WebTestCase
{
    public function testTheRootRedirectsToTheFrontend(): void
    {
        $client = static::createClient();
        $client->request('GET', '/');

        self::assertResponseRedirects('http://localhost:8081');
    }

    public function testTheOldSymfonyPagesNoLongerExist(): void
    {
        $client = static::createClient();
        foreach (['/login', '/logout', '/register'] as $path) {
            $client->request('GET', $path);
            self::assertResponseStatusCodeSame(404, $path);
        }
    }
}
