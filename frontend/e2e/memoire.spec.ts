import { expect, test, type Page } from '@playwright/test';
import { bestScore, createUser, loginWithToken, MOBILE, type TestUser } from './helpers';

const card = (page: Page, index: number) => page.locator(`.card-tile[data-index="${index}"]`);
const stats = (page: Page) => page.locator('.memoire__stats');
const columns = (page: Page) =>
  page.locator('.memoire__grid').evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length);

/**
 * Les deux positions de chaque paire. Les faces ne sont plus dans la page (anti-triche) :
 * on s'appuie sur l'environnement de test, où le serveur ne mélange pas les cartes
 * (paires côte à côte : 0-1, 2-3, 4-5…).
 */
async function pairs(page: Page): Promise<number[][]> {
  // La partie est créée par le serveur : on attend que les cartes soient affichées
  await expect(page.locator('.memoire__grid')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.card-tile').first()).toBeVisible();
  const count = await page.locator('.card-tile').count();
  return Array.from({ length: count / 2 }, (_, i) => [2 * i, 2 * i + 1]);
}

/** Trouve toutes les paires restantes sans erreur. */
async function finish(page: Page): Promise<void> {
  for (const [a, b] of await pairs(page)) {
    if (await card(page, a).evaluate((c) => c.classList.contains('card-tile--matched'))) continue;
    await card(page, a).click();
    await card(page, b).click();
  }
}

test.describe('Mémoire', () => {
  let user: TestUser;

  test.beforeEach(async ({ page, request }) => {
    user = await createUser(request);
    await loginWithToken(page, user);
  });

  test('niveau Normal par défaut : 16 cartes face cachée', async ({ page }) => {
    await page.goto('/#/memoire');
    await expect(page).toHaveTitle('Mémoire · CatFun');
    await expect(page.getByRole('link', { name: 'Normal · 8 paires' })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.card-tile')).toHaveCount(16);
    await expect(stats(page)).toHaveText('Paires : 0 / 8 · Coups : 0 · Erreurs : 0');
    await expect(card(page, 0)).toHaveAttribute('aria-label', 'Carte 1 : face cachée');
  });

  test('anti-triche : aucune face n’est dans la page avant d’être retournée', async ({ page }) => {
    await page.goto('/#/memoire');
    await expect(page.locator('.card-tile')).toHaveCount(16);
    await expect(stats(page)).toHaveText('Paires : 0 / 8 · Coups : 0 · Erreurs : 0');

    const faces = await page.locator('.card-tile__front').allTextContents();
    expect(faces.every((face) => face === '')).toBe(true);
    expect(await page.content()).not.toMatch(/😺|🧶|🐭|chat souriant/);

    await card(page, 0).click();
    await expect(card(page, 0).locator('.card-tile__front')).not.toHaveText('');
    expect((await page.locator('.card-tile__front').allTextContents()).filter((face) => face !== '')).toHaveLength(1);
  });

  test('erreurs, paires et retour automatique des cartes', async ({ page }) => {
    await page.goto('/#/memoire');
    const [[a1], [b1], [c1, c2]] = await pairs(page);

    await card(page, a1).click();
    await expect(card(page, a1)).toHaveClass(/card-tile--up/);
    await expect(card(page, a1)).not.toHaveAttribute('aria-label', /face cachée/);
    await card(page, a1).click({ force: true }); // même carte : ignorée
    await expect(stats(page)).toHaveText('Paires : 0 / 8 · Coups : 0 · Erreurs : 0');

    // Deux cartes différentes : visibles, puis cachées après une seconde
    await card(page, b1).click();
    await expect(card(page, b1)).toHaveClass(/card-tile--miss/);
    await expect(stats(page)).toHaveText('Paires : 0 / 8 · Coups : 1 · Erreurs : 1');
    await expect(card(page, a1)).not.toHaveClass(/card-tile--up/, { timeout: 2000 });
    await expect(card(page, b1)).not.toHaveClass(/card-tile--up/);

    // Une 3e carte cache tout de suite les deux précédentes
    await card(page, a1).click();
    await card(page, b1).click();
    await card(page, c1).click();
    await expect(card(page, a1)).not.toHaveClass(/card-tile--up/);
    await expect(card(page, c1)).toHaveClass(/card-tile--up/);

    // Paire trouvée : reste visible, n'est plus cliquable
    await card(page, c2).click();
    await expect(card(page, c1)).toHaveClass(/card-tile--matched/);
    await expect(card(page, c1)).toHaveAttribute('aria-disabled', 'true');
    await expect(stats(page)).toHaveText('Paires : 1 / 8 · Coups : 3 · Erreurs : 2');
    await expect(page.locator('[data-announce]')).toContainText('paire trouvée');
  });

  test('jouable au clavier : flèches, Début / Fin, Entrée', async ({ page }) => {
    await page.goto('/#/memoire');
    const focusedIndex = () => page.evaluate(() => (document.activeElement as HTMLElement).dataset.index);

    await card(page, 0).focus();
    await page.keyboard.press('ArrowRight');
    expect(await focusedIndex()).toBe('1');
    await page.keyboard.press('ArrowDown');
    expect(await focusedIndex()).toBe('5');
    await page.keyboard.press('End');
    expect(await focusedIndex()).toBe('15');
    await page.keyboard.press('ArrowRight'); // ne sort pas de la grille
    expect(await focusedIndex()).toBe('15');
    await page.keyboard.press('Home');
    expect(await focusedIndex()).toBe('0');
    await expect(page.locator('.card-tile[tabindex="0"]')).toHaveCount(1);

    await page.keyboard.press('Enter');
    await expect(card(page, 0)).toHaveClass(/card-tile--up/);
  });

  test('partie parfaite en Facile : 600 points enregistrés', async ({ page, request }) => {
    await page.goto('/#/memoire?niveau=facile');
    await expect(page.locator('.card-tile')).toHaveCount(12);
    expect(await columns(page)).toBe(4);

    await finish(page);

    await expect(page.getByRole('heading', { name: 'Parfait, aucune erreur ! 😻' })).toBeFocused();
    await expect(page.locator('.pendu__result-score')).toContainText('Score : 600 points');
    await expect(page.locator('.score-save')).toHaveText('Score enregistré ✓ Nouveau record en Facile : 600 points !');
    expect(await bestScore(request, user, 'Mémoire', 'facile')).toBe(600);
    expect(await bestScore(request, user, 'Mémoire', 'normal')).toBeNull();
    await expect(page.getByRole('link', { name: 'Voir le classement' })).toHaveAttribute('href', /#\/classement\?jeu=\d+&niveau=facile$/);

    await page.getByRole('button', { name: 'Rejouer' }).click();
    await expect(stats(page)).toHaveText('Paires : 0 / 6 · Coups : 0 · Erreurs : 0');
    await expect(page.locator('.card-tile').first()).toBeFocused();
  });

  test('chaque erreur retire 10 points', async ({ page, request }) => {
    await page.goto('/#/memoire');
    const [[a], [b]] = await pairs(page);
    await card(page, a).click();
    await card(page, b).click(); // 1 erreur
    await card(page, a).click();
    await card(page, b).click(); // 2 erreurs
    await page.waitForTimeout(1100);

    await finish(page);

    await expect(page.getByRole('heading', { name: /^Bravo/ })).toBeVisible();
    await expect(page.locator('.game-result__detail')).toHaveText('8 paires en 10 coups (2 erreurs).');
    expect(await bestScore(request, user, 'Mémoire', 'normal')).toBe(400 + 400 - 20);
    await expect(page.locator('.score-save')).toContainText('Nouveau record en Normal');
  });

  test('niveaux : Difficile sur 6 colonnes, niveau inconnu → Normal', async ({ page }) => {
    await page.goto('/#/memoire');
    await page.getByRole('link', { name: 'Difficile · 12 paires' }).click();
    await expect(page).toHaveURL(/niveau=difficile$/);
    await expect(page.locator('.card-tile')).toHaveCount(24);
    expect(await columns(page)).toBe(6);

    await page.goto('/#/memoire?niveau=nimporte');
    await expect(page.locator('.card-tile')).toHaveCount(16);
  });

  test.describe('sur mobile', () => {
    test.use(MOBILE);

    test('Difficile passe sur 4 colonnes, sans défilement horizontal', async ({ page }) => {
      await page.goto('/#/memoire?niveau=difficile');
      await expect(page.locator('.card-tile')).toHaveCount(24);
      expect(await columns(page)).toBe(4);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
      await expect(page.locator('.pendu__hint')).toBeHidden();
    });
  });
});
