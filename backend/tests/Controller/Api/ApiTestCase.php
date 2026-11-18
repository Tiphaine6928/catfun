<?php

namespace App\Tests\Controller\Api;

use App\Entity\Game;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Base des tests de l'API : base de test vidée avant chaque test
 * et helpers pour créer des données et appeler l'API avec un token JWT.
 */
abstract class ApiTestCase extends WebTestCase
{
    protected KernelBrowser $client;
    protected EntityManagerInterface $em;

    protected function setUp(): void
    {
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);

        $connection = $this->em->getConnection();
        foreach (['score', 'game', 'user'] as $table) {
            $connection->executeStatement(sprintf('DELETE FROM `%s`', $table));
        }
    }

    protected function createUser(string $email): User
    {
        $user = (new User())->setEmail($email);
        $user->setPassword('not-used-in-api-tests');
        $this->em->persist($user);
        $this->em->flush();

        return $user;
    }

    protected function createGame(string $name): Game
    {
        $game = (new Game())->setName($name)->setDescription('Jeu '.$name);
        $this->em->persist($game);
        $this->em->flush();

        return $game;
    }

    /**
     * @param array<mixed>|string|null $body
     */
    protected function requestJson(string $method, string $uri, array|string|null $body = null, ?User $as = null): mixed
    {
        $headers = ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'];
        if (null !== $as) {
            $token = static::getContainer()->get(JWTTokenManagerInterface::class)->create($as);
            $headers['HTTP_AUTHORIZATION'] = 'Bearer '.$token;
        }

        $content = \is_array($body) ? json_encode($body, \JSON_THROW_ON_ERROR) : $body;
        $this->client->request($method, $uri, [], [], $headers, $content);

        return json_decode((string) $this->client->getResponse()->getContent(), true);
    }
}
