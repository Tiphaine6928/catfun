<?php

namespace App\Tests\Controller;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

/**
 * Page de connexion Symfony (/login, formulaire Twig + App\Security\UserAuthenticator)
 * et déconnexion (/logout).
 */
final class LoginControllerTest extends WebTestCase
{
    private const EMAIL = 'felix@cat.fun';
    private const PASSWORD = 'miaou123';
    private const PSEUDO = 'Félix';

    private KernelBrowser $client;

    protected function setUp(): void
    {
        $this->client = static::createClient();
        $container = static::getContainer();

        /** @var EntityManagerInterface $em */
        $em = $container->get(EntityManagerInterface::class);
        foreach (['score', 'user'] as $table) {
            $em->getConnection()->executeStatement(sprintf('DELETE FROM `%s`', $table));
        }

        $user = (new User())->setEmail(self::EMAIL)->setPseudo(self::PSEUDO);
        $user->setPassword($container->get(UserPasswordHasherInterface::class)->hashPassword($user, self::PASSWORD));
        $em->persist($user);
        $em->flush();
    }

    public function testTheLoginPageShowsTheForm(): void
    {
        $crawler = $this->client->request('GET', '/login');

        self::assertResponseIsSuccessful();
        self::assertPageTitleContains('Connexion');
        self::assertSelectorTextContains('h1', 'Connexion');
        self::assertSelectorTextContains('label[for="inputPassword"]', 'Mot de passe');
        self::assertSelectorTextContains('.checkbox label', 'Se souvenir de moi');
        self::assertSelectorExists('a[href="/register"]');
        self::assertSelectorExists('form[method="post"] input[type="email"][name="email"][required]');
        self::assertSelectorExists('input[type="password"][name="password"][required]');
        self::assertSelectorExists('input[type="checkbox"][name="_remember_me"]');
        self::assertSelectorTextContains('button[type="submit"]', 'Se connecter');
        self::assertNotEmpty($crawler->filter('input[name="_csrf_token"]')->attr('value'), 'le jeton CSRF doit être présent');
        self::assertSelectorNotExists('.alert-danger');
    }

    public function testLoginWithValidCredentialsRedirectsToTheHomePage(): void
    {
        $this->submitLogin(self::EMAIL, self::PASSWORD);

        self::assertResponseRedirects('/');
        $this->client->followRedirect();
        self::assertSelectorTextContains('body', 'Connecté en tant que '.self::PSEUDO);
    }

    public function testTheEmailIsNotCaseSensitive(): void
    {
        $this->submitLogin(strtoupper(self::EMAIL), self::PASSWORD);

        self::assertResponseRedirects('/');
        $this->client->followRedirect();
        self::assertSelectorTextContains('body', 'Connecté en tant que '.self::PSEUDO);
    }

    public function testAWrongPasswordShowsAnErrorAndKeepsTheEmail(): void
    {
        $this->submitLogin(self::EMAIL, 'mauvais');

        self::assertResponseRedirects('/login');
        $crawler = $this->client->followRedirect();
        self::assertSelectorTextContains('.alert-danger', 'Email ou mot de passe incorrect.');
        self::assertSame(self::EMAIL, $crawler->filter('input[name="email"]')->attr('value'), 'l’email saisi est conservé');
        self::assertSame('', (string) $crawler->filter('input[name="password"]')->attr('value'), 'le mot de passe n’est jamais renvoyé');
        $this->assertNotLoggedIn();
    }

    public function testAnUnknownEmailShowsTheSameErrorAsAWrongPassword(): void
    {
        // Même message : on ne révèle pas si un compte existe pour cet email
        $this->submitLogin('inconnu@cat.fun', self::PASSWORD);

        self::assertResponseRedirects('/login');
        $this->client->followRedirect();
        self::assertSelectorTextContains('.alert-danger', 'Email ou mot de passe incorrect.');
        $this->assertNotLoggedIn();
    }

    public function testAnEmptyFormIsRejected(): void
    {
        $this->submitLogin('', '');

        self::assertResponseRedirects('/login');
        $this->client->followRedirect();
        self::assertSelectorTextContains('.alert-danger', 'Email ou mot de passe incorrect.');
        $this->assertNotLoggedIn();
    }

    public function testAnInvalidCsrfTokenIsRejected(): void
    {
        $this->client->request('GET', '/login');
        $this->client->submitForm('Se connecter', [
            'email' => self::EMAIL,
            'password' => self::PASSWORD,
            '_csrf_token' => 'jeton-falsifie',
        ]);

        self::assertResponseRedirects('/login');
        $this->client->followRedirect();
        self::assertSelectorTextContains('.alert-danger', 'La page a expiré, recharge-la et réessaie.');
        $this->assertNotLoggedIn();
    }

    public function testAPostWithoutTheFormIsRejected(): void
    {
        // Requête forgée par un autre site : pas de jeton CSRF
        $this->client->request('POST', '/login', ['email' => self::EMAIL, 'password' => self::PASSWORD]);

        self::assertResponseRedirects('/login');
        $this->assertNotLoggedIn();
    }

    public function testAnAlreadyLoggedInUserIsRedirectedToTheHomePage(): void
    {
        $this->submitLogin(self::EMAIL, self::PASSWORD);

        $this->client->request('GET', '/login');

        self::assertResponseRedirects('/');
    }

    public function testAfterLoginTheUserGoesBackToThePageTheyWanted(): void
    {
        // Page mémorisée par Symfony quand un visiteur tente d'ouvrir une page protégée
        $this->client->request('GET', '/login');
        $session = $this->client->getRequest()->getSession();
        $session->set('_security.main.target_path', 'http://localhost/register');
        $session->save();

        $this->submitLogin(self::EMAIL, self::PASSWORD);

        self::assertResponseRedirects('http://localhost/register');
    }

    public function testRememberMeSetsALongLivedCookieOnlyWhenChecked(): void
    {
        $this->submitLogin(self::EMAIL, self::PASSWORD);
        self::assertNull($this->client->getCookieJar()->get('REMEMBERME'), 'pas de cookie sans la case cochée');

        $this->client->restart();
        $this->submitLogin(self::EMAIL, self::PASSWORD, rememberMe: true);
        $cookie = $this->client->getCookieJar()->get('REMEMBERME');
        self::assertNotNull($cookie, 'cookie "se souvenir de moi" posé');
        self::assertTrue($cookie->isHttpOnly(), 'cookie inaccessible au JavaScript');
        self::assertGreaterThan(time() + 6 * 24 * 3600, (int) $cookie->getExpiresTime(), 'valable une semaine');
    }

    public function testTheRememberMeCookieKeepsTheUserLoggedInWithoutASession(): void
    {
        $this->submitLogin(self::EMAIL, self::PASSWORD, rememberMe: true);
        $rememberMe = $this->client->getCookieJar()->get('REMEMBERME');

        // Nouveau navigateur : plus de session, seulement le cookie
        $this->client->restart();
        $this->client->getCookieJar()->set($rememberMe);
        $this->client->request('GET', '/');

        self::assertSelectorTextContains('body', 'Connecté en tant que '.self::PSEUDO);
    }

    public function testLogoutEndsTheSessionAndGoesBackToTheLoginPage(): void
    {
        $this->submitLogin(self::EMAIL, self::PASSWORD, rememberMe: true);

        $this->client->request('GET', '/logout');

        self::assertResponseRedirects('/login');
        self::assertNull($this->client->getCookieJar()->get('REMEMBERME'), 'le cookie "se souvenir de moi" est supprimé');
        $this->assertNotLoggedIn();
    }

    private function submitLogin(string $email, string $password, bool $rememberMe = false): void
    {
        $this->client->request('GET', '/login');
        $values = ['email' => $email, 'password' => $password];
        if ($rememberMe) {
            $values['_remember_me'] = true;
        }
        $this->client->submitForm('Se connecter', $values);
    }

    private function assertNotLoggedIn(): void
    {
        $this->client->request('GET', '/');
        self::assertResponseIsSuccessful();
        self::assertSelectorTextNotContains('body', 'Connecté en tant que');
        self::assertSelectorExists('a[href="/login"]');
    }
}
