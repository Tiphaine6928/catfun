import { ApiError } from '../api';
import { fetchCurrentUser, loginErrorMessage, updatePseudo } from '../auth';
import { fetchMyHistory, fetchMyStats, GAME_PAGES, levelLabel, type GameStats, type HistoryEntry } from '../games/api';
import { clearErrorOnInput, PSEUDO_MAX, PSEUDO_MIN, setFieldError, setLoading, validatePseudo } from '../ui/form';
import { renderLayout, setTopbarPseudo } from '../ui/layout';

const HISTORY_SIZE = 10;
const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

const TEMPLATE = `
  <h1>Mon profil</h1>
  <p class="page__intro">Ton compte, tes records et tes dernières parties.</p>

  <section class="profile-section" aria-labelledby="account-title">
    <h2 id="account-title">Mon compte</h2>
    <p class="profile__email">Email : <strong class="email">…</strong></p>

    <form class="form profile__form" novalidate>
      <div class="field">
        <label for="pseudo">Pseudo</label>
        <input id="pseudo" name="pseudo" type="text" autocomplete="nickname"
               minlength="${PSEUDO_MIN}" maxlength="${PSEUDO_MAX}" required aria-describedby="pseudo-help">
        <p class="field__help" id="pseudo-help">
          Affiché dans les classements. ${PSEUDO_MIN} à ${PSEUDO_MAX} caractères : lettres, chiffres, « _ » et « - ».
        </p>
        <p class="field__error" id="pseudo-error" hidden></p>
      </div>
      <div class="profile__actions">
        <button type="submit" class="button button--primary"><span class="button__label">Enregistrer</span></button>
        <p class="profile__saved" role="status"></p>
      </div>
    </form>
  </section>

  <section class="profile-section" aria-labelledby="records-title">
    <h2 id="records-title">Mes records</h2>
    <div class="records" aria-busy="true"><p class="muted">Chargement…</p></div>
  </section>

  <section class="profile-section" aria-labelledby="history-title">
    <h2 id="history-title">Mes dernières parties gagnées</h2>
    <div class="history" aria-busy="true"><p class="muted">Chargement…</p></div>
  </section>
`;

export function renderProfile(container: HTMLElement): void {
  const page = renderLayout(container, '/profil');
  page.innerHTML = TEMPLATE;

  const form = page.querySelector<HTMLFormElement>('.profile__form')!;
  const pseudo = form.querySelector<HTMLInputElement>('#pseudo')!;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const saved = form.querySelector<HTMLElement>('.profile__saved')!;
  const records = page.querySelector<HTMLElement>('.records')!;
  const history = page.querySelector<HTMLElement>('.history')!;

  let currentPseudo = '';

  clearErrorOnInput(pseudo);
  pseudo.addEventListener('input', () => (saved.textContent = ''));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    saved.textContent = '';

    const error = validatePseudo(pseudo.value);
    setFieldError(pseudo, error);
    if (error) {
      pseudo.focus();
      return;
    }
    if (pseudo.value.trim() === currentPseudo) {
      saved.textContent = 'C’est déjà ton pseudo.';
      return;
    }

    setLoading(submit, true, 'Enregistrer', 'Enregistrement…');
    try {
      const user = await updatePseudo(pseudo.value.trim());
      currentPseudo = user.pseudo;
      pseudo.value = user.pseudo;
      setTopbarPseudo(user.pseudo);
      saved.textContent = `Pseudo enregistré ✓ Tu apparais maintenant sous le nom « ${user.pseudo} ».`;
    } catch (err) {
      // Erreur sur le champ (pseudo déjà pris…) ou message général
      const message = err instanceof ApiError ? (err.fieldErrors.pseudo ?? loginErrorMessage(err)) : loginErrorMessage(err);
      setFieldError(pseudo, message);
      pseudo.focus();
    } finally {
      setLoading(submit, false, 'Enregistrer', 'Enregistrement…');
    }
  });

  void loadAccount();
  void loadRecords();
  void loadHistory();

  async function loadAccount(): Promise<void> {
    try {
      const user = await fetchCurrentUser();
      currentPseudo = user.pseudo;
      pseudo.value = user.pseudo;
      // textContent : jamais interprété comme du HTML
      page.querySelector('.email')!.textContent = user.user;
    } catch {
      // un 401 renvoie déjà à la connexion
    }
  }

  async function loadRecords(): Promise<void> {
    try {
      const stats = await fetchMyStats();
      records.replaceChildren(...stats.map(renderGameStats));
    } catch (error) {
      records.replaceChildren(errorMessage(error, 'Impossible de charger tes records.'));
    }
    records.setAttribute('aria-busy', 'false');
  }

  async function loadHistory(): Promise<void> {
    try {
      const entries = await fetchMyHistory(HISTORY_SIZE);
      history.replaceChildren(entries.length ? renderHistory(entries) : paragraph('Aucune partie gagnée pour l’instant. À toi de jouer ! 🐾', 'muted'));
    } catch (error) {
      history.replaceChildren(errorMessage(error, 'Impossible de charger tes dernières parties.'));
    }
    history.setAttribute('aria-busy', 'false');
  }
}

/** Carte d'un jeu : parties jouées / gagnées, et record (par niveau pour le Mémoire). */
function renderGameStats(stats: GameStats): HTMLElement {
  const card = document.createElement('article');
  card.className = 'record-card';
  card.setAttribute('aria-labelledby', `record-${stats.game.id}`);

  const title = document.createElement('h3');
  title.id = `record-${stats.game.id}`;
  title.textContent = stats.game.name;

  const played = paragraph(
    stats.played === 0 ? 'Pas encore de partie terminée.' : `${stats.played} partie${stats.played > 1 ? 's' : ''} terminée${stats.played > 1 ? 's' : ''}, ${stats.won} gagnée${stats.won > 1 ? 's' : ''}.`,
    'muted',
  );

  const list = document.createElement('dl');
  list.className = 'record-card__records';
  for (const record of stats.records) {
    const label = document.createElement('dt');
    label.textContent = record.level ? levelLabel(record.level) : 'Record';
    const value = document.createElement('dd');
    value.textContent = record.best === null ? '—' : `${record.best} points`;
    list.append(label, value);
  }

  const links = document.createElement('p');
  links.className = 'record-card__links';
  const page = GAME_PAGES[stats.game.name];
  if (page) {
    links.append(link(`#${page}`, 'Jouer'), ' · ');
  }
  links.append(link(`#/classement?jeu=${stats.game.id}`, 'Voir le classement'));

  card.append(title, played, list, links);
  return card;
}

function renderHistory(entries: HistoryEntry[]): HTMLTableElement {
  const table = document.createElement('table');
  table.className = 'ranking history__table';
  table.innerHTML = `
    <caption class="visually-hidden">Mes dernières parties gagnées</caption>
    <thead><tr>
      <th scope="col">Date</th><th scope="col">Jeu</th><th scope="col">Niveau</th><th scope="col" class="ranking__points">Points</th>
    </tr></thead>
    <tbody></tbody>`;
  const body = table.querySelector('tbody')!;
  for (const entry of entries) {
    const row = body.insertRow();
    const date = row.insertCell();
    const time = document.createElement('time');
    time.dateTime = entry.date;
    time.textContent = dateFormat.format(new Date(entry.date));
    date.append(time);
    row.insertCell().textContent = entry.game.name;
    row.insertCell().textContent = entry.level ? levelLabel(entry.level) : '—';
    const points = row.insertCell();
    points.className = 'ranking__points';
    points.textContent = String(entry.points);
  }
  return table;
}

function errorMessage(error: unknown, fallback: string): HTMLElement {
  const message = paragraph(error instanceof Error ? `${fallback} ${error.message}` : fallback, 'alert alert--error');
  message.setAttribute('role', 'alert');
  return message;
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
