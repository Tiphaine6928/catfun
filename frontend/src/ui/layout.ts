import logoUrl from '../assets/logo-catfun.webp';
import { fetchCurrentUser, isLoggedIn, logout } from '../auth';
import { navigate } from '../router';
import { takeFlashes } from './flash';

const TEMPLATE = `
  <header class="topbar">
    <a class="topbar__brand" href="#/"><img class="topbar__logo" src="${logoUrl}" alt="CatFun" width="720" height="515"></a>
    <nav class="topbar__nav" aria-label="Navigation principale">
      <a href="#/">Accueil</a>
      <a href="#/pendu">Pendu</a>
      <a href="#/memoire">Mémoire</a>
      <a href="#/classement">Classement</a>
    </nav>
    <div class="topbar__user"></div>
  </header>
  <div class="flash" hidden></div>
  <main class="page"></main>
`;

const USER_TEMPLATE = `
  <a class="topbar__pseudo" href="#/profil" title="Mon profil">…</a>
  <button type="button" class="button button--ghost button--small logout">Se déconnecter</button>
`;

const GUEST_TEMPLATE = `
  <a class="button button--ghost button--small" href="#/login">Se connecter</a>
  <a class="button button--primary button--small" href="#/register">Créer un compte</a>
`;

/**
 * Affiche la barre du haut et renvoie l'élément <main> où placer la page.
 * Pour un visiteur non connecté, la barre propose de se connecter ou de créer un compte.
 * `current` est le chemin de la page, pour marquer le lien actif.
 */
export function renderLayout(container: HTMLElement, current: string): HTMLElement {
  container.innerHTML = TEMPLATE;

  for (const link of container.querySelectorAll<HTMLAnchorElement>('.topbar__nav a')) {
    if (link.getAttribute('href') === `#${current}`) {
      link.setAttribute('aria-current', 'page');
    }
  }

  // Messages laissés par la page précédente (ex. connexion réussie, score enregistré)
  const flashes = takeFlashes();
  if (flashes.length > 0) {
    const box = container.querySelector<HTMLDivElement>('.flash')!;
    box.hidden = false;
    for (const flash of flashes) {
      const message = document.createElement('p');
      message.className = `alert alert--${flash.kind}`;
      message.setAttribute('role', flash.kind === 'error' ? 'alert' : 'status');
      message.textContent = flash.message;
      box.append(message);
    }
  }

  const user = container.querySelector<HTMLDivElement>('.topbar__user')!;
  if (!isLoggedIn()) {
    user.innerHTML = GUEST_TEMPLATE;
    // Après connexion ou inscription, on revient sur cette page
    for (const link of user.querySelectorAll<HTMLAnchorElement>('a')) {
      link.setAttribute('href', `${link.getAttribute('href')}?redirect=${encodeURIComponent(current)}`);
    }

    return container.querySelector<HTMLElement>('.page')!;
  }

  user.innerHTML = USER_TEMPLATE;
  if (current === '/profil') {
    user.querySelector('.topbar__pseudo')!.setAttribute('aria-current', 'page');
  }
  container.querySelector('.logout')!.addEventListener('click', () => {
    logout();
    navigate('/login');
  });

  const pseudo = container.querySelector<HTMLAnchorElement>('.topbar__pseudo')!;
  fetchCurrentUser()
    .then((user) => {
      // textContent : le pseudo n'est jamais interprété comme du HTML
      pseudo.textContent = user.pseudo;
    })
    .catch(() => {
      // un 401 renvoie déjà à la connexion ; sinon on laisse le texte par défaut
    });

  return container.querySelector<HTMLElement>('.page')!;
}

/** Met à jour le pseudo affiché dans la barre du haut (après un changement de pseudo). */
export function setTopbarPseudo(pseudo: string): void {
  const link = document.querySelector<HTMLAnchorElement>('.topbar__pseudo');
  if (link) {
    link.textContent = pseudo;
  }
}
