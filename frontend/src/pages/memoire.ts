import {
  computeScore,
  createGame,
  flip,
  hideMismatch,
  isFaceUp,
  isFinished,
  LEVELS,
  mistakes,
  pairsFound,
  totalPairs,
  type Level,
  type MemoireState,
} from '../games/memoire/logic';
import { SYMBOLS } from '../games/memoire/symbols';
import { createScoreSaver } from '../games/score-saver';
import { renderLayout } from '../ui/layout';

/** Temps pendant lequel deux cartes différentes restent visibles. */
const MISMATCH_DELAY_MS = 1000;

const TEMPLATE = `
  <div class="memoire">
    <div class="pendu__header">
      <h1>Mémoire</h1>
      <button type="button" class="button button--ghost button--small new-game">Nouvelle partie</button>
    </div>
    <p class="page__intro">Retourne les cartes deux par deux et retrouve toutes les paires de chats, en un minimum de coups !</p>

    <div class="alert alert--info" role="status" hidden></div>

    <nav class="tabs" aria-label="Niveau de difficulté"></nav>

    <p class="memoire__stats" aria-live="off"></p>

    <div class="memoire__grid" role="grid" aria-label="Cartes"></div>
    <p class="pendu__hint">Astuce : au clavier, déplace-toi avec les flèches et retourne une carte avec Entrée ou Espace.</p>

    <section class="pendu__result game-result" hidden aria-labelledby="result-title">
      <h2 id="result-title" tabindex="-1"></h2>
      <p class="game-result__detail"></p>
      <p class="pendu__result-score"></p>
      <p class="score-save" aria-live="polite"></p>
      <button type="button" class="button button--ghost button--small retry-save" hidden>Réessayer l’enregistrement</button>
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
  const { pairs, columns } = LEVELS[level];

  const $ = <T extends HTMLElement>(selector: string) => page.querySelector<T>(selector)!;
  const alert = $('.alert');
  const stats = $('.memoire__stats');
  const grid = $('.memoire__grid');
  const hint = $('.pendu__hint');
  const result = $('.game-result');
  const resultTitle = $('#result-title');
  const resultDetail = $('.game-result__detail');
  const resultScore = $('.pendu__result-score');
  const announcer = $('[data-announce]');
  const scores = createScoreSaver('Mémoire', { status: $('.score-save'), retry: $<HTMLButtonElement>('.retry-save') });

  scores
    .game()
    .then((game) => $<HTMLAnchorElement>('.leaderboard-link').setAttribute('href', `#/classement?jeu=${game.id}&niveau=${level}`))
    .catch((error: unknown) => {
      alert.textContent = error instanceof Error ? error.message : 'Impossible de charger le jeu.';
      alert.hidden = false;
    });

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

  let state: MemoireState;
  let hideTimer: number | undefined;
  let buttons: HTMLButtonElement[] = [];
  let focused = 0;

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

  $('.new-game').addEventListener('click', () => newGame());
  $('.replay').addEventListener('click', () => newGame(true));

  newGame();

  // Nettoyage quand on quitte la page
  return () => window.clearTimeout(hideTimer);

  function newGame(focusGrid = false): void {
    window.clearTimeout(hideTimer);
    state = createGame(SYMBOLS, pairs);
    focused = 0;
    scores.reset();
    result.hidden = true;
    hint.hidden = false;
    buildGrid();
    update();
    announce(`Nouvelle partie : ${pairs} paires à retrouver.`);
    if (focusGrid) {
      buttons[0]?.focus();
    }
  }

  function buildGrid(): void {
    buttons = state.cards.map((card) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'card-tile';
      button.dataset.index = String(card.index);
      button.tabIndex = card.index === focused ? 0 : -1;
      button.innerHTML = `
        <span class="card-tile__inner" aria-hidden="true">
          <span class="card-tile__face card-tile__back">?</span>
          <span class="card-tile__face card-tile__front"></span>
        </span>`;
      button.querySelector('.card-tile__front')!.textContent = card.symbol.emoji;
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

  function play(index: number): void {
    window.clearTimeout(hideTimer);
    const { state: next, result: outcome } = flip(state, index);
    if (outcome === 'ignored') {
      return;
    }
    state = next;
    focused = index;
    update();

    const card = state.cards[index];
    if (outcome === 'first') {
      announce(`${card.symbol.label}.`);
    } else if (outcome === 'match') {
      announce(`${card.symbol.label} : paire trouvée ! ${pairsFound(state)} sur ${totalPairs(state)}.`);
    } else {
      const other = state.cards[state.faceUp[0]];
      announce(`${card.symbol.label}. Pas de chance, ce n’est pas le même que ${other.symbol.label}.`);
      hideTimer = window.setTimeout(() => {
        state = hideMismatch(state);
        update();
      }, MISMATCH_DELAY_MS);
    }

    if (isFinished(state)) {
      finish();
    }
  }

  function update(): void {
    stats.textContent = `Paires : ${pairsFound(state)} / ${totalPairs(state)} · Coups : ${state.moves} · Erreurs : ${mistakes(state)}`;

    for (const card of state.cards) {
      const button = buttons[card.index];
      const visible = isFaceUp(state, card.index);
      button.classList.toggle('card-tile--up', visible);
      button.classList.toggle('card-tile--matched', card.matched);
      button.classList.toggle('card-tile--miss', state.faceUp.length === 2 && state.faceUp.includes(card.index));
      button.setAttribute('aria-disabled', String(card.matched || visible));
      button.setAttribute(
        'aria-label',
        `Carte ${card.index + 1} : ${card.matched ? `${card.symbol.label}, paire trouvée` : visible ? card.symbol.label : 'face cachée'}`,
      );
      button.tabIndex = card.index === focused ? 0 : -1;
    }
  }

  function finish(): void {
    const points = computeScore(state);
    const errors = mistakes(state);
    hint.hidden = true;
    result.hidden = false;
    result.className = 'pendu__result game-result pendu__result--won';
    resultTitle.textContent = errors === 0 ? 'Parfait, aucune erreur ! 😻' : 'Bravo, toutes les paires sont trouvées ! 🎉';
    resultDetail.textContent = `${totalPairs(state)} paires en ${state.moves} coups (${errors} erreur${errors > 1 ? 's' : ''}).`;
    resultScore.textContent = `Score : ${points} points (50 × ${totalPairs(state)} paires + bonus de précision de ${points - 50 * totalPairs(state)})`;
    void scores.save(points, level);
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

  function announce(message: string): void {
    announcer.textContent = '';
    window.setTimeout(() => (announcer.textContent = message), 50);
  }

}
