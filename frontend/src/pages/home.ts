import { isLoggedIn } from '../auth';
import { renderLayout } from '../ui/layout';

/** Bandeau d'accueil pour un visiteur : présentation et invitation à créer un compte. */
const GUEST_INTRO = `
  <section class="hero" aria-labelledby="home-title">
    <p class="hero__logo" aria-hidden="true">🐱</p>
    <h1 id="home-title">Bienvenue sur CatFun&nbsp;!</h1>
    <p class="hero__text">
      Des mini-jeux rapides et amusants sur le thème des chats.
      Crée ton compte pour enregistrer tes scores et grimper dans le <a href="#/classement">classement</a> 🐾
    </p>
    <div class="hero__actions">
      <a class="button button--primary" href="#/register">Créer un compte</a>
      <a class="button button--ghost" href="#/login">Se connecter</a>
    </div>
  </section>
  <h2 class="home__games-title">Les jeux</h2>
`;

const MEMBER_INTRO = `
  <h1>Bienvenue sur CatFun&nbsp;!</h1>
  <p class="page__intro">Choisis un jeu, bats ton record et grimpe dans le <a href="#/classement">classement</a> 🐾</p>
`;

const GAMES = `
  <ul class="game-list">
    <li>
      <a class="game-card" href="#/pendu">
        <span class="game-card__icon" aria-hidden="true">🔤</span>
        <span class="game-card__name">Pendu</span>
        <span class="game-card__text">Retrouve le mot caché avant que le chat ne perde ses neuf vies.</span>
      </a>
    </li>
    <li>
      <a class="game-card" href="#/memoire">
        <span class="game-card__icon" aria-hidden="true">🃏</span>
        <span class="game-card__name">Mémoire</span>
        <span class="game-card__text">Retourne les cartes et retrouve les paires de chats en un minimum de coups.</span>
      </a>
    </li>
  </ul>
`;

/**
 * Page d'accueil, publique : c'est la première page du site.
 * Un visiteur qui choisit un jeu passe par la connexion, puis revient sur ce jeu.
 */
export function renderHome(container: HTMLElement): void {
  const guest = !isLoggedIn();
  renderLayout(container, '/').innerHTML = (guest ? GUEST_INTRO : MEMBER_INTRO) + GAMES;
}
