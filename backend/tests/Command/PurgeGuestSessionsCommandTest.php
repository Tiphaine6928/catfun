<?php

namespace App\Tests\Command;

use App\Entity\Game;
use App\Entity\GameSession;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Console\Tester\CommandTester;

final class PurgeGuestSessionsCommandTest extends KernelTestCase
{
    public function testOnlyOldGuestSessionsAreDeleted(): void
    {
        $kernel = self::bootKernel();
        $em = static::getContainer()->get(EntityManagerInterface::class);
        $connection = $em->getConnection();
        foreach (['score', 'game', 'user'] as $table) {
            $connection->executeStatement(sprintf('DELETE FROM `%s`', $table));
        }

        $game = (new Game())->setName('Pendu')->setDescription('Jeu Pendu');
        $player = (new User())->setEmail('alice@cat.fun')->setPseudo('alice');
        $player->setPassword('x');
        $em->persist($game);
        $em->persist($player);
        $sessions = [
            'oldGuest' => new GameSession(null, $game, null, []),
            'recentGuest' => new GameSession(null, $game, null, []),
            'oldPlayer' => new GameSession($player, $game, null, []),
        ];
        foreach ($sessions as $session) {
            $em->persist($session);
        }
        $em->flush();
        $twoDaysAgo = (new \DateTimeImmutable('-2 days'))->format('Y-m-d H:i:s');
        foreach (['oldGuest', 'oldPlayer'] as $name) {
            $connection->executeStatement('UPDATE game_session SET created_at = ? WHERE id = ?', [$twoDaysAgo, $sessions[$name]->getId()]);
        }

        $tester = new CommandTester((new Application($kernel))->find('app:guest-sessions:purge'));
        $tester->execute([]);

        $tester->assertCommandIsSuccessful();
        self::assertStringContainsString('1 partie(s)', $tester->getDisplay());
        $remaining = $connection->fetchFirstColumn('SELECT id FROM game_session');
        self::assertEqualsCanonicalizing([$sessions['recentGuest']->getId(), $sessions['oldPlayer']->getId()], $remaining);

        $tester->execute(['--older-than' => 'n’importe quoi']);
        self::assertSame(2, $tester->getStatusCode());
    }
}
