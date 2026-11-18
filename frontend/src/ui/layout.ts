import { fetchCurrentUser, logout } from '../auth';
import { navigate } from '../router';

const TEMPLATE = `
  <header class="topbar">
    <a class="topbar__brand" href="#/">🐱 CatFun</a>
    <nav class="topbar__nav" aria-label="Navigation principale">
      <a href="#/">Accueil</a>
      <a href="#/pendu">Pendu</a>
    </nav>
    <div class="topbar__user">
      <span class="topbar__pseudo" title="Connecté">…</span>
      <button type="button" class="button button--ghost button--small logout">Se déconnecter</button>
    </div>
  </header>
  <main class="page"></main>
`;

/**
 * Affiche la barre du haut (pages connectées) et renvoie l'élément <main> où placer la page.
 * `current` est le chemin de la page, pour marquer le lien actif.
 */
export function renderLayout(container: HTMLElement, current: string): HTMLElement {
  container.innerHTML = TEMPLATE;

  for (const link of container.querySelectorAll<HTMLAnchorElement>('.topbar__nav a')) {
    if (link.getAttribute('href') === `#${current}`) {
      link.setAttribute('aria-current', 'page');
    }
  }

  container.querySelector('.logout')!.addEventListener('click', () => {
    logout();
    navigate('/login');
  });

  const pseudo = container.querySelector<HTMLSpanElement>('.topbar__pseudo')!;
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
