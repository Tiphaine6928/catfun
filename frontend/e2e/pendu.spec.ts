import { expect, test, type Page } from '@playwright/test';
import { bestScore, createUser, cutApi, fixRandom, loginWithToken, restoreApi, type TestUser } from './helpers';

/** Le mot affiché, "_" pour une lettre cachée. */
const shownWord = (page: Page) =>
  page.locator('.pendu__word .cell').evaluateAll((cells) => cells.map((c) => c.textContent || '_').join(''));
const key = (page: Page, letter: string) => page.getByRole('button', { name: `Lettre ${letter}`, exact: true });
const lives = (page: Page) => page.locator('.pendu__lives-label');

test.describe('Pendu', () => {
  let user: TestUser;

  test.beforeEach(async ({ page, request }) => {
    user = await createUser(request);
    await fixRandom(page); // premier mot : MOUSTACHES, puis RONRONNEMENT
    await loginWithToken(page, user);
    await page.goto('/#/pendu');
    await expect(page.getByRole('heading', { name: 'Pendu', level: 1 })).toBeVisible();
  });

  test('début de partie : mot caché, neuf vies, 26 lettres', async ({ page }) => {
    await expect(page).toHaveTitle('Pendu · CatFun');
    await expect(page.getByRole('link', { name: 'Pendu' })).toHaveAttribute('aria-current', 'page');
    expect(await shownWord(page)).toBe('__________');
    await expect(lives(page)).toHaveText('9 vies restantes');
    await expect(page.getByRole('group', { name: 'Lettres' }).getByRole('button')).toHaveCount(26);
  });

  test('lettres justes, ratées, déjà jouées et accentuées', async ({ page }) => {
    await page.keyboard.press('z');
    await expect(lives(page)).toHaveText('8 vies restantes');
    await expect(key(page, 'Z')).toBeDisabled();
    await expect(key(page, 'Z')).toHaveClass(/key--wrong/);
    await expect(page.locator('.pendu__wrong')).toHaveText('Lettres ratées : Z');
    await expect(page.locator('[data-announce]')).toContainText('Raté, pas de Z');

    await key(page, 'S').click();
    expect(await shownWord(page)).toBe('___S_____S');

    await page.keyboard.press('s'); // déjà jouée : gratuit
    await page.keyboard.press('Control+m'); // raccourci : ignoré
    await expect(lives(page)).toHaveText('8 vies restantes');
    expect(await shownWord(page)).toBe('___S_____S');

    // Une touche accentuée compte comme la lettre de base
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'é' })));
    expect(await shownWord(page)).toBe('___S____ES');
  });

  test('victoire : score calculé et enregistré, puis Rejouer', async ({ page, request }) => {
    await page.keyboard.press('z'); // une erreur
    for (const letter of 'moustache') await page.keyboard.press(letter);

    await expect(page.getByRole('heading', { name: 'Bravo, tu as trouvé ! 🎉' })).toBeFocused();
    await expect(page.getByRole('group', { name: 'Lettres' })).toBeHidden();
    const expected = 100 + 20 * 8 + 5 * 9; // 8 vies restantes, 9 lettres différentes
    await expect(page.locator('.pendu__result-score')).toContainText(`Score : ${expected} points`);
    await expect(page.locator('.score-save')).toHaveText(`Score enregistré ✓ Nouveau record : ${expected} points !`);
    expect(await bestScore(request, user, 'Pendu')).toBe(expected);
    await expect(page.getByRole('link', { name: 'Voir le classement' })).toHaveAttribute('href', /#\/classement\?jeu=\d+$/);

    await page.getByRole('button', { name: 'Rejouer' }).click();
    expect(await shownWord(page)).toBe('____________'); // RONRONNEMENT : le mot précédent est exclu
    await expect(lives(page)).toHaveText('9 vies restantes');
  });

  test('défaite après neuf erreurs : mot révélé, aucun score', async ({ page, request }) => {
    for (const letter of 'bdfgijklp') await page.keyboard.press(letter);

    await expect(page.getByRole('heading', { name: /^Perdu/ })).toBeVisible();
    expect(await shownWord(page)).toBe('MOUSTACHES');
    await expect(page.locator('.cell--missed')).toHaveCount(10);
    await expect(lives(page)).toHaveText('0 vie restante');
    await expect(page.locator('.pendu__cat')).toHaveText('😿');
    expect(await bestScore(request, user, 'Pendu')).toBeNull();

    // Entrée relance une partie
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Enter');
    await expect(page.getByRole('group', { name: 'Lettres' })).toBeVisible();
  });

  test('« Nouveau mot » remet la partie à zéro', async ({ page }) => {
    await page.keyboard.press('a');
    await page.getByRole('button', { name: 'Nouveau mot' }).click();
    await expect(lives(page)).toHaveText('9 vies restantes');
    await expect(key(page, 'A')).toBeEnabled();
  });

  test('échec d’enregistrement du score puis « Réessayer »', async ({ page, request }) => {
    await cutApi(page, '/api/scores');
    for (const letter of 'moustache') await page.keyboard.press(letter);

    await expect(page.locator('.score-save')).toContainText('n’a pas pu être enregistré');
    expect(await bestScore(request, user, 'Pendu')).toBeNull();

    await restoreApi(page);
    await page.getByRole('button', { name: 'Réessayer l’enregistrement' }).click();
    await expect(page.locator('.score-save')).toContainText('Score enregistré ✓');
    expect(await bestScore(request, user, 'Pendu')).toBe(100 + 20 * 9 + 5 * 9);
  });

  test('le clavier ne joue plus une fois la page quittée', async ({ page }) => {
    await page.getByRole('link', { name: 'Accueil' }).click();
    await page.keyboard.press('a');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/$/);
  });
});
