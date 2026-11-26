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
  <footer class="site-footer">
    <a href="#/confidentialite">Confidentialité</a>
  </footer>
`;

const USER_TEMPLATE = `
  <a class="topbar__pseudo" href="#/profil" title="Mon profil">…</a>
  <button type="button" class="button button--ghost button--small logout">Se déconnecter</button>
`;

const GUEST_TEMPLATE = `
  <a class="button button--ghost button--small" href="#/login">Se connecter</a>
  <a class="button button--primary button--small" href="#/register">Créer un compte</a>
`;

/** Pages du compte (connexion, inscription, mot de passe…) : y revenir après la connexion n'a pas de sens. */
const ACCOUNT_PAGES = ['/login', '/register', '/mot-de-passe-oublie', '/nouveau-mot-de-passe', '/confirmer-email'];

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
    // Page à retrouver après la connexion : celle-ci, ou, sur une page du compte, celle qu'elle retient déjà
    const redirect = ACCOUNT_PAGES.includes(current)
      ? new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('redirect')
      : current;
    for (const link of user.querySelectorAll<HTMLAnchorElement>('a')) {
      const target = link.getAttribute('href')!.slice(1); // '/login' ou '/register'
      if (target === current) {
        link.remove(); // pas de bouton « Se connecter » sur la page de connexion elle-même
      } else if (redirect) {
        link.setAttribute('href', `#${target}?redirect=${encodeURIComponent(redirect)}`);
      }
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
