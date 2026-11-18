import { renderLayout } from '../ui/layout';

const TEMPLATE = `
  <h1>Bienvenue sur CatFun !</h1>
  <p class="page__intro">Choisis un jeu, bats ton record et grimpe dans le <a href="#/classement">classement</a> 🐾</p>

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

export function renderHome(container: HTMLElement): void {
  renderLayout(container, '/').innerHTML = TEMPLATE;
}
