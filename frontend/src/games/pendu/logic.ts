/**
 * Règles du Pendu, sans aucun lien avec l'affichage (testées dans logic.test.ts).
 * L'état est immuable : chaque coup renvoie un nouvel état.
 */

/** Un chat a neuf vies : 9 erreurs autorisées. */
export const MAX_LIVES = 9;

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export type GameStatus = 'playing' | 'won' | 'lost';
export type GuessResult = 'correct' | 'wrong' | 'already-guessed' | 'invalid' | 'game-over';

export interface PenduState {
  /** Mot à deviner, tel qu'il s'affiche (majuscules, avec accents). */
  readonly word: string;
  /** Lettres déjà proposées (A–Z, sans accents). */
  readonly guessed: ReadonlySet<string>;
  readonly lives: number;
  readonly maxLives: number;
}

/** Une case du mot affiché. `letter` vaut null pour une espace ou un tiret. */
export interface WordCell {
  readonly char: string;
  readonly letter: string | null;
  readonly revealed: boolean;
}

/** "É" → "E", "à" → "A", "ç" → "C"… Renvoie null si ce n'est pas une lettre. */
export function normalizeLetter(char: string): string | null {
  if ([...char].length !== 1) {
    return null;
  }
  const base = char.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();

  return /^[A-Z]$/.test(base) ? base : null;
}

export function createGame(word: string, maxLives = MAX_LIVES): PenduState {
  const normalized = word.trim().toUpperCase();
  if (lettersOf(normalized).size === 0) {
    throw new Error(`Le mot « ${word} » ne contient aucune lettre à deviner.`);
  }

  return { word: normalized, guessed: new Set(), lives: maxLives, maxLives };
}

/** Propose une lettre (accents et minuscules acceptés). */
export function guess(state: PenduState, input: string): { state: PenduState; result: GuessResult } {
  if (getStatus(state) !== 'playing') {
    return { state, result: 'game-over' };
  }

  const letter = normalizeLetter(input);
  if (letter === null) {
    return { state, result: 'invalid' };
  }
  if (state.guessed.has(letter)) {
    return { state, result: 'already-guessed' };
  }

  const guessed = new Set(state.guessed).add(letter);
  const correct = lettersOf(state.word).has(letter);

  return {
    state: { ...state, guessed, lives: correct ? state.lives : state.lives - 1 },
    result: correct ? 'correct' : 'wrong',
  };
}

export function getStatus(state: PenduState): GameStatus {
  if (state.lives <= 0) {
    return 'lost';
  }
  for (const letter of lettersOf(state.word)) {
    if (!state.guessed.has(letter)) {
      return 'playing';
    }
  }

  return 'won';
}

/** Le mot case par case. Une fois la partie perdue, tout est révélé. */
export function getCells(state: PenduState): WordCell[] {
  const revealAll = getStatus(state) === 'lost';

  return [...state.word].map((char) => {
    const letter = normalizeLetter(char);

    return { char, letter, revealed: letter === null || revealAll || state.guessed.has(letter) };
  });
}

/** Lettres proposées qui ne sont pas dans le mot. */
export function getWrongLetters(state: PenduState): string[] {
  const letters = lettersOf(state.word);

  return [...state.guessed].filter((letter) => !letters.has(letter));
}

/**
 * Score d'une partie gagnée (0 si perdue ou en cours) :
 * 100 points + 20 par vie restante + 5 par lettre différente du mot.
 * Un mot long trouvé sans erreur rapporte donc le plus.
 */
export function computeScore(state: PenduState): number {
  if (getStatus(state) !== 'won') {
    return 0;
  }

  return 100 + 20 * state.lives + 5 * lettersOf(state.word).size;
}

/** Tire un mot au hasard, différent du précédent si possible. */
export function pickWord(words: readonly string[], previous: string | null = null, random: () => number = Math.random): string {
  if (words.length === 0) {
    throw new Error('Aucun mot disponible.');
  }
  const candidates = words.length > 1 ? words.filter((word) => word !== previous) : words;

  return candidates[Math.floor(random() * candidates.length)];
}

function lettersOf(word: string): Set<string> {
  const letters = new Set<string>();
  for (const char of word) {
    const letter = normalizeLetter(char);
    if (letter) {
      letters.add(letter);
    }
  }

  return letters;
}
