import { savePendingScore } from '../games/pending-score';

/**
 * Fin d'une partie gagnée sans être connecté : le score est gardé de côté, et on propose
 * de créer un compte ou de se connecter pour l'enregistrer (puis de revenir sur le jeu).
 */
export function offerToSaveScore(
  status: HTMLElement,
  pending: { sessionId: string; game: string; level: string | null; points: number },
  gamePath: string,
): void {
  savePendingScore(pending);
  const redirect = encodeURIComponent(gamePath);
  status.className = 'score-save score-save--guest';
  status.innerHTML = `
    <span>Sans compte, ce score n’est pas enregistré. Crée un compte ou connecte-toi dans l’heure pour le garder&nbsp;:</span>
    <span class="score-save__actions">
      <a class="button button--primary button--small" href="#/register?redirect=${redirect}">Créer un compte</a>
      <a class="button button--ghost button--small" href="#/login?redirect=${redirect}">Se connecter</a>
    </span>
  `;
}
