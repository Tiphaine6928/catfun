<?php

namespace App\Tests\Controller\Api;

use App\Entity\User;

final class RegistrationControllerTest extends ApiTestCase
{
    private const VALID = ['email' => 'felix@cat.fun', 'pseudo' => 'Félix', 'password' => 'miaou123'];

    public function testRegisterCreatesTheAccountAndReturnsAWorkingToken(): void
    {
        $data = $this->requestJson('POST', '/api/register', ['email' => '  felix@cat.fun ', 'pseudo' => ' Félix ', 'password' => 'miaou123']);

        self::assertResponseStatusCodeSame(201);
        self::assertSame('felix@cat.fun', $data['user']);
        self::assertSame('Félix', $data['pseudo']);
        self::assertNotEmpty($data['token']);

        $user = $this->em->getRepository(User::class)->findOneBy(['email' => 'felix@cat.fun']);
        self::assertNotNull($user);
        self::assertNotSame('miaou123', $user->getPassword(), 'le mot de passe doit être haché');

        // Le token renvoyé permet d'appeler directement l'API
        $this->client->request('GET', '/api/me', [], [], ['HTTP_AUTHORIZATION' => 'Bearer '.$data['token']]);
        self::assertResponseIsSuccessful();

        // Et on peut ensuite se connecter avec le mot de passe choisi
        $login = $this->requestJson('POST', '/api/login', ['email' => 'felix@cat.fun', 'password' => 'miaou123']);
        self::assertResponseIsSuccessful();
        self::assertArrayHasKey('token', $login);
    }

    /**
     * @dataProvider pseudoMessageProvider
     */
    public function testRegisterExplainsWhatIsWrongWithThePseudo(string $pseudo, string $message): void
    {
        $data = $this->requestJson('POST', '/api/register', ['pseudo' => $pseudo] + self::VALID);

        self::assertResponseStatusCodeSame(422);
        self::assertStringContainsString($message, $data['errors']['pseudo']);
    }

    public static function pseudoMessageProvider(): iterable
    {
        yield 'vide' => ['', 'Merci de choisir un pseudo'];
        yield 'trop court' => ['ab', 'au moins 3 caractères'];
        yield 'trop long' => [str_repeat('a', 31), 'au plus 30 caractères'];
        yield 'caractère interdit' => ['Minou 69', 'ne peut contenir que'];
    }

    public function testRegisterAcceptsAccentsDigitsDashAndUnderscoreInThePseudo(): void
    {
        $data = $this->requestJson('POST', '/api/register', ['pseudo' => 'Félix-le_Chat69'] + self::VALID);

        self::assertResponseStatusCodeSame(201);
        self::assertSame('Félix-le_Chat69', $data['pseudo']);
    }

    public function testRegisterRejectsATakenEmailOrPseudoWhateverTheCase(): void
    {
        $this->createUser('felix@cat.fun', 'Félix');

        $data = $this->requestJson('POST', '/api/register', ['email' => 'FELIX@cat.fun', 'pseudo' => 'FÉLIX', 'password' => 'miaou123']);

        self::assertResponseStatusCodeSame(422);
        self::assertSame('Un compte existe déjà avec cet email.', $data['errors']['email']);
        self::assertSame('Ce pseudo est déjà pris.', $data['errors']['pseudo']);
        self::assertSame(1, $this->em->getRepository(User::class)->count([]));
    }

    /**
     * @dataProvider invalidProvider
     *
     * @param list<string> $fields
     */
    public function testRegisterRejectsInvalidData(array|string $body, int $status, array $fields): void
    {
        $data = $this->requestJson('POST', '/api/register', $body);

        self::assertResponseStatusCodeSame($status);
        foreach ($fields as $field) {
            self::assertArrayHasKey($field, $data['errors'], "erreur attendue sur $field");
        }
        self::assertSame(0, $this->em->getRepository(User::class)->count([]));
    }

    public static function invalidProvider(): iterable
    {
        yield 'JSON invalide' => ['{pas du json', 400, []];
        yield 'objet vide' => [[], 422, ['email', 'pseudo', 'password']];
        yield 'email invalide' => [['email' => 'toto'] + self::VALID, 422, ['email']];
        yield 'pseudo avec une espace' => [['pseudo' => 'a b c'] + self::VALID, 422, ['pseudo']];
        yield 'pseudo vide' => [['pseudo' => '   '] + self::VALID, 422, ['pseudo']];
        yield 'pseudo trop court' => [['pseudo' => 'ab'] + self::VALID, 422, ['pseudo']];
        yield 'pseudo trop long' => [['pseudo' => str_repeat('a', 31)] + self::VALID, 422, ['pseudo']];
        yield 'pseudo avec caractères spéciaux' => [['pseudo' => '<script>'] + self::VALID, 422, ['pseudo']];
        yield 'mot de passe trop court' => [['password' => '12345'] + self::VALID, 422, ['password']];
        yield 'mot de passe vide' => [['password' => ''] + self::VALID, 422, ['password']];
        yield 'mot de passe pas une chaîne' => [['password' => 123456] + self::VALID, 422, ['password']];
        yield 'champ interdit' => [self::VALID + ['roles' => ['ROLE_ADMIN']], 422, ['roles']];
        yield 'plusieurs erreurs à la fois' => [['email' => 'toto', 'pseudo' => 'ab', 'password' => '1'], 422, ['email', 'pseudo', 'password']];
    }
}
