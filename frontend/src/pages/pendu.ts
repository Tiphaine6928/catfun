import { createScoreSaver } from '../games/score-saver';
import {
  ALPHABET,
  computeScore,
  createGame,
  getCells,
  getStatus,
  getWrongLetters,
  guess,
  pickWord,
  type GuessResult,
  type PenduState,
} from '../games/pendu/logic';
import { WORDS } from '../games/pendu/words';
import { renderLayout } from '../ui/layout';

const TEMPLATE = `
  <div class="pendu">
    <div class="pendu__header">
      <h1>Pendu</h1>
      <button type="button" class="button button--ghost button--small new-game">Nouveau mot</button>
    </div>
    <p class="page__intro">Trouve le mot caché, lettre par lettre. Chaque erreur coûte une des neuf vies du chat !</p>

    <div class="alert alert--info" role="status" hidden></div>

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

    <section class="pendu__result" hidden aria-labelledby="result-title">
      <h2 id="result-title" tabindex="-1"></h2>
      <p class="pendu__result-word"></p>
      <p class="pendu__result-score"></p>
      <p class="score-save" aria-live="polite"></p>
      <button type="button" class="button button--ghost button--small retry-save" hidden>Réessayer l’enregistrement</button>
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
  const scores = createScoreSaver('Pendu', { status: $('.score-save'), retry: $<HTMLButtonElement>('.retry-save') });
  const announcer = $('[data-announce]');

  // Le jeu côté serveur (pour enregistrer les scores), chargé en arrière-plan
  scores
    .game()
    .then((game) => $<HTMLAnchorElement>('.leaderboard-link').setAttribute('href', `#/classement?jeu=${game.id}`))
    .catch((error: unknown) => showAlert(error instanceof Error ? error.message : 'Impossible de charger le jeu.'));

  let state: PenduState;

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
    // Entrée sur l'écran de fin : nouvelle partie (sauf si un bouton a le focus, il gère déjà Entrée)
    if (event.key === 'Enter' && getStatus(state) !== 'playing' && !(document.activeElement instanceof HTMLButtonElement)) {
      event.preventDefault();
      newGame();
      return;
    }
    if (event.key.length === 1 && getStatus(state) === 'playing') {
      play(event.key);
    }
  };
  document.addEventListener('keydown', onKeydown);

  $('.new-game').addEventListener('click', () => newGame());
  $('.replay').addEventListener('click', () => newGame());

  newGame();

  // Nettoyage quand on quitte la page
  return () => document.removeEventListener('keydown', onKeydown);

  function newGame(): void {
    state = createGame(pickWord(WORDS, state?.word ?? null));
    scores.reset();
    for (const key of keys.values()) {
      key.disabled = false;
      key.classList.remove('key--correct', 'key--wrong');
    }
    result.hidden = true;
    keyboard.hidden = false;
    hint.hidden = false;
    announce(`Nouveau mot de ${getCells(state).filter((c) => c.letter).length} lettres.`);
    update();
  }

  function play(input: string): void {
    const outcome = guess(state, input);
    if (outcome.result === 'invalid' || outcome.result === 'game-over') {
      return;
    }
    state = outcome.state;

    const letter = [...state.guessed].at(-1)!;
    const key = keys.get(letter);
    if (key && outcome.result !== 'already-guessed') {
      key.disabled = true;
      key.classList.add(outcome.result === 'correct' ? 'key--correct' : 'key--wrong');
    }

    announce(messageFor(outcome.result, input.toUpperCase()));
    update();

    if (getStatus(state) !== 'playing') {
      finish();
    }
  }

  function messageFor(outcome: GuessResult, letter: string): string {
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
    const status = getStatus(state);
    cat.textContent = status === 'won' ? '😻' : CAT_MOODS.find((m) => state.lives >= m.minLives)!.face;
    livesLabel.textContent = livesText(state.lives);

    lives.replaceChildren(
      ...Array.from({ length: state.maxLives }, (_, i) => {
        const life = document.createElement('li');
        life.className = i < state.lives ? 'life' : 'life life--lost';
        life.textContent = '🐾';
        return life;
      }),
    );

    const cells = getCells(state);
    // Un groupe par mot : le retour à la ligne ne coupe jamais un mot en deux
    const groups: HTMLSpanElement[] = [];
    let group: HTMLSpanElement | null = null;
    for (const cell of cells) {
      if (cell.char === ' ') {
        group = null;
        continue;
      }
      if (!group) {
        group = document.createElement('span');
        group.className = 'pendu__group';
        groups.push(group);
      }
      const span = document.createElement('span');
      if (cell.letter === null) {
        span.className = 'cell cell--separator';
        span.textContent = cell.char;
      } else {
        span.className = cell.revealed ? 'cell cell--revealed' : 'cell';
        if (status === 'lost' && !state.guessed.has(cell.letter)) {
          span.classList.add('cell--missed');
        }
        span.textContent = cell.revealed ? cell.char : '';
      }
      group.append(span);
    }
    word.replaceChildren(...groups);
    wordForScreenReaders.textContent = `Mot : ${cells
      .map((c) => (c.letter === null ? (c.char === ' ' ? 'espace' : 'tiret') : c.revealed ? c.char : 'blanc'))
      .join(', ')}.`;

    const wrongLetters = getWrongLetters(state);
    wrong.textContent = wrongLetters.length ? `Lettres ratées : ${wrongLetters.join(' ')}` : '';
  }

  function finish(): void {
    const won = getStatus(state) === 'won';
    keyboard.hidden = true;
    hint.hidden = true;
    result.hidden = false;
    result.className = `pendu__result pendu__result--${won ? 'won' : 'lost'}`;
    resultTitle.textContent = won ? 'Bravo, tu as trouvé ! 🎉' : 'Perdu… le chat a épuisé ses neuf vies.';
    resultWord.textContent = `Le mot était : ${state.word}`;
    scores.reset();

    if (won) {
      const points = computeScore(state);
      resultScore.textContent = `Score : ${points} points (100 + 20 × ${state.lives} vies restantes + 5 par lettre différente)`;
      void scores.save(points);
    } else {
      resultScore.textContent = 'Pas de points cette fois, retente ta chance !';
    }

    announce(`${resultTitle.textContent} ${resultWord.textContent}.`);
    resultTitle.focus();
  }

  function showAlert(message: string): void {
    alert.textContent = message;
    alert.hidden = false;
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
