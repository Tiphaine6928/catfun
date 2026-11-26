<?php

namespace App\Tests\Controller\Api;

use App\Entity\User;
use Symfony\Component\Mime\Email;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

/**
 * Changement d'email : demande (POST /api/me/email) puis confirmation par lien (POST /api/email/confirm).
 */
final class EmailChangeTest extends ApiTestCase
{
    private User $alice;

    protected function setUp(): void
    {
        parent::setUp();
        $this->alice = $this->createUser('alice@cat.fun', 'Alice');
        $hasher = static::getContainer()->get(UserPasswordHasherInterface::class);
        $this->alice->setPassword($hasher->hashPassword($this->alice, 'miaou123'));
        $this->em->flush();
    }

    private function ask(string $email, string $password = 'miaou123'): mixed
    {
        return $this->requestJson('POST', '/api/me/email', ['email' => $email, 'password' => $password], $this->alice);
    }

    private function confirm(string $token): mixed
    {
        return $this->requestJson('POST', '/api/email/confirm', ['token' => $token]);
    }

    /** Jeton du lien de confirmation (premier email de la dernière requête). */
    private function tokenFromConfirmationEmail(): string
    {
        $email = self::getMailerMessage(0);
        self::assertInstanceOf(Email::class, $email);
        self::assertSame(1, preg_match('~/#/confirmer-email\?token=([0-9a-f]{64})~', (string) $email->getTextBody(), $matches));

        return $matches[1];
    }

    private function storedEmail(): string
    {
        return (string) $this->em->getConnection()->fetchOne('SELECT email FROM user WHERE pseudo = ?', ['Alice']);
    }

    public function testTheNewEmailIsUsedOnlyOnceConfirmed(): void
    {
        $response = $this->ask('alice.nouvelle@cat.fun');

        self::assertResponseStatusCodeSame(202);
        self::assertStringContainsString('alice.nouvelle@cat.fun', $response['message']);
        self::assertEmailCount(2);

        // Lien de confirmation vers la nouvelle adresse
        $confirmation = self::getMailerMessage(0);
        self::assertEmailAddressContains($confirmation, 'To', 'alice.nouvelle@cat.fun');
        self::assertEmailHeaderSame($confirmation, 'Subject', 'CatFun : confirme ta nouvelle adresse email');
        self::assertEmailTextBodyContains($confirmation, 'http://localhost:8081/#/confirmer-email?token=');

        // Avertissement à l'ancienne adresse
        $notice = self::getMailerMessage(1);
        self::assertEmailAddressContains($notice, 'To', 'alice@cat.fun');
        self::assertEmailTextBodyContains($notice, 'alice.nouvelle@cat.fun');
        self::assertEmailTextBodyContains($notice, 'Mot de passe oublié');

        // Rien ne change avant le clic
        $token = $this->tokenFromConfirmationEmail();
        self::assertSame('alice@cat.fun', $this->storedEmail());

        $confirmed = $this->confirm($token);
        self::assertResponseIsSuccessful();
        self::assertSame('alice.nouvelle@cat.fun', $confirmed['email']);
        self::assertSame('alice.nouvelle@cat.fun', $this->storedEmail());

        // L'ancien jeton de connexion (lié à l'ancienne adresse) ne marche plus : il faut se reconnecter
        $this->requestJson('GET', '/api/me', as: $this->alice);
        self::assertResponseStatusCodeSame(401);
        $this->requestJson('POST', '/api/login', ['email' => 'alice.nouvelle@cat.fun', 'password' => 'miaou123']);
        self::assertResponseIsSuccessful();

        // Le lien ne sert qu'une fois
        $this->confirm($token);
        self::assertResponseStatusCodeSame(410);
    }

    public function testThePasswordIsRequiredAndChecked(): void
    {
        $this->ask('alice.nouvelle@cat.fun', 'pas-le-bon');
        self::assertResponseStatusCodeSame(422);
        self::assertSame('Mot de passe incorrect.', json_decode((string) $this->client->getResponse()->getContent(), true)['errors']['password']);

        $response = $this->requestJson('POST', '/api/me/email', ['email' => 'alice.nouvelle@cat.fun'], $this->alice);
        self::assertResponseStatusCodeSame(422);
        self::assertSame('Merci de saisir ton mot de passe pour confirmer.', $response['errors']['password']);
        self::assertEmailCount(0);
    }

    /**
     * @dataProvider invalidEmailProvider
     */
    public function testInvalidNewEmailsAreRefused(string $email, string $message): void
    {
        $this->createUser('bob@cat.fun', 'Bob');

        $response = $this->ask($email);

        self::assertResponseStatusCodeSame(422);
        self::assertSame($message, $response['errors']['email']);
        self::assertEmailCount(0);
    }

    public static function invalidEmailProvider(): iterable
    {
        yield 'pas une adresse' => ['pas-une-adresse', 'Cette adresse email n\'est pas valide.'];
        yield 'vide' => ['  ', 'Merci de saisir ta nouvelle adresse email.'];
        yield 'la même' => ['ALICE@cat.fun', 'C\'est déjà ton adresse email.'];
        yield 'déjà prise' => ['Bob@cat.fun', 'Un compte existe déjà avec cet email.'];
    }

    public function testAnExpiredOrUnknownLinkIsRefused(): void
    {
        $this->ask('alice.nouvelle@cat.fun');
        $token = $this->tokenFromConfirmationEmail();
        $this->em->getConnection()->executeStatement('UPDATE email_change_request SET expires_at = ?', [(new \DateTimeImmutable('-1 minute'))->format('Y-m-d H:i:s')]);

        $this->confirm($token);
        self::assertResponseStatusCodeSame(410);
        self::assertSame('alice@cat.fun', $this->storedEmail());

        $this->confirm(str_repeat('a', 64));
        self::assertResponseStatusCodeSame(410);
        $this->confirm('abc');
        self::assertResponseStatusCodeSame(410);
    }

    public function testANewRequestCancelsThePreviousLink(): void
    {
        $this->ask('premiere@cat.fun');
        $first = $this->tokenFromConfirmationEmail();
        $this->ask('seconde@cat.fun');
        $second = $this->tokenFromConfirmationEmail();

        $this->confirm($first);
        self::assertResponseStatusCodeSame(410);
        $this->confirm($second);
        self::assertResponseIsSuccessful();
        self::assertSame('seconde@cat.fun', $this->storedEmail());
    }

    public function testTheAddressCannotBeTakenByAnotherAccountMeanwhile(): void
    {
        $this->ask('convoitee@cat.fun');
        $token = $this->tokenFromConfirmationEmail();
        $this->createUser('convoitee@cat.fun', 'Bob');

        $response = $this->confirm($token);

        self::assertResponseStatusCodeSame(409);
        self::assertSame('Cette adresse est déjà utilisée par un autre compte.', $response['message']);
        self::assertSame('alice@cat.fun', $this->storedEmail());
    }

    public function testRequestsRequireATokenAndAreLimited(): void
    {
        $this->requestJson('POST', '/api/me/email', ['email' => 'x@cat.fun', 'password' => 'miaou123']);
        self::assertResponseStatusCodeSame(401);

        for ($i = 0; $i < 5; ++$i) {
            $this->ask("essai$i@cat.fun", 'pas-le-bon');
            self::assertResponseStatusCodeSame(422);
        }
        $this->ask('essai@cat.fun');
        self::assertResponseStatusCodeSame(429);
    }
}
