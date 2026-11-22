import { apiFetch } from '../api';

export interface Game {
  id: number;
  name: string;
  description: string;
  /** Niveaux de difficulté (ex. ["facile", "normal", "difficile"]) ; vide si le jeu n'en a pas. */
  levels: string[];
}


/** Nom affiché d'un niveau ("facile" → "Facile"). */
export function levelLabel(level: string): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

/** Paramètre d'URL pour un niveau facultatif. */
function levelQuery(level: string | null | undefined, separator: '?' | '&'): string {
  return level ? `${separator}level=${encodeURIComponent(level)}` : '';
}

let gamesCache: Promise<Game[]> | null = null;

/** Liste des jeux (chargée une seule fois). */
export function fetchGames(): Promise<Game[]> {
  gamesCache ??= apiFetch<Game[]>('/api/games', { auth: false }).catch((error: unknown) => {
    gamesCache = null; // on réessaiera au prochain appel
    throw error;
  });

  return gamesCache;
}

/** Retrouve un jeu par son nom (ex. "Pendu"). */
export async function findGame(name: string): Promise<Game> {
  const game = (await fetchGames()).find((g) => g.name === name);
  if (!game) {
    throw new Error(`Le jeu « ${name} » n’existe pas encore sur le serveur. As-tu lancé les migrations ?`);
  }

  return game;
}

/** Meilleur score du joueur connecté, à un niveau donné ou tous niveaux confondus. */
export async function fetchBestScore(gameId: number, level?: string | null): Promise<number | null> {
  const { best } = await apiFetch<{ best: number | null }>(`/api/me/games/${gameId}/best${levelQuery(level, '?')}`);

  return best;
}

export interface LeaderboardEntry {
  rank: number;
  id: number;
  points: number;
  date: string;
  player: string;
}

export interface Leaderboard {
  game: { id: number; name: string; levels: string[] };
  /** Niveau du classement, null pour tous niveaux confondus. */
  level: string | null;
  totalPlayers: number;
  scores: LeaderboardEntry[];
}

/** Classement public d'un jeu : le meilleur score de chaque joueur (à un niveau donné, ou tous niveaux). */
export function fetchLeaderboard(gameId: number, limit = 20, level?: string | null): Promise<Leaderboard> {
  return apiFetch<Leaderboard>(`/api/games/${gameId}/leaderboard?limit=${limit}${levelQuery(level, '&')}`, { auth: false });
}

/** Page de chaque jeu jouable (les autres sont "bientôt disponibles"). */
export const GAME_PAGES: Readonly<Record<string, string>> = {
  Pendu: '/pendu',
  Mémoire: '/memoire',
};

// ---------------------------------------------------------------------------
// Parties jouées par le serveur (anti-triche)
// Le serveur choisit le mot / mélange les cartes, applique chaque coup et enregistre le score.
// ---------------------------------------------------------------------------

export type SessionStatus = 'playing' | 'won' | 'lost';

/** Score calculé et enregistré par le serveur à la victoire. */
export interface SessionScore {
  points: number;
  best: number | null;
  isRecord: boolean;
}

export interface GameSession<State> {
  id: string;
  game: { id: number; name: string };
  level: string | null;
  status: SessionStatus;
  state: State;
  score: SessionScore | null;
  /** Résultat du dernier coup (absent au démarrage). */
  result?: string;
}

export interface PenduCell {
  /** Caractère affiché, null pour une lettre pas encore trouvée. */
  char: string | null;
  /** false pour une espace ou un tiret. */
  letter: boolean;
  revealed: boolean;
  /** Lettre non trouvée, révélée à la défaite. */
  missed: boolean;
}

export interface PenduState {
  cells: PenduCell[];
  lives: number;
  maxLives: number;
  guessed: string[];
  wrong: string[];
  status: SessionStatus;
  /** Le mot, seulement une fois la partie finie. */
  word: string | null;
}

export interface MemoireCard {
  index: number;
  /** Symbole, seulement pour une carte retournée. */
  symbol: { emoji: string; label: string } | null;
  matched: boolean;
  faceUp: boolean;
}

export interface MemoireState {
  level: string;
  cards: MemoireCard[];
  pairsFound: number;
  totalPairs: number;
  moves: number;
  mistakes: number;
  status: SessionStatus;
}

/** Commence une partie ; `level` est obligatoire pour un jeu à niveaux. */
export function startSession<State>(gameId: number, level?: string): Promise<GameSession<State>> {
  return apiFetch<GameSession<State>>(`/api/games/${gameId}/sessions`, { method: 'POST', body: level ? { level } : {} });
}

/** Pendu : propose une lettre. */
export function guessLetter(sessionId: string, letter: string): Promise<GameSession<PenduState>> {
  return apiFetch<GameSession<PenduState>>(`/api/sessions/${sessionId}/guess`, { method: 'POST', body: { letter } });
}

/** Mémoire : retourne une carte. */
export function flipCard(sessionId: string, index: number): Promise<GameSession<MemoireState>> {
  return apiFetch<GameSession<MemoireState>>(`/api/sessions/${sessionId}/flip`, { method: 'POST', body: { index } });
}

/** Message de fin de partie sur le score enregistré par le serveur. */
export function scoreMessage(score: SessionScore, level?: string | null): string {
  const where = level ? ` en ${levelLabel(level)}` : '';

  return score.isRecord
    ? `Score enregistré ✓ Nouveau record${where} : ${score.points} points !`
    : `Score enregistré ✓ Ton record${where} : ${score.best ?? score.points} points.`;
}


// ---------------------------------------------------------------------------
// Profil
// ---------------------------------------------------------------------------

export interface GameStats {
  game: { id: number; name: string; levels: string[] };
  /** Meilleur score par niveau (un seul enregistrement, level = null, pour un jeu sans niveaux). */
  records: { level: string | null; best: number | null }[];
  /** Parties terminées (gagnées ou perdues) et gagnées. */
  played: number;
  won: number;
}

export interface HistoryEntry {
  id: number;
  points: number;
  level: string | null;
  date: string;
  game: { id: number; name: string };
}

/** Records et parties jouées de l'utilisateur connecté, pour chaque jeu. */
export async function fetchMyStats(): Promise<GameStats[]> {
  const { games } = await apiFetch<{ games: GameStats[] }>('/api/me/stats');

  return games;
}

/** Derniers scores de l'utilisateur connecté, du plus récent au plus ancien. */
export function fetchMyHistory(limit = 10): Promise<HistoryEntry[]> {
  return apiFetch<HistoryEntry[]>(`/api/me/scores?limit=${limit}`);
}
