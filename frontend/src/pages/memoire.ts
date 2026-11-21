import { ApiError, NetworkError } from '../api';
import { findGame, flipCard, scoreMessage, startSession, type GameSession, type MemoireState } from '../games/api';
import { createMoveQueue } from '../games/move-queue';
import { renderLayout } from '../ui/layout';

/**
 * Le Mémoire, joué par le serveur : il mélange les cartes et ne révèle une carte que quand on la retourne.
 * Cette page envoie la carte cliquée et affiche ce que le serveur répond.
 */

/** Temps pendant lequel deux cartes différentes restent visibles. */
const MISMATCH_DELAY_MS = 1000;

/** Niveaux (le nombre de paires est fixé par le serveur ; ici, l'affichage). */
const LEVELS = {
  facile: { label: 'Facile', pairs: 6, columns: 4 },
  normal: { label: 'Normal', pairs: 8, columns: 4 },
  difficile: { label: 'Difficile', pairs: 12, columns: 6 },
} as const;
type Level = keyof typeof LEVELS;

const TEMPLATE = `
  <div class="memoire">
    <div class="pendu__header">
      <h1>Mémoire</h1>
      <button type="button" class="button button--ghost button--small new-game">Nouvelle partie</button>
    </div>
    <p class="page__intro">Retourne les cartes deux par deux et retrouve toutes les paires de chats, en un minimum de coups !</p>

    <div class="alert alert--error" role="alert" hidden></div>

    <nav class="tabs" aria-label="Niveau de difficulté"></nav>

    <p class="memoire__stats" aria-live="off"></p>

    <div class="memoire__grid" role="grid" aria-label="Cartes" aria-busy="true"></div>
    <p class="pendu__hint">Astuce : au clavier, déplace-toi avec les flèches et retourne une carte avec Entrée ou Espace.</p>

    <section class="pendu__result game-result" hidden aria-labelledby="result-title">
      <h2 id="result-title" tabindex="-1"></h2>
      <p class="game-result__detail"></p>
      <p class="pendu__result-score"></p>
      <p class="score-save" aria-live="polite"></p>
      <button type="button" class="button button--primary replay">Rejouer</button>
      <a class="button button--ghost leaderboard-link" href="#/classement">Voir le classement</a>
    </section>

    <p class="visually-hidden" aria-live="assertive" data-announce></p>
  </div>
`;

function isLevel(value: string | null): value is Level {
  return value !== null && value in LEVELS;
}

export function renderMemoire(container: HTMLElement, params: URLSearchParams): () => void {
  const page = renderLayout(container, '/memoire');
  page.innerHTML = TEMPLATE;

  const requested = params.get('niveau');
  const level: Level = isLevel(requested) ? requested : 'normal';
  const { columns } = LEVELS[level];

  const $ = <T extends HTMLElement>(selector: string) => page.querySelector<T>(selector)!;
  const alert = $('.alert');
  const stats = $('.memoire__stats');
  const grid = $('.memoire__grid');
  const hint = $('.pendu__hint');
  const result = $('.game-result');
  const resultTitle = $('#result-title');
  const resultDetail = $('.game-result__detail');
  const resultScore = $('.pendu__result-score');
  const scoreStatus = $('.score-save');
  const announcer = $('[data-announce]');

  // Onglets de niveau : changer de niveau relance une partie (via l'URL)
  $('.tabs').replaceChildren(
    ...(Object.entries(LEVELS) as [Level, (typeof LEVELS)[Level]][]).map(([key, info]) => {
      const link = document.createElement('a');
      link.className = 'tabs__tab';
      link.href = `#/memoire?niveau=${key}`;
      link.textContent = `${info.label} · ${info.pairs} paires`;
      if (key === level) {
        link.setAttribute('aria-current', 'page');
      }
      return link;
    }),
  );

  grid.dataset.level = level;
  grid.style.setProperty('--columns', String(columns));

  const queue = createMoveQueue();
  let session: GameSession<MemoireState> | null = null;
  /** Cartes différentes déjà recachées à l'écran (le serveur les cache au coup suivant). */
  let hiddenLocally = new Set<number>();
  let hideTimer: number | undefined;
  let buttons: HTMLButtonElement[] = [];
  let focused = 0;
  let left = false;

  grid.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.card-tile');
    if (button) {
      play(Number(button.dataset.index));
    }
  });
  grid.addEventListener('keydown', onGridKeydown);
  // La navigation aux flèches part de la carte qui a le focus (souris, Tab ou flèches)
  grid.addEventListener('focusin', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.card-tile');
    if (button) {
      setFocusable(Number(button.dataset.index));
    }
  });

  $('.new-game').addEventListener('click', () => void newGame());
  $('.replay').addEventListener('click', () => void newGame(true));

  void newGame();

  // Nettoyage quand on quitte la page
  return () => {
    left = true;
    window.clearTimeout(hideTimer);
  };

  async function newGame(focusGrid = false): Promise<void> {
    window.clearTimeout(hideTimer);
    hideAlert();
    grid.setAttribute('aria-busy', 'true');
    try {
      const game = await findGame('Mémoire');
      $<HTMLAnchorElement>('.leaderboard-link').setAttribute('href', `#/classement?jeu=${game.id}&niveau=${level}`);
      const started = await queue(() => startSession<MemoireState>(game.id, level));
      if (left) {
        return;
      }
      session = started;
    } catch (error) {
      showError(error, 'Impossible de commencer une partie.');
      return;
    } finally {
      grid.setAttribute('aria-busy', 'false');
    }

    hiddenLocally = new Set();
    focused = 0;
    result.hidden = true;
    hint.hidden = false;
    buildGrid(session.state.cards.length);
    update();
    announce(`Nouvelle partie : ${session.state.totalPairs} paires à retrouver.`);
    if (focusGrid) {
      buttons[0]?.focus();
    }
  }

  function buildGrid(count: number): void {
    buttons = Array.from({ length: count }, (_, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'card-tile';
      button.dataset.index = String(index);
      button.tabIndex = index === focused ? 0 : -1;
      button.innerHTML = `
        <span class="card-tile__inner" aria-hidden="true">
          <span class="card-tile__face card-tile__back">?</span>
          <span class="card-tile__face card-tile__front"></span>
        </span>`;
      return button;
    });

    // Une rangée par ligne de la grille pour les lecteurs d'écran (role="grid")
    const rows: HTMLDivElement[] = [];
    buttons.forEach((button, i) => {
      if (i % columns === 0) {
        const row = document.createElement('div');
        row.setAttribute('role', 'row');
        row.className = 'memoire__row';
        rows.push(row);
      }
      const cell = document.createElement('div');
      cell.setAttribute('role', 'gridcell');
      cell.append(button);
      rows[rows.length - 1].append(cell);
    });
    grid.replaceChildren(...rows);
  }

  function isVisible(index: number): boolean {
    const card = session?.state.cards[index];
    return !!card && (card.matched || (card.faceUp && !hiddenLocally.has(index)));
  }

  function play(index: number): void {
    const current = session;
    const card = current?.state.cards[index];
    if (!current || !card || current.status !== 'playing' || card.matched) {
      return;
    }
    // Carte déjà retournée et seule visible : rien à faire. En revanche, cliquer l'une des deux cartes
    // différentes encore visibles est permis : le serveur les recache et retourne celle-ci.
    const faceUp = current.state.cards.filter((c) => c.faceUp).length;
    if (card.faceUp && faceUp === 1) {
      return;
    }

    void queue(() => flipCard(current.id, index))
      .then((next) => {
        if (left || session?.id !== next.id) {
          return;
        }
        hideAlert();
        window.clearTimeout(hideTimer);
        hiddenLocally = new Set();
        session = next;
        focused = index;
        update();

        const card = next.state.cards[index];
        const label = card.symbol?.label ?? 'carte';
        if (next.result === 'first') {
          announce(`${label}.`);
        } else if (next.result === 'match') {
          announce(`${label} : paire trouvée ! ${next.state.pairsFound} sur ${next.state.totalPairs}.`);
        } else if (next.result === 'mismatch') {
          const other = next.state.cards.find((c) => c.faceUp && c.index !== index);
          announce(`${label}. Pas de chance, ce n’est pas le même que ${other?.symbol?.label ?? 'l’autre carte'}.`);
          // À l'écran seulement : le serveur les cachera au prochain coup
          const pair = next.state.cards.filter((c) => c.faceUp).map((c) => c.index);
          hideTimer = window.setTimeout(() => {
            hiddenLocally = new Set(pair);
            update();
          }, MISMATCH_DELAY_MS);
        }

        if (next.status === 'won') {
          finish();
        }
      })
      .catch((error: unknown) => showError(error, 'La carte n’a pas pu être retournée.'));
  }

  function update(): void {
    if (!session) {
      return;
    }
    const state = session.state;
    stats.textContent = `Paires : ${state.pairsFound} / ${state.totalPairs} · Coups : ${state.moves} · Erreurs : ${state.mistakes}`;
    const mismatch = state.cards.filter((c) => c.faceUp).length === 2;

    for (const card of state.cards) {
      const button = buttons[card.index];
      const visible = isVisible(card.index);
      button.querySelector('.card-tile__front')!.textContent = visible ? (card.symbol?.emoji ?? '') : '';
      button.classList.toggle('card-tile--up', visible);
      button.classList.toggle('card-tile--matched', card.matched);
      button.classList.toggle('card-tile--miss', visible && mismatch && card.faceUp);
      button.setAttribute('aria-disabled', String(card.matched || visible));
      button.setAttribute(
        'aria-label',
        `Carte ${card.index + 1} : ${card.matched ? `${card.symbol?.label}, paire trouvée` : visible ? card.symbol?.label : 'face cachée'}`,
      );
      button.tabIndex = card.index === focused ? 0 : -1;
    }
  }

  function finish(): void {
    if (!session) {
      return;
    }
    const { state, score } = session;
    const bonus = score ? score.points - 50 * state.totalPairs : 0;

    hint.hidden = true;
    result.hidden = false;
    result.className = 'pendu__result game-result pendu__result--won';
    resultTitle.textContent = state.mistakes === 0 ? 'Parfait, aucune erreur ! 😻' : 'Bravo, toutes les paires sont trouvées ! 🎉';
    resultDetail.textContent = `${state.totalPairs} paires en ${state.moves} coups (${state.mistakes} erreur${state.mistakes > 1 ? 's' : ''}).`;
    if (score) {
      // Score calculé et enregistré par le serveur
      resultScore.textContent = `Score : ${score.points} points (50 × ${state.totalPairs} paires + bonus de précision de ${bonus})`;
      scoreStatus.className = 'score-save score-save--ok';
      scoreStatus.textContent = scoreMessage(score, level);
    }
    announce(`${resultTitle.textContent} ${resultDetail.textContent}`);
    resultTitle.focus();
  }

  /** Flèches : déplacement dans la grille ; Début / Fin : première / dernière carte. */
  function onGridKeydown(event: KeyboardEvent): void {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
    let target: number | null = null;
    if (event.key in moves) {
      target = focused + moves[event.key];
    } else if (event.key === 'Home') {
      target = 0;
    } else if (event.key === 'End') {
      target = buttons.length - 1;
    }
    if (target === null || target < 0 || target >= buttons.length) {
      return;
    }
    event.preventDefault();
    setFocusable(target);
    buttons[target].focus();
  }

  /** Une seule carte est atteignable avec Tab : celle où l'on se trouve dans la grille. */
  function setFocusable(index: number): void {
    focused = index;
    for (const [i, button] of buttons.entries()) {
      button.tabIndex = i === focused ? 0 : -1;
    }
  }

  function showError(error: unknown, fallback: string): void {
    if (left) {
      return;
    }
    // Un token refusé renvoie déjà à la connexion (voir main.ts)
    if (error instanceof ApiError && error.status === 401) {
      return;
    }
    alert.textContent =
      error instanceof NetworkError ? `${fallback} Vérifie ta connexion, puis réessaie.` : error instanceof Error ? `${fallback} ${error.message}` : fallback;
    alert.hidden = false;
  }

  function hideAlert(): void {
    alert.hidden = true;
    alert.textContent = '';
  }

  function announce(message: string): void {
    announcer.textContent = '';
    window.setTimeout(() => (announcer.textContent = message), 50);
  }
}
