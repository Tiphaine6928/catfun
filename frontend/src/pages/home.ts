import { fetchCurrentUser, logout } from '../auth';
import { navigate } from '../router';

const TEMPLATE = `
  <header class="topbar">
    <span class="topbar__brand">🐱 CatFun</span>
    <div class="topbar__user">
      <span>Connecté en tant que <strong class="pseudo">…</strong></span>
      <button type="button" class="button button--ghost logout">Se déconnecter</button>
    </div>
  </header>
  <main class="home">
    <h1>Bienvenue sur CatFun !</h1>
    <p>La plateforme de mini-jeux pour chats. Les jeux arrivent bientôt 🐾</p>
    <button type="button" class="button button--primary meow">Miaou 😸</button>
    <p class="meow-output" aria-live="polite"></p>
  </main>
`;

export async function renderHome(container: HTMLElement): Promise<void> {
  container.innerHTML = TEMPLATE;

  container.querySelector('.logout')!.addEventListener('click', () => {
    logout();
    navigate('/login');
  });

  const output = container.querySelector<HTMLParagraphElement>('.meow-output')!;
  container.querySelector('.meow')!.addEventListener('click', () => {
    output.textContent = 'Miaouuu 🐾 Tu viens de cliquer !';
  });

  try {
    const user = await fetchCurrentUser();
    // textContent : le pseudo n'est jamais interprété comme du HTML
    container.querySelector('.pseudo')!.textContent = user.pseudo;
  } catch {
    // Un 401 est déjà géré globalement (retour à la connexion) ; sinon on garde la page
    container.querySelector('.pseudo')!.textContent = '?';
  }
}
