import { ApiError, NetworkError } from '../api';
import { findGame, guessLetter, scoreMessage, startSession, type GameSession, type PenduState } from '../games/api';
import { createMoveQueue } from '../games/move-queue';
import penduUrl from '../assets/jeu-pendu.webp';
import { renderLayout } from '../ui/layout';

/**
 * Le Pendu, joué par le serveur : il choisit le mot et ne le révèle qu'à la fin.
 * Cette page envoie les lettres et affiche ce que le serveur répond.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const TEMPLATE = `
  <div class="pendu">
    <div class="pendu__header">
      <h1>Pendu</h1>
      <button type="button" class="button button--ghost button--small new-game">Nouveau mot</button>
    </div>
    <div class="game-host">
      <img class="game-host__image" src="${penduUrl}" alt="" width="600" height="511">
      <p class="game-host__text">Twixy a caché un mot : trouve-le lettre par lettre&nbsp;! Chaque erreur coûte une des neuf vies de Twixy.</p>
    </div>

    <div class="alert alert--error" role="alert" hidden></div>

    <div class="pendu__board" aria-busy="true">
      <div class="pendu__status">
        <span class="pendu__cat" aria-hidden="true"></span>
        <div>
          <p class="pendu__lives-label"></p>
          <ol class="pendu__lives" aria-hidden="true"></ol>
        </div>
      </div>

      <p class="pendu__word" aria-hidden="true"></p>
      <p class="visually-hidden pendu__word-sr"></p>

      <p class="pendu__wrong"></p>

      <div class="pendu__keyboard" role="group" aria-label="Lettres"></div>
      <p class="pendu__hint">Astuce : tu peux aussi jouer avec le clavier de ton ordinateur.</p>
    </div>

    <section class="pendu__result" hidden aria-labelledby="result-title">
      <h2 id="result-title" tabindex="-1"></h2>
      <p class="pendu__result-word"></p>
      <p class="pendu__result-score"></p>
      <p class="score-save" aria-live="polite"></p>
      <button type="button" class="button button--primary replay">Rejouer</button>
      <a class="button button--ghost leaderboard-link" href="#/classement">Voir le classement</a>
    </section>

    <p class="visually-hidden" aria-live="assertive" data-announce></p>
  </div>
`;

const CAT_MOODS: { minLives: number; face: string }[] = [
  { minLives: 7, face: '😺' },
  { minLives: 4, face: '😼' },
  { minLives: 1, face: '🙀' },
  { minLives: 0, face: '😿' },
];

export function renderPendu(container: HTMLElement): () => void {
  const page = renderLayout(container, '/pendu');
  page.innerHTML = TEMPLATE;

  const $ = <T extends HTMLElement>(selector: string) => page.querySelector<T>(selector)!;
  const alert = $('.alert');
  const board = $('.pendu__board');
  const cat = $('.pendu__cat');
  const livesLabel = $('.pendu__lives-label');
  const lives = $('.pendu__lives');
  const word = $('.pendu__word');
  const wordForScreenReaders = $('.pendu__word-sr');
  const wrong = $('.pendu__wrong');
  const keyboard = $('.pendu__keyboard');
  const hint = $('.pendu__hint');
  const result = $('.pendu__result');
  const resultTitle = $('#result-title');
  const resultWord = $('.pendu__result-word');
  const resultScore = $('.pendu__result-score');
  const scoreStatus = $('.score-save');
  const announcer = $('[data-announce]');

  const queue = createMoveQueue();
  let session: GameSession<PenduState> | null = null;
  let left = false;

  const keys = new Map<string, HTMLButtonElement>();
  for (const letter of ALPHABET) {
    const key = document.createElement('button');
    key.type = 'button';
    key.className = 'key';
    key.textContent = letter;
    key.dataset.letter = letter;
    key.setAttribute('aria-label', `Lettre ${letter}`);
    keyboard.append(key);
    keys.set(letter, key);
  }

  keyboard.addEventListener('click', (event) => {
    const key = (event.target as HTMLElement).closest<HTMLButtonElement>('.key');
    if (key?.dataset.letter) {
      play(key.dataset.letter);
    }
  });

  const onKeydown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) {
      return;
    }
    const over = session !== null && session.status !== 'playing';
    // Entrée sur l'écran de fin : nouvelle partie (sauf si un bouton a le focus, il gère déjà Entrée)
    if (event.key === 'Enter' && over && !(document.activeElement instanceof HTMLButtonElement)) {
      event.preventDefault();
      void newGame();
      return;
    }
    // Une seule lettre (accents compris) : le serveur la ramène à la lettre de base
    if (/^\p{L}$/u.test(event.key) && session?.status === 'playing') {
      play(event.key);
    }
  };
  document.addEventListener('keydown', onKeydown);

  $('.new-game').addEventListener('click', () => void newGame());
  $('.replay').addEventListener('click', () => void newGame());

  void newGame();

  // Nettoyage quand on quitte la page
  return () => {
    left = true;
    document.removeEventListener('keydown', onKeydown);
  };

  async function newGame(): Promise<void> {
    hideAlert();
    board.setAttribute('aria-busy', 'true');
    try {
      const game = await findGame('Pendu');
      $<HTMLAnchorElement>('.leaderboard-link').setAttribute('href', `#/classement?jeu=${game.id}`);
      const started = await queue(() => startSession<PenduState>(game.id));
      if (left) {
        return;
      }
      session = started;
    } catch (error) {
      showError(error, 'Impossible de commencer une partie.');
      return;
    } finally {
      board.setAttribute('aria-busy', 'false');
    }

    result.hidden = true;
    keyboard.hidden = false;
    hint.hidden = false;
    announce(`Nouveau mot de ${session.state.cells.filter((c) => c.letter).length} lettres.`);
    update();
  }

  function play(input: string): void {
    const current = session;
    if (!current || current.status !== 'playing') {
      return;
    }

    // Retour immédiat : la touche se grise tout de suite, sans attendre la réponse du serveur
    const key = keys.get(input.toUpperCase());
    if (key) {
      if (key.disabled) {
        return;
      }
      key.disabled = true;
      key.classList.add('key--pending');
    }

    void queue(() => guessLetter(current.id, input))
      .then((next) => {
        // Réponse arrivée après un « Nouveau mot » ou après avoir quitté la page : on l'ignore
        if (left || session?.id !== next.id) {
          return;
        }
        hideAlert();
        session = next;
        announce(messageFor(next.result, input.toUpperCase(), next.state));
        update();
        if (next.status !== 'playing') {
          finish();
        }
      })
      .catch((error: unknown) => {
        // La lettre n'est pas partie : on remet le clavier dans l'état connu du serveur
        if (!left && session?.id === current.id) {
          update();
        }
        showError(error, 'La lettre n’a pas pu être envoyée.');
      })
      .finally(() => key?.classList.remove('key--pending'));
  }

  function messageFor(outcome: string | undefined, letter: string, state: PenduState): string {
    switch (outcome) {
      case 'correct':
        return `Bien vu, ${letter} est dans le mot.`;
      case 'wrong':
        return `Raté, pas de ${letter}. ${livesText(state.lives)}.`;
      case 'already-guessed':
        return `Tu as déjà proposé ${letter}.`;
      default:
        return '';
    }
  }

  function update(): void {
    if (!session) {
      return;
    }
    const state = session.state;

    cat.textContent = state.status === 'won' ? '😻' : CAT_MOODS.find((m) => state.lives >= m.minLives)!.face;
    livesLabel.textContent = livesText(state.lives);

    lives.replaceChildren(
      ...Array.from({ length: state.maxLives }, (_, i) => {
        const life = document.createElement('li');
        life.className = i < state.lives ? 'life' : 'life life--lost';
        life.textContent = '🐾';
        return life;
      }),
    );

    for (const [letter, key] of keys) {
      const guessed = state.guessed.includes(letter);
      key.disabled = guessed;
      key.classList.toggle('key--correct', guessed && !state.wrong.includes(letter));
      key.classList.toggle('key--wrong', state.wrong.includes(letter));
    }

    // Un groupe par mot : le retour à la ligne ne coupe jamais un mot en deux
    const groups: HTMLSpanElement[] = [];
    let group: HTMLSpanElement | null = null;
    for (const cell of state.cells) {
      if (!cell.letter && cell.char === ' ') {
        group = null;
        continue;
      }
      if (!group) {
        group = document.createElement('span');
        group.className = 'pendu__group';
        groups.push(group);
      }
      const span = document.createElement('span');
      if (!cell.letter) {
        span.className = 'cell cell--separator';
        span.textContent = cell.char;
      } else {
        span.className = cell.revealed ? 'cell cell--revealed' : 'cell';
        span.classList.toggle('cell--missed', cell.missed);
        span.textContent = cell.char ?? '';
      }
      group.append(span);
    }
    word.replaceChildren(...groups);

    wordForScreenReaders.textContent = `Mot : ${state.cells
      .map((c) => (!c.letter ? (c.char === ' ' ? 'espace' : 'tiret') : (c.char ?? 'blanc')))
      .join(', ')}.`;

    wrong.textContent = state.wrong.length ? `Lettres ratées : ${state.wrong.join(' ')}` : '';
  }

  function finish(): void {
    if (!session) {
      return;
    }
    const { state, score } = session;
    const won = state.status === 'won';

    keyboard.hidden = true;
    hint.hidden = true;
    result.hidden = false;
    result.className = `pendu__result pendu__result--${won ? 'won' : 'lost'}`;
    resultTitle.textContent = won ? 'Bravo, tu as trouvé ! Twixy ronronne de joie 🎉' : 'Perdu… Twixy a épuisé ses neuf vies.';
    resultWord.textContent = `Le mot était : ${state.word ?? ''}`;

    if (won && score) {
      // Score calculé et enregistré par le serveur
      resultScore.textContent = `Score : ${score.points} points (100 + 20 × ${state.lives} vies restantes + 5 par lettre différente)`;
      scoreStatus.className = 'score-save score-save--ok';
      scoreStatus.textContent = scoreMessage(score);
    } else {
      resultScore.textContent = 'Pas de points cette fois, retente ta chance !';
      scoreStatus.className = 'score-save';
      scoreStatus.textContent = '';
    }

    announce(`${resultTitle.textContent} ${resultWord.textContent}.`);
    resultTitle.focus();
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
    // Vider puis remplir pour que le même message soit relu
    announcer.textContent = '';
    window.setTimeout(() => (announcer.textContent = message), 50);
  }
}

function livesText(count: number): string {
  return count <= 1 ? `${count} vie restante` : `${count} vies restantes`;
}
