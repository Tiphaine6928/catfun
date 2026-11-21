import { expect, test, type Page } from '@playwright/test';
import { API_URL, bestScore, createUser, cutApi, loginWithToken, restoreApi, type TestUser } from './helpers';

/** Le mot affiché, "_" pour une lettre cachée. */
const shownWord = (page: Page) =>
  page.locator('.pendu__word .cell').evaluateAll((cells) => cells.map((c) => c.textContent || '_').join(''));
const key = (page: Page, letter: string) => page.getByRole('button', { name: `Lettre ${letter}`, exact: true });
const lives = (page: Page) => page.locator('.pendu__lives-label');

test.describe('Pendu', () => {
  let user: TestUser;

  test.beforeEach(async ({ page, request }) => {
    user = await createUser(request);
    // En test, le serveur choisit toujours MOUSTACHES pour un nouveau joueur, puis RONRONNEMENT
    await loginWithToken(page, user);
    await page.goto('/#/pendu');
    await expect(page.getByRole('heading', { name: 'Pendu', level: 1 })).toBeVisible();
    // La partie est créée par le serveur : on attend qu'elle soit affichée avant de jouer
    await expect(page.locator('.pendu__board')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('.pendu__word .cell')).toHaveCount(10);
  });

  test('début de partie : mot caché, neuf vies, 26 lettres', async ({ page }) => {
    await expect(page).toHaveTitle('Pendu · CatFun');
    await expect(page.getByRole('link', { name: 'Pendu' })).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => shownWord(page)).toBe('__________');
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
    await expect.poll(() => shownWord(page)).toBe('___S_____S');

    await page.keyboard.press('s'); // déjà jouée : gratuit
    await page.keyboard.press('Control+m'); // raccourci : ignoré
    await page.waitForTimeout(300); // laisse le temps à une éventuelle réponse (il ne doit pas y en avoir)
    await expect(lives(page)).toHaveText('8 vies restantes');
    await expect.poll(() => shownWord(page)).toBe('___S_____S');

    // Une touche accentuée compte comme la lettre de base
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'é' })));
    await expect.poll(() => shownWord(page)).toBe('___S____ES');
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
    await expect.poll(() => shownWord(page)).toBe('____________'); // RONRONNEMENT : le mot précédent est exclu
    await expect(lives(page)).toHaveText('9 vies restantes');
  });

  test('défaite après neuf erreurs : mot révélé, aucun score', async ({ page, request }) => {
    for (const letter of 'bdfgijklp') await page.keyboard.press(letter);

    await expect(page.getByRole('heading', { name: /^Perdu/ })).toBeVisible();
    await expect.poll(() => shownWord(page)).toBe('MOUSTACHES');
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

  test('connexion perdue pendant un coup : message, puis on peut rejouer la lettre', async ({ page }) => {
    await cutApi(page, '/api/sessions/');
    await page.keyboard.press('m');
    await expect(page.getByRole('alert')).toContainText('La lettre n’a pas pu être envoyée');
    await expect.poll(() => shownWord(page)).toBe('__________');

    await restoreApi(page);
    await page.keyboard.press('m');
    await expect(page.getByRole('alert')).toBeHidden();
    await expect.poll(() => shownWord(page)).toBe('M_________');
  });

  test('anti-triche : le mot n’est jamais envoyé avant la fin, et un score ne peut pas être posté', async ({ page, request }) => {
    const responses: string[] = [];
    page.on('response', async (response) => {
      if (response.url().startsWith(`${API_URL}/api/`)) {
        responses.push(await response.text().catch(() => ''));
      }
    });
    // Nouvelle partie (2e du joueur : RONRONNEMENT), en surveillant toutes les réponses de l'API
    await page.getByRole('button', { name: 'Nouveau mot' }).click();
    await expect(page.locator('.pendu__word .cell')).toHaveCount(12);
    for (const letter of 'ron') await page.keyboard.press(letter);
    await expect.poll(() => shownWord(page)).toBe('RONRONN___N_');
    expect(responses.join('\n')).not.toContain('RONRONNEMENT');

    // Envoyer un score inventé ne marche plus
    const cheat = await request.post(`${API_URL}/api/scores`, {
      headers: { Authorization: `Bearer ${user.token}` },
      data: { gameId: 1, points: 999999 },
    });
    expect([404, 405]).toContain(cheat.status());
    expect(await bestScore(request, user, 'Pendu')).toBeNull();
  });

  test('le clavier ne joue plus une fois la page quittée', async ({ page }) => {
    await page.getByRole('link', { name: 'Accueil' }).click();
    await page.keyboard.press('a');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/$/);
  });
});
