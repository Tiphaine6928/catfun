<?php

namespace App\Tests\Game;

use App\Game\GameEngine;
use App\Game\Pendu\PenduEngine;
use App\Game\PredictableRandomizer;
use App\Game\SecureRandomizer;
use PHPUnit\Framework\TestCase;

final class PenduEngineTest extends TestCase
{
    private PenduEngine $engine;

    protected function setUp(): void
    {
        $this->engine = new PenduEngine(new SecureRandomizer());
    }

    /** Joue plusieurs lettres d'affilée. */
    private function play(array $state, string $letters): array
    {
        foreach (mb_str_split($letters) as $letter) {
            [$state] = $this->engine->guess($state, $letter);
        }

        return $state;
    }

    /** Le mot tel que le joueur le voit, "_" pour une lettre cachée. */
    private function shown(array $state): string
    {
        return implode('', array_map(static fn (array $c) => $c['char'] ?? '_', $this->engine->publicState($state)['cells']));
    }

    public function testNormalizeLetter(): void
    {
        self::assertSame('E', PenduEngine::normalizeLetter('é'));
        self::assertSame('A', PenduEngine::normalizeLetter('À'));
        self::assertSame('C', PenduEngine::normalizeLetter('ç'));
        self::assertSame('I', PenduEngine::normalizeLetter('ï'));
        self::assertSame('M', PenduEngine::normalizeLetter('m'));
        foreach ([' ', '-', '1', '', 'AB', '?', 'Enter', 'œ'] as $value) {
            self::assertNull(PenduEngine::normalizeLetter($value), "« $value »");
        }
    }

    public function testANewGameHasNineLivesAndAHiddenWord(): void
    {
        $state = PenduEngine::createState('chat-huant');

        self::assertSame(9, $state['lives']);
        self::assertSame('____-_____', $this->shown($state));
        self::assertSame('____ ____', $this->shown(PenduEngine::createState('NEUF VIES')));
        self::assertSame(GameEngine::PLAYING, $this->engine->status($state));
    }

    public function testTheHiddenWordIsNeverSentDuringTheGame(): void
    {
        $public = $this->engine->publicState(PenduEngine::createState('MOUSTACHES'));

        self::assertNull($public['word']);
        self::assertStringNotContainsString('MOUSTACHES', json_encode($public, \JSON_THROW_ON_ERROR));
        self::assertStringNotContainsString('"M"', json_encode($public['cells'], \JSON_THROW_ON_ERROR));
    }

    public function testACorrectLetterRevealsEveryOccurrenceWithOrWithoutAccent(): void
    {
        [$state, $result] = $this->engine->guess(PenduEngine::createState('ÉCAILLE DE TORTUE'), 'e');

        self::assertSame(PenduEngine::CORRECT, $result);
        self::assertSame(9, $state['lives']);
        self::assertSame('É_____E _E _____E', $this->shown($state));
    }

    public function testAnAccentedKeyCountsAsTheBaseLetter(): void
    {
        [$state, $result] = $this->engine->guess(PenduEngine::createState('LITIÈRE'), 'è');

        self::assertSame(PenduEngine::CORRECT, $result);
        self::assertSame(['E'], $state['guessed']);
    }

    public function testAWrongLetterCostsALife(): void
    {
        [$state, $result] = $this->engine->guess(PenduEngine::createState('MATOU'), 'Z');

        self::assertSame(PenduEngine::WRONG, $result);
        self::assertSame(8, $state['lives']);
        self::assertSame(['Z'], $this->engine->publicState($state)['wrong']);
    }

    public function testGuessingTheSameLetterAgainIsFree(): void
    {
        [$once] = $this->engine->guess(PenduEngine::createState('MATOU'), 'Z');
        [$state, $result] = $this->engine->guess($once, 'z');

        self::assertSame(PenduEngine::ALREADY_GUESSED, $result);
        self::assertSame($once, $state);
    }

    public function testKeysThatAreNotLettersAreIgnored(): void
    {
        $initial = PenduEngine::createState('MATOU');

        self::assertSame([$initial, PenduEngine::INVALID], $this->engine->guess($initial, '5'));
    }

    public function testTheGameIsWonWhenEveryLetterIsFound(): void
    {
        $state = $this->play(PenduEngine::createState('MATOU'), 'MATOU');

        self::assertSame(GameEngine::WON, $this->engine->status($state));
        self::assertSame(PenduEngine::GAME_OVER, $this->engine->guess($state, 'X')[1]);
        self::assertSame('MATOU', $this->engine->publicState($state)['word']);
    }

    public function testTheGameIsLostAfterNineMistakesAndTheWordIsRevealed(): void
    {
        $state = $this->play(PenduEngine::createState('MATOU'), 'BCDEFGHIJ');

        self::assertSame(0, $state['lives']);
        self::assertSame(GameEngine::LOST, $this->engine->status($state));
        self::assertSame('MATOU', $this->shown($state));
        self::assertSame(5, \count(array_filter($this->engine->publicState($state)['cells'], static fn ($c) => $c['missed'])));
        self::assertSame(PenduEngine::GAME_OVER, $this->engine->guess($state, 'M')[1]);
    }

    public function testAWordWithoutLettersIsRefused(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        PenduEngine::createState(' - ');
    }

    public function testTheScore(): void
    {
        // MATOU : 5 lettres différentes
        self::assertSame(100 + 20 * 9 + 5 * 5, $this->engine->score($this->play(PenduEngine::createState('MATOU'), 'MATOU')));
        self::assertSame(100 + 20 * 7 + 5 * 5, $this->engine->score($this->play(PenduEngine::createState('MATOU'), 'XYMATOU')));
        self::assertSame(0, $this->engine->score(PenduEngine::createState('MATOU')));
        self::assertSame(0, $this->engine->score($this->play(PenduEngine::createState('MATOU'), 'BCDEFGHIJ')));
    }

    public function testTheSameWordIsNeverDrawnTwiceInARow(): void
    {
        $predictable = new PenduEngine(new PredictableRandomizer());
        $first = $predictable->start(null, null);
        $second = $predictable->start(null, $first);

        self::assertSame('MOUSTACHES', $first['word']);
        self::assertSame('RONRONNEMENT', $second['word']);
        self::assertSame('MOUSTACHES', $predictable->start(null, $second)['word']);
    }

    public function testEveryWordOfTheListIsPlayable(): void
    {
        self::assertSame(\count(PenduEngine::WORDS), \count(array_unique(PenduEngine::WORDS)), 'pas de doublon');
        foreach (PenduEngine::WORDS as $word) {
            PenduEngine::createState($word);
            foreach (mb_str_split($word) as $char) {
                self::assertTrue(null !== PenduEngine::normalizeLetter($char) || ' ' === $char || '-' === $char, "$word : « $char »");
            }
        }
    }
}
