import { ApiError } from '../api';
import { claimSession, levelLabel } from './api';

/**
 * Score d'une partie gagnée sans être connecté, en attente d'inscription ou de connexion.
 * Gardé le temps de la visite (sessionStorage) ; le serveur accepte de l'enregistrer pendant 1 heure.
 */
export interface PendingScore {
  sessionId: string;
  game: string;
  level: string | null;
  points: number;
}

const KEY = 'catfun.pendingScore';

export function savePendingScore(pending: PendingScore): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(pending));
  } catch {
    // Sans stockage, le score ne pourra pas être enregistré après la connexion
  }
}

export function getPendingScore(): PendingScore | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    const pending = raw ? (JSON.parse(raw) as Partial<PendingScore>) : null;
    return pending && typeof pending.sessionId === 'string' && typeof pending.points === 'number' ? (pending as PendingScore) : null;
  } catch {
    return null;
  }
}

export function clearPendingScore(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // rien à faire
  }
}

/**
 * Juste après l'inscription ou la connexion : enregistre le score en attente, s'il y en a un.
 * Renvoie le message à afficher (succès ou échec), ou null s'il n'y avait rien à enregistrer.
 */
export async function claimPendingScore(): Promise<{ message: string; ok: boolean } | null> {
  const pending = getPendingScore();
  if (!pending) {
    return null;
  }
  clearPendingScore();

  try {
    const { score } = await claimSession(pending.sessionId);
    const where = `au ${pending.game}${pending.level ? ` (niveau ${levelLabel(pending.level)})` : ''}`;
    const points = score?.points ?? pending.points;
    const record = score?.isRecord
      ? ', c’est ton nouveau record !'
      : score?.best != null
        ? `. Ton record : ${score.best} points.`
        : '.';
    return { ok: true, message: `Score enregistré ✓ ${points} points ${where}${record}` };
  } catch (error) {
    const reason = error instanceof ApiError && error.status !== 500 ? ` ${error.message}` : '';
    return { ok: false, message: `Ton score de ${pending.points} points au ${pending.game} n’a pas pu être enregistré.${reason}` };
  }
}
