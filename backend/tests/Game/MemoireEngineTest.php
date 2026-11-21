<?php

namespace App\Tests\Game;

use App\Game\GameEngine;
use App\Game\Memoire\MemoireEngine;
use App\Game\PredictableRandomizer;
use App\Game\SecureRandomizer;
use PHPUnit\Framework\TestCase;

final class MemoireEngineTest extends TestCase
{
    private MemoireEngine $engine;

    protected function setUp(): void
    {
        $this->engine = new MemoireEngine(new SecureRandomizer());
    }

    /** Positions des deux cartes de chaque paire (seul le test connaît l'état complet). */
    private function pairsOf(array $state): array
    {
        $pairs = [];
        foreach ($state['cards'] as $index => $symbol) {
            $pairs[$symbol][] = $index;
        }

        return array_values($pairs);
    }

    private function flipAll(array $state, array $indexes): array
    {
        foreach ($indexes as $index) {
            [$state] = $this->engine->flip($state, $index);
        }

        return $state;
    }

    private function playPerfectly(array $state): array
    {
        foreach ($this->pairsOf($state) as [$a, $b]) {
            if (!\in_array($a, $state['matched'], true)) {
                $state = $this->flipAll($state, [$a, $b]);
            }
        }

        return $state;
    }

    /** Deux cartes qui ne vont pas ensemble. */
    private function mismatched(array $state): array
    {
        [[$a], [$b]] = $this->pairsOf($state);

        return [$a, $b];
    }

    /**
     * @dataProvider levelProvider
     */
    public function testEachSymbolAppearsExactlyTwice(string $level, int $pairs): void
    {
        $state = $this->engine->start($level, null);

        self::assertCount($pairs * 2, $state['cards']);
        self::assertCount($pairs, $this->pairsOf($state));
        foreach ($this->pairsOf($state) as $pair) {
            self::assertCount(2, $pair);
        }
        self::assertSame(0, $state['moves']);
    }

    public static function levelProvider(): iterable
    {
        yield 'facile' => ['facile', 6];
        yield 'normal' => ['normal', 8];
        yield 'difficile' => ['difficile', 12];
    }

    public function testAnUnknownLevelIsRefused(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->engine->start('expert', null);
    }

    public function testThereAreEnoughDistinctSymbolsForTheHardestLevel(): void
    {
        self::assertGreaterThanOrEqual(max(MemoireEngine::LEVELS), \count(MemoireEngine::SYMBOLS));
        self::assertSame(\count(MemoireEngine::SYMBOLS), \count(array_unique(array_column(MemoireEngine::SYMBOLS, 'emoji'))));
    }

    public function testTheShuffleChangesFromOneGameToTheNext(): void
    {
        $decks = [];
        for ($i = 0; $i < 20; ++$i) {
            $decks[] = json_encode($this->engine->start('normal', null)['cards'], \JSON_THROW_ON_ERROR);
        }

        self::assertGreaterThan(1, \count(array_unique($decks)));
    }

    public function testHiddenCardsAreNeverSentToThePlayer(): void
    {
        $state = $this->engine->start('normal', null);
        [$state] = $this->engine->flip($state, 0);
        $public = $this->engine->publicState($state);

        self::assertNotNull($public['cards'][0]['symbol']);
        foreach (\array_slice($public['cards'], 1) as $card) {
            self::assertNull($card['symbol'], 'carte '.$card['index']);
        }
    }

    public function testAPairStaysVisibleAndCountsOneMove(): void
    {
        $state = $this->engine->start('facile', null);
        [$a, $b] = $this->pairsOf($state)[0];

        [$state, $first] = $this->engine->flip($state, $a);
        [$state, $second] = $this->engine->flip($state, $b);

        self::assertSame(MemoireEngine::FIRST, $first);
        self::assertSame(MemoireEngine::MATCH, $second);
        self::assertSame(1, $state['moves']);
        self::assertSame(1, $this->engine->publicState($state)['pairsFound']);
        self::assertTrue($this->engine->publicState($state)['cards'][$a]['matched']);
    }

    public function testTwoDifferentCardsStayVisibleUntilTheNextFlip(): void
    {
        $state = $this->engine->start('facile', null);
        [$a, $b] = $this->mismatched($state);
        $c = $this->pairsOf($state)[2][0];

        [$state, $result] = $this->engine->flip($this->flipAll($state, [$a]), $b);
        self::assertSame(MemoireEngine::MISMATCH, $result);
        self::assertSame([$a, $b], $state['faceUp']);
        self::assertSame(1, $this->engine->mistakes($state));

        // La carte suivante cache d'abord les deux cartes différentes
        [$state, $result] = $this->engine->flip($state, $c);
        self::assertSame(MemoireEngine::FIRST, $result);
        self::assertSame([$c], $state['faceUp']);
        self::assertNull($this->engine->publicState($state)['cards'][$a]['symbol']);
    }

    public function testUselessFlipsAreIgnored(): void
    {
        $state = $this->engine->start('facile', null);
        [$a, $b] = $this->pairsOf($state)[0];
        [$once] = $this->engine->flip($state, $a);

        self::assertSame([$once, MemoireEngine::IGNORED], $this->engine->flip($once, $a), 'même carte');
        $matched = $this->flipAll($once, [$b]);
        self::assertSame(MemoireEngine::IGNORED, $this->engine->flip($matched, $a)[1], 'carte déjà trouvée');
        self::assertSame(MemoireEngine::IGNORED, $this->engine->flip($state, 99)[1], 'carte inexistante');
        self::assertSame(MemoireEngine::IGNORED, $this->engine->flip($state, -1)[1], 'carte inexistante');
    }

    public function testAPerfectGameGivesTheMaximumScore(): void
    {
        foreach (MemoireEngine::LEVELS as $level => $pairs) {
            $state = $this->playPerfectly($this->engine->start($level, null));

            self::assertSame(GameEngine::WON, $this->engine->status($state));
            self::assertSame(0, $this->engine->mistakes($state));
            self::assertSame(100 * $pairs, $this->engine->score($state), $level);
            self::assertSame(MemoireEngine::IGNORED, $this->engine->flip($state, 0)[1], 'plus rien ne bouge');
        }
    }

    public function testEachMistakeCostsTenPointsButNeverBelowFiftyPerPair(): void
    {
        $state = $this->engine->start('facile', null);
        [$a, $b] = $this->mismatched($state);

        $twoMistakes = $this->playPerfectly($this->flipAll($state, [$a, $b, $a, $b]));
        self::assertSame(2, $this->engine->mistakes($twoMistakes));
        self::assertSame(300 + 300 - 20, $this->engine->score($twoMistakes));

        $sloppy = $state;
        for ($i = 0; $i < 40; ++$i) {
            $sloppy = $this->flipAll($sloppy, [$a, $b]);
        }
        self::assertSame(300, $this->engine->score($this->playPerfectly($sloppy)));
        self::assertSame(0, $this->engine->score($state), 'partie en cours');
    }

    public function testThePredictableRandomizerKeepsThePairsSideBySide(): void
    {
        $state = (new MemoireEngine(new PredictableRandomizer()))->start('facile', null);

        self::assertSame([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5], $state['cards']);
    }
}
