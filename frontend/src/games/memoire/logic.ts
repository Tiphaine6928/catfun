/**
 * Règles du jeu de Mémoire, sans aucun lien avec l'affichage (testées dans logic.test.ts).
 * L'état est immuable : chaque action renvoie un nouvel état.
 */
import type { CardSymbol } from './symbols';

export type Level = 'facile' | 'normal' | 'difficile';

export const LEVELS: Readonly<Record<Level, { pairs: number; label: string; columns: number }>> = {
  facile: { pairs: 6, label: 'Facile', columns: 4 },
  normal: { pairs: 8, label: 'Normal', columns: 4 },
  difficile: { pairs: 12, label: 'Difficile', columns: 6 },
};

export interface Card {
  /** Position de la carte, de 0 à n-1. */
  readonly index: number;
  /** Les deux cartes d'une paire ont la même valeur. */
  readonly pair: number;
  readonly symbol: CardSymbol;
  readonly matched: boolean;
}

export interface MemoireState {
  readonly cards: readonly Card[];
  /** Cartes retournées et pas encore appariées (0, 1 ou 2). */
  readonly faceUp: readonly number[];
  /** Un coup = deux cartes retournées. */
  readonly moves: number;
}

export type FlipResult = 'first' | 'match' | 'mismatch' | 'ignored';

/** Mélange de Fisher-Yates (le hasard est injectable pour les tests). */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/** Crée une partie : `pairs` symboles tirés au hasard, chacun en deux exemplaires, mélangés. */
export function createGame(symbols: readonly CardSymbol[], pairs: number, random: () => number = Math.random): MemoireState {
  if (pairs < 1 || pairs > symbols.length) {
    throw new Error(`Impossible de créer ${pairs} paires avec ${symbols.length} symboles.`);
  }

  const chosen = shuffle(symbols, random).slice(0, pairs);
  const deck = shuffle(
    chosen.flatMap((symbol, pair) => [
      { pair, symbol },
      { pair, symbol },
    ]),
    random,
  );

  return {
    cards: deck.map((card, index) => ({ ...card, index, matched: false })),
    faceUp: [],
    moves: 0,
  };
}

/**
 * Retourne une carte.
 * Si deux cartes différentes sont encore visibles, elles sont d'abord cachées :
 * le joueur n'a pas besoin d'attendre pour continuer.
 */
export function flip(state: MemoireState, index: number): { state: MemoireState; result: FlipResult } {
  const card = state.cards[index];
  if (!card || card.matched || isFinished(state)) {
    return { state, result: 'ignored' };
  }

  const current = state.faceUp.length === 2 ? hideMismatch(state) : state;
  if (current.faceUp.includes(index)) {
    return { state, result: 'ignored' };
  }

  if (current.faceUp.length === 0) {
    return { state: { ...current, faceUp: [index] }, result: 'first' };
  }

  const first = current.cards[current.faceUp[0]];
  const moves = current.moves + 1;

  if (first.pair === card.pair) {
    const cards = current.cards.map((c) => (c.pair === card.pair ? { ...c, matched: true } : c));

    return { state: { cards, faceUp: [], moves }, result: 'match' };
  }

  return { state: { ...current, faceUp: [first.index, index], moves }, result: 'mismatch' };
}

/** Cache les deux cartes différentes encore visibles. */
export function hideMismatch(state: MemoireState): MemoireState {
  return state.faceUp.length === 2 ? { ...state, faceUp: [] } : state;
}

export function isFaceUp(state: MemoireState, index: number): boolean {
  return state.cards[index].matched || state.faceUp.includes(index);
}

export function pairsFound(state: MemoireState): number {
  return state.cards.filter((c) => c.matched).length / 2;
}

export function totalPairs(state: MemoireState): number {
  return state.cards.length / 2;
}

export function isFinished(state: MemoireState): boolean {
  return state.cards.every((c) => c.matched);
}

/** Erreurs = coups en trop par rapport à une partie parfaite (un coup par paire). */
export function mistakes(state: MemoireState): number {
  return Math.max(0, state.moves - pairsFound(state));
}

/**
 * Score d'une partie terminée (0 sinon) :
 * 50 points par paire + bonus de précision de 50 par paire, moins 10 par erreur (jamais négatif).
 * Facile : 600 points au maximum, Normal : 800, Difficile : 1200.
 */
export function computeScore(state: MemoireState): number {
  if (!isFinished(state)) {
    return 0;
  }
  const pairs = totalPairs(state);

  return 50 * pairs + Math.max(0, 50 * pairs - 10 * mistakes(state));
}
