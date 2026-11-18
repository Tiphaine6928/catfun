import { apiFetch } from '../api';

export interface Game {
  id: number;
  name: string;
  description: string;
}

export interface SavedScore {
  id: number;
  points: number;
  date: string;
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

export function saveScore(gameId: number, points: number): Promise<SavedScore> {
  return apiFetch<SavedScore>('/api/scores', { method: 'POST', body: { gameId, points } });
}

export async function fetchBestScore(gameId: number): Promise<number | null> {
  const { best } = await apiFetch<{ best: number | null }>(`/api/me/games/${gameId}/best`);

  return best;
}
