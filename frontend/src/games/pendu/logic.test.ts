import { describe, expect, it } from 'vitest';
import {
  computeScore,
  createGame,
  getCells,
  getStatus,
  getWrongLetters,
  guess,
  MAX_LIVES,
  normalizeLetter,
  pickWord,
  type PenduState,
} from './logic';
import { WORDS } from './words';

function play(state: PenduState, letters: string): PenduState {
  for (const letter of letters) {
    state = guess(state, letter).state;
  }

  return state;
}

const shown = (state: PenduState) => getCells(state).map((c) => (c.revealed ? c.char : '_')).join('');

describe('normalizeLetter', () => {
  it('retire les accents et met en majuscule', () => {
    expect(normalizeLetter('é')).toBe('E');
    expect(normalizeLetter('À')).toBe('A');
    expect(normalizeLetter('ç')).toBe('C');
    expect(normalizeLetter('ï')).toBe('I');
    expect(normalizeLetter('m')).toBe('M');
  });

  it('refuse ce qui n’est pas une lettre', () => {
    for (const value of [' ', '-', '1', '', 'AB', '?', 'Enter']) {
      expect(normalizeLetter(value)).toBeNull();
    }
  });
});

describe('une partie', () => {
  it('commence avec neuf vies et le mot caché, espaces et tirets visibles', () => {
    const state = createGame('chat-huant');

    expect(state.lives).toBe(MAX_LIVES);
    expect(MAX_LIVES).toBe(9);
    expect(shown(state)).toBe('____-_____');
    expect(shown(createGame('NEUF VIES'))).toBe('____ ____');
    expect(getStatus(state)).toBe('playing');
  });

  it('une bonne lettre révèle toutes ses occurrences, accentuées ou non, sans perdre de vie', () => {
    const { state, result } = guess(createGame('ÉCAILLE DE TORTUE'), 'e');

    expect(result).toBe('correct');
    expect(state.lives).toBe(MAX_LIVES);
    expect(shown(state)).toBe('É_____E _E _____E');
  });

  it('une lettre accentuée tapée au clavier compte comme la lettre de base', () => {
    const { state, result } = guess(createGame('LITIÈRE'), 'è');

    expect(result).toBe('correct');
    expect(state.guessed.has('E')).toBe(true);
  });

  it('une mauvaise lettre coûte une vie', () => {
    const { state, result } = guess(createGame('MATOU'), 'Z');

    expect(result).toBe('wrong');
    expect(state.lives).toBe(MAX_LIVES - 1);
    expect(getWrongLetters(state)).toEqual(['Z']);
  });

  it('rejouer la même lettre ne coûte rien', () => {
    const once = guess(createGame('MATOU'), 'Z').state;
    const { state, result } = guess(once, 'z');

    expect(result).toBe('already-guessed');
    expect(state).toBe(once);
  });

  it('ignore les touches qui ne sont pas des lettres', () => {
    const initial = createGame('MATOU');

    expect(guess(initial, '5')).toEqual({ state: initial, result: 'invalid' });
  });

  it('ne modifie jamais l’état précédent', () => {
    const initial = createGame('MATOU');
    guess(initial, 'M');
    guess(initial, 'Z');

    expect(initial.guessed.size).toBe(0);
    expect(initial.lives).toBe(MAX_LIVES);
  });

  it('est gagnée quand toutes les lettres sont trouvées', () => {
    const state = play(createGame('MATOU'), 'MATOU');

    expect(getStatus(state)).toBe('won');
    expect(guess(state, 'X').result).toBe('game-over');
  });

  it('est perdue après neuf erreurs, et le mot est alors révélé', () => {
    const state = play(createGame('MATOU'), 'BCDEFGHIJ');

    expect(state.lives).toBe(0);
    expect(getStatus(state)).toBe('lost');
    expect(shown(state)).toBe('MATOU');
    expect(guess(state, 'M').result).toBe('game-over');
  });

  it('refuse un mot sans lettre', () => {
    expect(() => createGame(' - ')).toThrow();
  });
});

describe('computeScore', () => {
  it('vaut 100 + 20 par vie restante + 5 par lettre différente', () => {
    // MATOU : 5 lettres différentes, aucune erreur
    expect(computeScore(play(createGame('MATOU'), 'MATOU'))).toBe(100 + 20 * 9 + 5 * 5);
    // Deux erreurs
    expect(computeScore(play(createGame('MATOU'), 'XYMATOU'))).toBe(100 + 20 * 7 + 5 * 5);
  });

  it('vaut 0 pour une partie perdue ou en cours', () => {
    expect(computeScore(createGame('MATOU'))).toBe(0);
    expect(computeScore(play(createGame('MATOU'), 'BCDEFGHIJ'))).toBe(0);
  });
});

describe('pickWord', () => {
  it('ne retire pas deux fois de suite le même mot', () => {
    for (let i = 0; i < 50; i++) {
      expect(pickWord(['A', 'B'], 'A')).toBe('B');
    }
  });

  it('fonctionne avec un seul mot', () => {
    expect(pickWord(['A'], 'A')).toBe('A');
  });
});

describe('la liste de mots', () => {
  it('ne contient que des mots jouables, sans doublon', () => {
    expect(new Set(WORDS).size).toBe(WORDS.length);
    for (const word of WORDS) {
      expect(() => createGame(word), word).not.toThrow();
      for (const char of word) {
        expect(normalizeLetter(char) !== null || char === ' ' || char === '-', `${word} : « ${char} »`).toBe(true);
      }
    }
  });
});
