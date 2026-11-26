<?php

namespace App\Tests\Command;

use App\Entity\Game;
use App\Entity\GameSession;
use App\Entity\ResetPasswordRequest;
use App\Entity\Score;
use App\Entity\User;
use App\Game\GameEngine;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Console\Tester\CommandTester;

/**
 * Durées de conservation (RGPD) appliquées par app:data:purge.
 */
final class PurgeDataCommandTest extends KernelTestCase
{
    private EntityManagerInterface $em;
    private Connection $db;
    private CommandTester $command;
    private Game $game;

    protected function setUp(): void
    {
        $kernel = self::bootKernel();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $this->db = $this->em->getConnection();
        foreach (['score', 'game', 'user'] as $table) {
            $this->db->executeStatement(sprintf('DELETE FROM `%s`', $table));
        }
        $this->command = new CommandTester((new Application($kernel))->find('app:data:purge'));

        $this->game = (new Game())->setName('Pendu')->setDescription('Jeu Pendu');
        $this->em->persist($this->game);
        $this->em->flush();
    }

    private function user(string $name): User
    {
        $user = (new User())->setEmail("$name@cat.fun")->setPseudo($name);
        $user->setPassword('x');
        $this->em->persist($user);
        $this->em->flush();

        return $user;
    }

    private function session(?User $player, string $status = GameEngine::PLAYING): GameSession
    {
        $session = new GameSession($player, $this->game, null, []);
        $session->setState([], $status);
        $this->em->persist($session);
        $this->em->flush();

        return $session;
    }

    /**
     * Change une date directement en base (le temps ne passe pas pendant un test).
     * $ago : décalage relatif, ex. '-3 years -1 day' (chaque partie avec son signe).
     */
    private function age(string $table, string $column, string $ago, int|string $id): void
    {
        $this->db->executeStatement(
            sprintf('UPDATE `%s` SET %s = ? WHERE id = ?', $table, $column),
            [(new \DateTimeImmutable($ago))->format('Y-m-d H:i:s'), $id],
        );
    }

    /** @return list<string> */
    private function ids(string $table): array
    {
        return array_map('strval', $this->db->fetchFirstColumn(sprintf('SELECT id FROM `%s` ORDER BY id', $table)));
    }

    private function purge(): string
    {
        $this->command->execute([]);
        $this->command->assertCommandIsSuccessful();
        $this->em->clear();

        return $this->command->getDisplay();
    }

    public function testGuestSessionsAreKeptOneDay(): void
    {
        $old = $this->session(null);
        $recent = $this->session(null);
        $this->age('game_session', 'created_at', '-25 hours', $old->getId());

        $output = $this->purge();

        self::assertSame([$recent->getId()], $this->ids('game_session'));
        self::assertMatchesRegularExpression('/Parties de visiteurs supprimées\s+1/', $output);
    }

    public function testExpiredPasswordLinksAreDeleted(): void
    {
        $alice = $this->user('alice');
        [$expired] = ResetPasswordRequest::create($alice);
        [$valid] = ResetPasswordRequest::create($alice);
        $this->em->persist($expired);
        $this->em->persist($valid);
        $this->em->flush();
        $this->age('reset_password_request', 'expires_at', '-1 minute', $expired->getId());

        $this->purge();

        self::assertSame([(string) $valid->getId()], $this->ids('reset_password_request'));
    }

    public function testAbandonedGamesAreKeptThirtyDaysButFinishedGamesStay(): void
    {
        $alice = $this->user('alice');
        $abandoned = $this->session($alice);
        $recent = $this->session($alice);
        $finished = $this->session($alice, GameEngine::LOST);
        foreach ([$abandoned, $finished] as $session) {
            $this->age('game_session', 'created_at', '-31 days', $session->getId());
        }

        $this->purge();

        $remaining = $this->ids('game_session');
        sort($remaining);
        $expected = [$recent->getId(), $finished->getId()];
        sort($expected);
        self::assertSame($expected, $remaining);
    }

    public function testInactiveAccountsAreWarnedThenDeleted(): void
    {
        $active = $this->user('active');
        $inactive = $this->user('inactive');
        $this->em->persist((new Score())->setPlayer($inactive)->setGame($this->game)->setPoints(100));
        $this->em->flush();
        $this->age('user', 'last_login_at', '-3 years -1 day', $inactive->getId());

        // 1er passage : un email, rien de supprimé
        $output = $this->purge();
        self::assertEmailCount(1);
        $email = self::getMailerMessage();
        self::assertEmailAddressContains($email, 'To', 'inactive@cat.fun');
        self::assertEmailHeaderSame($email, 'Subject', 'CatFun : ton compte va être supprimé');
        self::assertEmailTextBodyContains($email, 'Bonjour inactive');
        self::assertEmailTextBodyContains($email, 'http://localhost:8081/#/login');
        self::assertMatchesRegularExpression('/Comptes inactifs prévenus\s+1/', $output);
        self::assertCount(2, $this->ids('user'));

        // Le lendemain : pas de deuxième email (le compteur cumule les passages : toujours 1)
        $this->purge();
        self::assertEmailCount(1);
        self::assertCount(2, $this->ids('user'));

        // 30 jours après l'email : le compte et ses scores sont supprimés
        $this->age('user', 'inactivity_notice_sent_at', '-30 days -1 hour', $inactive->getId());
        $output = $this->purge();
        self::assertSame([(string) $active->getId()], $this->ids('user'));
        self::assertSame([], $this->ids('score'));
        self::assertMatchesRegularExpression('/Comptes inactifs supprimés\s+1/', $output);
    }

    public function testLoggingInAfterTheWarningKeepsTheAccount(): void
    {
        $user = $this->user('revenant');
        $this->age('user', 'last_login_at', '-3 years -1 day', $user->getId());
        $this->purge();

        // Reconnexion : l'avertissement est effacé
        $user = $this->em->find(User::class, $user->getId());
        $user->recordLogin();
        $this->em->flush();
        $this->age('user', 'last_login_at', '-1 day', $user->getId());

        $this->purge();

        self::assertSame([(string) $user->getId()], $this->ids('user'));
        self::assertNull($this->db->fetchOne('SELECT inactivity_notice_sent_at FROM user'));
    }
}
