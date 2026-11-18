import { describe, expect, it } from 'vitest';
import {
  computeScore,
  createGame,
  flip,
  hideMismatch,
  isFaceUp,
  isFinished,
  LEVELS,
  mistakes,
  pairsFound,
  shuffle,
  type MemoireState,
} from './logic';
import { SYMBOLS } from './symbols';

/** Générateur pseudo-aléatoire reproductible. */
function seeded(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/** Indices des deux cartes de chaque paire. */
function pairsOf(state: MemoireState): number[][] {
  const byPair = new Map<number, number[]>();
  for (const card of state.cards) {
    byPair.set(card.pair, [...(byPair.get(card.pair) ?? []), card.index]);
  }
  return [...byPair.values()];
}

function playPerfectly(state: MemoireState): MemoireState {
  for (const [a, b] of pairsOf(state)) {
    state = flip(flip(state, a).state, b).state;
  }
  return state;
}

/** Deux cartes qui ne vont pas ensemble. */
function mismatchedCards(state: MemoireState): [number, number] {
  const [[a], [b]] = pairsOf(state);
  return [a, b];
}

describe('shuffle', () => {
  it('garde les mêmes éléments et ne modifie pas la liste d’origine', () => {
    const items = [1, 2, 3, 4, 5, 6];
    const result = shuffle(items, seeded(1));

    expect([...result].sort()).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('produit tous les ordres possibles', () => {
    const seen = new Set<string>();
    const random = seeded(7);
    for (let i = 0; i < 500; i++) {
      seen.add(shuffle([1, 2, 3], random).join(''));
    }
    expect(seen.size).toBe(6);
  });
});

describe('createGame', () => {
  it.each(Object.entries(LEVELS))('niveau %s : chaque symbole apparaît exactement deux fois', (_, { pairs }) => {
    const state = createGame(SYMBOLS, pairs, seeded(3));

    expect(state.cards).toHaveLength(pairs * 2);
    expect(pairsOf(state).every((p) => p.length === 2)).toBe(true);
    expect(new Set(state.cards.map((c) => c.symbol.emoji)).size).toBe(pairs);
    expect(state.cards.map((c) => c.index)).toEqual([...Array(pairs * 2).keys()]);
    expect(state.moves).toBe(0);
  });

  it('refuse plus de paires que de symboles', () => {
    expect(() => createGame(SYMBOLS, SYMBOLS.length + 1)).toThrow();
    expect(() => createGame(SYMBOLS, 0)).toThrow();
  });

  it('a assez de symboles distincts pour le niveau le plus difficile', () => {
    expect(new Set(SYMBOLS.map((s) => s.emoji)).size).toBe(SYMBOLS.length);
    expect(SYMBOLS.length).toBeGreaterThanOrEqual(Math.max(...Object.values(LEVELS).map((l) => l.pairs)));
  });
});

describe('flip', () => {
  it('une paire trouvée reste visible et compte un coup', () => {
    const state = createGame(SYMBOLS, 6, seeded(5));
    const [a, b] = pairsOf(state)[0];

    const first = flip(state, a);
    expect(first.result).toBe('first');
    expect(isFaceUp(first.state, a)).toBe(true);

    const second = flip(first.state, b);
    expect(second.result).toBe('match');
    expect(second.state.moves).toBe(1);
    expect(pairsFound(second.state)).toBe(1);
    expect(isFaceUp(second.state, a) && isFaceUp(second.state, b)).toBe(true);
  });

  it('deux cartes différentes restent visibles jusqu’à hideMismatch', () => {
    const state = createGame(SYMBOLS, 6, seeded(5));
    const [a, b] = mismatchedCards(state);

    const { state: after, result } = flip(flip(state, a).state, b);
    expect(result).toBe('mismatch');
    expect(after.moves).toBe(1);
    expect(isFaceUp(after, a) && isFaceUp(after, b)).toBe(true);

    const hidden = hideMismatch(after);
    expect(isFaceUp(hidden, a) || isFaceUp(hidden, b)).toBe(false);
  });

  it('retourner une 3e carte cache d’abord les deux cartes différentes', () => {
    const state = createGame(SYMBOLS, 6, seeded(5));
    const [a, b] = mismatchedCards(state);
    const c = state.cards.findIndex((card) => card.index !== a && card.index !== b);

    const { state: after, result } = flip(flip(flip(state, a).state, b).state, c);
    expect(result).toBe('first');
    expect(after.faceUp).toEqual([c]);
  });

  it('ignore une carte déjà retournée, déjà trouvée ou inexistante', () => {
    const state = createGame(SYMBOLS, 6, seeded(5));
    const [a, b] = pairsOf(state)[0];
    const once = flip(state, a).state;

    expect(flip(once, a)).toEqual({ state: once, result: 'ignored' });
    const matched = flip(once, b).state;
    expect(flip(matched, a).result).toBe('ignored');
    expect(flip(state, 99).result).toBe('ignored');
    expect(flip(state, -1).result).toBe('ignored');
  });

  it('ne modifie jamais l’état précédent', () => {
    const state = createGame(SYMBOLS, 6, seeded(5));
    playPerfectly(state);

    expect(state.moves).toBe(0);
    expect(state.faceUp).toEqual([]);
    expect(state.cards.every((c) => !c.matched)).toBe(true);
  });
});

describe('fin de partie et score', () => {
  it('une partie parfaite rapporte le maximum : 100 points par paire', () => {
    for (const { pairs } of Object.values(LEVELS)) {
      const state = playPerfectly(createGame(SYMBOLS, pairs, seeded(pairs)));
      expect(isFinished(state)).toBe(true);
      expect(mistakes(state)).toBe(0);
      expect(computeScore(state)).toBe(100 * pairs);
    }
  });

  it('chaque erreur retire 10 points, sans descendre sous 50 par paire', () => {
    let state = createGame(SYMBOLS, 6, seeded(9));
    const [a, b] = mismatchedCards(state);
    state = flip(flip(state, a).state, b).state; // 1 erreur
    state = flip(flip(state, a).state, b).state; // 2 erreurs
    state = playPerfectly(hideMismatch(state));

    expect(mistakes(state)).toBe(2);
    expect(computeScore(state)).toBe(50 * 6 + 50 * 6 - 20);

    let sloppy = createGame(SYMBOLS, 6, seeded(9));
    for (let i = 0; i < 40; i++) {
      sloppy = flip(flip(sloppy, a).state, b).state;
    }
    expect(computeScore(playPerfectly(hideMismatch(sloppy)))).toBe(50 * 6);
  });

  it('vaut 0 tant que la partie n’est pas terminée, et plus rien ne bouge ensuite', () => {
    const state = createGame(SYMBOLS, 6, seeded(2));
    expect(computeScore(state)).toBe(0);

    const done = playPerfectly(state);
    expect(flip(done, 0).result).toBe('ignored');
  });
});
