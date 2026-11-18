<?php

namespace App\Tests;

use App\Repository\UserRepository;
use Doctrine\ORM\EntityManager;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class RegistrationControllerTest extends WebTestCase
{
    private KernelBrowser $client;
    private UserRepository $userRepository;

    protected function setUp(): void
    {
        $this->client = static::createClient();

        // Ensure we have a clean database
        $container = static::getContainer();

        /** @var EntityManager $em */
        $em = $container->get('doctrine')->getManager();
        $this->userRepository = $container->get(UserRepository::class);

        foreach ($this->userRepository->findAll() as $user) {
            $em->remove($user);
        }

        $em->flush();
    }

    public function testRegister(): void
    {
        $this->client->request('GET', '/register');
        self::assertResponseIsSuccessful();
        self::assertPageTitleContains('Register');

        $this->submitRegistration('me@example.com', 'Minou_69');

        self::assertResponseRedirects('/');
        $users = $this->userRepository->findAll();
        self::assertCount(1, $users);
        self::assertSame('Minou_69', $users[0]->getPseudo());

        // L'utilisateur est connecté et son pseudo s'affiche sur l'accueil
        $this->client->followRedirect();
        self::assertSelectorTextContains('body', 'Connecté en tant que Minou_69');
    }

    public function testRegisterRejectsAnInvalidEmail(): void
    {
        $this->client->request('GET', '/register');

        $this->submitRegistration('toto', 'Minou_69');

        self::assertResponseStatusCodeSame(422);
        self::assertSelectorTextContains('body', 'n\'est pas valide');
        self::assertCount(0, $this->userRepository->findAll());
    }

    /**
     * @dataProvider invalidPseudoProvider
     */
    public function testRegisterRejectsAnInvalidPseudo(string $pseudo, string $expectedMessage): void
    {
        $this->client->request('GET', '/register');

        $this->submitRegistration('me@example.com', $pseudo);

        self::assertResponseStatusCodeSame(422);
        self::assertSelectorTextContains('body', $expectedMessage);
        self::assertCount(0, $this->userRepository->findAll());
    }

    public static function invalidPseudoProvider(): iterable
    {
        yield 'vide' => ['', 'Merci de choisir un pseudo'];
        yield 'trop court' => ['ab', 'au moins 3 caractères'];
        yield 'trop long' => [str_repeat('a', 31), 'au plus 30 caractères'];
        yield 'espace' => ['Minou 69', 'ne peut contenir que'];
        yield 'caractère spécial' => ['<script>', 'ne peut contenir que'];
    }

    public function testRegisterAcceptsAccentedPseudo(): void
    {
        $this->client->request('GET', '/register');

        $this->submitRegistration('me@example.com', 'Félix-le-Chat');

        self::assertResponseRedirects('/');
        self::assertSame('Félix-le-Chat', $this->userRepository->findAll()[0]->getPseudo());
    }

    public function testRegisterRejectsATakenPseudoWhateverTheCase(): void
    {
        $this->client->request('GET', '/register');
        $this->submitRegistration('first@example.com', 'Minou');
        self::assertResponseRedirects('/');

        // Nouveau client : le premier est connecté
        $this->client->restart();
        $this->client->request('GET', '/register');
        $this->submitRegistration('second@example.com', 'MINOU');

        self::assertResponseStatusCodeSame(422);
        self::assertSelectorTextContains('body', 'Ce pseudo est déjà pris');
        self::assertCount(1, $this->userRepository->findAll());
    }

    private function submitRegistration(string $email, string $pseudo): void
    {
        $this->client->submitForm('Register', [
            'registration_form[email]' => $email,
            'registration_form[pseudo]' => $pseudo,
            'registration_form[plainPassword]' => 'password',
            'registration_form[agreeTerms]' => true,
        ]);
    }
}
