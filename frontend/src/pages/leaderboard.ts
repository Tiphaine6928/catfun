import { fetchCurrentUser, isLoggedIn } from '../auth';
import { fetchBestScore, fetchGames, fetchLeaderboard, GAME_PAGES, type Game, type Leaderboard } from '../games/api';
import { renderLayout } from '../ui/layout';

const LIMIT = 20;
const MEDALS = ['🥇', '🥈', '🥉'];
const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

const TEMPLATE = `
  <h1>Classement</h1>
  <p class="page__intro">Le meilleur score de chaque joueur. Qui sera le roi des chats ? 👑</p>

  <nav class="tabs" aria-label="Choisir un jeu"></nav>

  <div class="leaderboard" aria-live="polite" aria-busy="true">
    <p class="leaderboard__loading">Chargement du classement…</p>
  </div>
`;

export function renderLeaderboard(container: HTMLElement, params: URLSearchParams): void {
  const page = renderLayout(container, '/classement');
  page.innerHTML = TEMPLATE;
  const tabs = page.querySelector<HTMLElement>('.tabs')!;
  const board = page.querySelector<HTMLElement>('.leaderboard')!;

  void load();

  async function load(): Promise<void> {
    setBusy(true);
    let games: Game[];
    try {
      games = await fetchGames();
    } catch (error) {
      showError(error);
      return;
    }

    if (games.length === 0) {
      board.replaceChildren(paragraph('Aucun jeu n’est encore disponible.', 'leaderboard__empty'));
      setBusy(false);
      return;
    }

    // Jeu demandé dans l'URL (?jeu=3), sinon le premier jeu jouable
    const requested = games.find((g) => String(g.id) === params.get('jeu'));
    const game = requested ?? games.find((g) => g.name in GAME_PAGES) ?? games[0];

    renderTabs(games, game);
    await renderBoard(game);
  }

  function renderTabs(games: Game[], selected: Game): void {
    tabs.replaceChildren(
      ...games.map((game) => {
        const link = document.createElement('a');
        link.className = 'tabs__tab';
        link.href = `#/classement?jeu=${game.id}`;
        link.textContent = game.name;
        if (game.id === selected.id) {
          link.setAttribute('aria-current', 'page');
        }
        return link;
      }),
    );
  }

  async function renderBoard(game: Game): Promise<void> {
    setBusy(true);
    let leaderboard: Leaderboard;
    let me: string | null = null;
    let best: number | null = null;
    try {
      [leaderboard, me, best] = await Promise.all([
        fetchLeaderboard(game.id, LIMIT),
        isLoggedIn() ? fetchCurrentUser().then((u) => u.pseudo).catch(() => null) : Promise.resolve(null),
        isLoggedIn() ? fetchBestScore(game.id).catch(() => null) : Promise.resolve(null),
      ]);
    } catch (error) {
      showError(error, () => void renderBoard(game));
      return;
    }

    const content: HTMLElement[] = [];
    const playPath = GAME_PAGES[game.name];

    if (me !== null) {
      content.push(renderMySummary(leaderboard, me, best, playPath));
    }

    if (leaderboard.scores.length === 0) {
      const empty = paragraph('Personne n’a encore de score sur ce jeu. ', 'leaderboard__empty');
      empty.append(playPath ? link(`#${playPath}`, 'Sois le premier à jouer !') : 'Ce jeu arrive bientôt 🐾');
      content.push(empty);
    } else {
      content.push(renderTable(leaderboard, me));
      const shown = leaderboard.scores.length;
      const total = leaderboard.totalPlayers;
      content.push(
        paragraph(
          total > shown ? `${total} joueurs classés, les ${shown} meilleurs sont affichés.` : `${total} joueur${total > 1 ? 's' : ''} classé${total > 1 ? 's' : ''}.`,
          'leaderboard__count',
        ),
      );
    }

    board.replaceChildren(...content);
    setBusy(false);
  }

  function renderMySummary(leaderboard: Leaderboard, me: string, best: number | null, playPath?: string): HTMLElement {
    const summary = document.createElement('div');
    summary.className = 'my-rank';

    if (best === null) {
      summary.append(`Tu n’as pas encore de score sur ${leaderboard.game.name}. `);
      if (playPath) {
        summary.append(link(`#${playPath}`, 'Lancer une partie'));
      }
      return summary;
    }

    const myEntry = leaderboard.scores.find((entry) => entry.player === me);
    const record = document.createElement('strong');
    record.textContent = `${best} points`;
    summary.append('Ton record : ', record);
    summary.append(myEntry ? ` · ${ordinal(myEntry.rank)} sur ${leaderboard.totalPlayers}` : ` · hors du top ${leaderboard.scores.length}`);
    if (playPath) {
      summary.append(' · ', link(`#${playPath}`, 'Rejouer'));
    }

    return summary;
  }

  function renderTable(leaderboard: Leaderboard, me: string | null): HTMLTableElement {
    const table = document.createElement('table');
    table.className = 'ranking';
    table.innerHTML = `
      <caption class="visually-hidden"></caption>
      <thead>
        <tr>
          <th scope="col" class="ranking__rank">Rang</th>
          <th scope="col">Joueur</th>
          <th scope="col" class="ranking__points">Points</th>
          <th scope="col" class="ranking__date">Date</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    table.querySelector('caption')!.textContent = `Classement du jeu ${leaderboard.game.name}`;

    const body = table.querySelector('tbody')!;
    for (const entry of leaderboard.scores) {
      const row = body.insertRow();
      const isMe = entry.player === me;
      if (isMe) {
        row.className = 'ranking__me';
      }

      const rank = row.insertCell();
      rank.className = 'ranking__rank';
      const medal = MEDALS[entry.rank - 1];
      if (medal) {
        const icon = document.createElement('span');
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = medal;
        rank.append(icon, visuallyHidden(`${entry.rank}`));
      } else {
        rank.textContent = String(entry.rank);
      }

      // Pseudos insérés en texte : jamais interprétés comme du HTML
      const player = document.createElement('th');
      player.scope = 'row';
      player.className = 'ranking__player';
      player.textContent = entry.player;
      if (isMe) {
        const badge = document.createElement('span');
        badge.className = 'badge badge--me';
        badge.textContent = 'Toi';
        player.append(badge);
      }
      row.append(player);

      const points = row.insertCell();
      points.className = 'ranking__points';
      points.textContent = String(entry.points);

      const date = row.insertCell();
      date.className = 'ranking__date';
      const time = document.createElement('time');
      time.dateTime = entry.date;
      time.textContent = dateFormat.format(new Date(entry.date));
      date.append(time);
    }

    return table;
  }

  function showError(error: unknown, retry: () => void = () => void load()): void {
    const message = paragraph(
      error instanceof Error ? error.message : 'Impossible de charger le classement.',
      'alert alert--error',
    );
    message.setAttribute('role', 'alert');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button button--ghost button--small';
    button.textContent = 'Réessayer';
    button.addEventListener('click', retry);
    board.replaceChildren(message, button);
    setBusy(false);
  }

  function setBusy(busy: boolean): void {
    board.setAttribute('aria-busy', String(busy));
    if (busy && !board.querySelector('.ranking')) {
      board.replaceChildren(paragraph('Chargement du classement…', 'leaderboard__loading'));
    }
  }
}

function paragraph(text: string, className: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.className = className;
  p.textContent = text;
  return p;
}

function link(href: string, text: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = text;
  return a;
}

function visuallyHidden(text: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'visually-hidden';
  span.textContent = text;
  return span;
}

function ordinal(rank: number): string {
  return rank === 1 ? '1er' : `${rank}e`;
}
