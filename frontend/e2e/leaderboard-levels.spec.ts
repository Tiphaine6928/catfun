import { expect, test, type Page } from '@playwright/test';
import { addScore, createUser, gameId, loginWithToken, MOBILE, type TestUser } from './helpers';

/**
 * Classement du Mémoire par niveau.
 * Les scores très élevés des joueurs créés ici les placent toujours en tête,
 * quels que soient les scores laissés par les autres tests.
 */
const base = 2_000_000 + (Date.now() % 1_000_000);
let memoire = 0;
let pendu = 0;
let facileOnly: TestUser;
let allLevels: TestUser;

const levelTabs = (page: Page) => page.getByRole('navigation', { name: 'Choisir un niveau' }).getByRole('link');
const firstRow = (page: Page) => page.locator('.ranking tbody tr').first();

test.describe('Classement par niveau', () => {
  test.beforeAll(async ({ request }) => {
    memoire = await gameId(request, 'Mémoire');
    pendu = await gameId(request, 'Pendu');

    facileOnly = await createUser(request, 'Facile');
    await addScore(request, facileOnly, 'Mémoire', base + 600, 'facile');

    allLevels = await createUser(request, 'Expert');
    await addScore(request, allLevels, 'Mémoire', base + 500, 'facile');
    await addScore(request, allLevels, 'Mémoire', base + 700, 'normal');
    await addScore(request, allLevels, 'Mémoire', base + 1200, 'difficile');
  });

  test('le Mémoire a un onglet par niveau, Normal par défaut ; le Pendu n’en a pas', async ({ page }) => {
    await page.goto(`/#/classement?jeu=${memoire}`);
    await expect(levelTabs(page)).toHaveText(['Facile', 'Normal', 'Difficile', 'Tous niveaux']);
    await expect(levelTabs(page).filter({ hasText: 'Normal' })).toHaveAttribute('aria-current', 'page');
    await expect(firstRow(page).locator('.ranking__player')).toHaveText(allLevels.pseudo);
    await expect(firstRow(page).locator('.ranking__points')).toHaveText(String(base + 700));

    await page.goto(`/#/classement?jeu=${pendu}`);
    // Classement chargé (vide ou non selon l'ordre des tests)
    await expect(page.locator('.leaderboard')).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByRole('navigation', { name: 'Choisir un jeu' }).getByRole('link', { name: 'Pendu' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('navigation', { name: 'Choisir un niveau' })).toBeHidden();
  });

  test('chaque niveau a son propre classement', async ({ page }) => {
    await page.goto(`/#/classement?jeu=${memoire}`);

    await levelTabs(page).filter({ hasText: 'Facile' }).click();
    await expect(page).toHaveURL(new RegExp(`jeu=${memoire}&niveau=facile$`));
    await expect(firstRow(page).locator('.ranking__player')).toHaveText(facileOnly.pseudo);
    await expect(page.locator('.ranking tbody tr').nth(1).locator('.ranking__points')).toHaveText(String(base + 500));
    await expect(page.locator('.ranking caption')).toHaveText('Classement du jeu Mémoire, niveau Facile');

    await levelTabs(page).filter({ hasText: 'Difficile' }).click();
    await expect(firstRow(page).locator('.ranking__points')).toHaveText(String(base + 1200));
    await expect(page.locator('.ranking__player', { hasText: facileOnly.pseudo })).toHaveCount(0);

    // Tous niveaux : meilleur score de chaque joueur, avec une explication
    await levelTabs(page).filter({ hasText: 'Tous niveaux' }).click();
    await expect(page).toHaveURL(/niveau=tous$/);
    await expect(page.locator('.leaderboard__hint')).toBeVisible();
    await expect(firstRow(page).locator('.ranking__points')).toHaveText(String(base + 1200));
    await expect(page.locator('.ranking__player', { hasText: facileOnly.pseudo })).toHaveCount(1);
  });

  test('connecté : record et rang pour le niveau affiché', async ({ page }) => {
    await loginWithToken(page, facileOnly);

    await page.goto(`/#/classement?jeu=${memoire}&niveau=facile`);
    await expect(page.locator('.my-rank')).toContainText(`Ton record en Facile : ${base + 600} points · 1er sur`);
    await expect(page.locator('.my-rank').getByRole('link', { name: 'Rejouer' })).toHaveAttribute('href', '#/memoire?niveau=facile');
    await expect(page.locator('.ranking__me .badge--me')).toHaveText('Toi');

    await page.goto(`/#/classement?jeu=${memoire}&niveau=normal`);
    await expect(page.locator('.my-rank')).toContainText('Tu n’as pas encore de score sur Mémoire en Normal.');
    await expect(page.locator('.my-rank').getByRole('link', { name: 'Lancer une partie' })).toHaveAttribute('href', '#/memoire?niveau=normal');
  });

  test('un niveau inconnu dans l’URL affiche le niveau par défaut', async ({ page }) => {
    await page.goto(`/#/classement?jeu=${memoire}&niveau=expert`);
    await expect(levelTabs(page).filter({ hasText: 'Normal' })).toHaveAttribute('aria-current', 'page');
  });

  test.describe('sur mobile', () => {
    test.use(MOBILE);

    test('onglets de niveau lisibles, sans défilement horizontal', async ({ page }) => {
      await page.goto(`/#/classement?jeu=${memoire}`);
      await expect(levelTabs(page)).toHaveCount(4);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
    });
  });
});
