import { apiFetch } from '../api';

export interface Game {
  id: number;
  name: string;
  description: string;
  /** Niveaux de difficulté (ex. ["facile", "normal", "difficile"]) ; vide si le jeu n'en a pas. */
  levels: string[];
}

export interface SavedScore {
  id: number;
  points: number;
  level: string | null;
  date: string;
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

/** Enregistre un score ; `level` est obligatoire pour un jeu à niveaux. */
export function saveScore(gameId: number, points: number, level?: string): Promise<SavedScore> {
  return apiFetch<SavedScore>('/api/scores', { method: 'POST', body: level ? { gameId, points, level } : { gameId, points } });
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
