import { fetchBestScore, findGame, levelLabel, saveScore, type Game } from './api';

export interface ScoreSaverElements {
  /** Message "Enregistrement…", "Score enregistré ✓…" ou erreur. */
  status: HTMLElement;
  /** Bouton "Réessayer", affiché seulement après un échec. */
  retry: HTMLButtonElement;
}

export interface ScoreSaver {
  /** Le jeu côté serveur (son id sert pour le classement). */
  game(): Promise<Game>;
  /** Enregistre un score et affiche le résultat (record, erreur + Réessayer). */
  /** `level` : niveau de la partie, pour un jeu à niveaux (le record affiché est celui de ce niveau). */
  save(points: number, level?: string): Promise<void>;
  /** Efface le message (nouvelle partie). */
  reset(): void;
}

/**
 * Enregistrement du score en fin de partie, commun à tous les jeux.
 * Le jeu est cherché par son nom sur le serveur (ex. "Pendu", "Mémoire").
 */
export function createScoreSaver(gameName: string, { status, retry }: ScoreSaverElements): ScoreSaver {
  let gameInfo = loadGame();
  let pending: { points: number; level?: string } | null = null;

  retry.addEventListener('click', () => {
    if (pending !== null) {
      void save(pending.points, pending.level);
    }
  });

  function loadGame(): Promise<Game> {
    const promise = findGame(gameName);
    promise.catch(() => {}); // l'erreur est affichée au moment d'enregistrer
    return promise;
  }

  async function save(points: number, level?: string): Promise<void> {
    pending = { points, level };
    retry.hidden = true;
    status.className = 'score-save';
    status.textContent = 'Enregistrement du score…';
    try {
      const game = await gameInfo;
      await saveScore(game.id, points, level);
      pending = null;
      const best = await fetchBestScore(game.id, level).catch(() => null);
      // Le record est celui du niveau joué : « Ton record en Facile : … »
      const where = level ? ` en ${levelLabel(level)}` : '';
      status.className = 'score-save score-save--ok';
      status.textContent =
        best !== null && points >= best
          ? `Score enregistré ✓ Nouveau record${where} : ${points} points !`
          : `Score enregistré ✓ Ton record${where} : ${best ?? points} points.`;
    } catch (error) {
      // Le jeu n'a peut-être pas pu être chargé : on le recharge pour le prochain essai
      gameInfo = loadGame();
      status.className = 'score-save score-save--error';
      status.textContent = `Le score n’a pas pu être enregistré. ${error instanceof Error ? error.message : ''}`.trim();
      retry.hidden = false;
    }
  }

  return {
    game: () => gameInfo,
    save,
    reset() {
      pending = null;
      retry.hidden = true;
      status.className = 'score-save';
      status.textContent = '';
    },
  };
}
