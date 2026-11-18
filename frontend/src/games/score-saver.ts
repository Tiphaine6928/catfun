import { fetchBestScore, findGame, saveScore, type Game } from './api';

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
  save(points: number): Promise<void>;
  /** Efface le message (nouvelle partie). */
  reset(): void;
}

/**
 * Enregistrement du score en fin de partie, commun à tous les jeux.
 * Le jeu est cherché par son nom sur le serveur (ex. "Pendu", "Mémoire").
 */
export function createScoreSaver(gameName: string, { status, retry }: ScoreSaverElements): ScoreSaver {
  let gameInfo = loadGame();
  let pending: number | null = null;

  retry.addEventListener('click', () => {
    if (pending !== null) {
      void save(pending);
    }
  });

  function loadGame(): Promise<Game> {
    const promise = findGame(gameName);
    promise.catch(() => {}); // l'erreur est affichée au moment d'enregistrer
    return promise;
  }

  async function save(points: number): Promise<void> {
    pending = points;
    retry.hidden = true;
    status.className = 'score-save';
    status.textContent = 'Enregistrement du score…';
    try {
      const game = await gameInfo;
      await saveScore(game.id, points);
      pending = null;
      const best = await fetchBestScore(game.id).catch(() => null);
      status.className = 'score-save score-save--ok';
      status.textContent =
        best !== null && points >= best
          ? `Score enregistré ✓ Nouveau record : ${points} points !`
          : `Score enregistré ✓ Ton record : ${best ?? points} points.`;
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
