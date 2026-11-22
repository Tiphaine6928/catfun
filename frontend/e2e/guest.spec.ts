import { expect, test, type Page } from '@playwright/test';
import { API_URL, bestScore, createUser, loginWithForm, uniqueId, type TestUser } from './helpers';

/**
 * Jouer sans compte. En test, le premier mot du Pendu est MOUSTACHES (puis RONRONNEMENT)
 * et les cartes du Mémoire ne sont pas mélangées (paires côte à côte).
 */

async function playLetters(page: Page, letters: string): Promise<void> {
  for (const letter of letters) {
    await page.keyboard.press(letter.toLowerCase());
    await expect(page.getByRole('button', { name: `Lettre ${letter}`, exact: true })).toBeDisabled();
  }
}

async function openPendu(page: Page): Promise<void> {
  await page.goto('/#/pendu');
  await expect(page.locator('.pendu__board')).toHaveAttribute('aria-busy', 'false');
}

/** Compte créé par le formulaire : on récupère son token dans le navigateur. */
async function currentUser(page: Page, user: Omit<TestUser, 'token'>): Promise<TestUser> {
  const token = await page.evaluate(() => localStorage.getItem('catfun.token'));
  expect(token).toBeTruthy();
  return { ...user, token: token! };
}

test.describe('Jouer sans compte', () => {
  test('Pendu gagné, puis inscription : le score est enregistré', async ({ page }) => {
    await openPendu(page);
    await expect(page.getByRole('banner').getByRole('link', { name: 'Se connecter' })).toBeVisible();

    await playLetters(page, 'MOUSTACHE');

    const result = page.getByRole('region', { name: /^Bravo/ });
    await expect(result).toContainText('Score : 325 points');
    await expect(result).toContainText('Sans compte, ce score n’est pas enregistré');
    await result.getByRole('link', { name: 'Créer un compte' }).click();
    await expect(page).toHaveURL(/#\/register\?redirect=%2Fpendu$/);

    const id = uniqueId();
    const user = { email: `invite-${id}@cat.fun`, pseudo: `Invite-${id}`, password: 'miaou123' };
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Pseudo').fill(user.pseudo);
    await page.getByLabel('Mot de passe', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: 'Créer mon compte' }).click();

    // Retour sur le jeu, avec la confirmation
    await expect(page).toHaveURL(/#\/pendu$/);
    await expect(page.getByRole('status').filter({ hasText: 'Score enregistré' })).toHaveText(
      'Score enregistré ✓ 325 points au Pendu, c’est ton nouveau record !',
    );
    expect(await bestScore(page.request, await currentUser(page, user), 'Pendu')).toBe(325);

    // Le message ne s'affiche qu'une fois
    await page.getByRole('link', { name: 'Accueil' }).click();
    await expect(page.getByText('Score enregistré')).toHaveCount(0);
  });

  test('Mémoire gagné, puis connexion : le score est enregistré à son niveau', async ({ page, request }) => {
    const user = await createUser(request);
    await page.goto('/#/memoire?niveau=facile');
    await expect(page.locator('.memoire__grid')).toHaveAttribute('aria-busy', 'false');
    const count = await page.locator('.card-tile').count();
    for (let i = 0; i < count; i += 2) {
      await page.locator(`.card-tile[data-index="${i}"]`).click();
      await page.locator(`.card-tile[data-index="${i + 1}"]`).click();
    }

    const result = page.locator('.game-result');
    await expect(result).toContainText('Score : 600 points');
    await result.getByRole('link', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/#\/login\?redirect=%2Fmemoire%3Fniveau%3Dfacile$/);

    await loginWithForm(page, user);
    await expect(page).toHaveURL(/#\/memoire\?niveau=facile$/);
    await expect(page.getByRole('status').filter({ hasText: 'Score enregistré' })).toHaveText(
      'Score enregistré ✓ 600 points au Mémoire (niveau Facile), c’est ton nouveau record !',
    );
    expect(await bestScore(request, user, 'Mémoire', 'facile')).toBe(600);
  });

  test('partie perdue : rien à enregistrer, et le mot suivant est différent', async ({ page }) => {
    await openPendu(page);
    await playLetters(page, 'BDFGIJKLP');

    const result = page.getByRole('region', { name: /^Perdu/ });
    await expect(result).toContainText('Le mot était : MOUSTACHES');
    await expect(result.getByRole('link', { name: 'Créer un compte' })).toHaveCount(0);

    await result.getByRole('button', { name: 'Rejouer' }).click();
    await expect(page.locator('.pendu__word .cell')).toHaveCount(12);
    await playLetters(page, 'BDFGIJKLP');
    await expect(page.getByRole('region', { name: /^Perdu/ })).toContainText('Le mot était : RONRONNEMENT');
  });

  test('score trop ancien : la connexion fonctionne et un message explique le problème', async ({ page, request }) => {
    const user = await createUser(request);
    await openPendu(page);
    await playLetters(page, 'MOUSTACHE');

    // Le serveur refuse (délai d'une heure dépassé)
    await page.route(
      (url) => url.href.startsWith(`${API_URL}/api/sessions/`) && url.pathname.endsWith('/claim'),
      (route) =>
        route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Cette partie est trop ancienne : son score ne peut plus être enregistré.' }),
        }),
    );
    await page.getByRole('region', { name: /^Bravo/ }).getByRole('link', { name: 'Se connecter' }).click();
    await loginWithForm(page, user);

    await expect(page).toHaveURL(/#\/pendu$/);
    await expect(page.locator('.topbar__pseudo')).toHaveText(user.pseudo);
    await expect(page.locator('.flash').getByRole('alert')).toHaveText(
      'Ton score de 325 points au Pendu n’a pas pu être enregistré. Cette partie est trop ancienne : son score ne peut plus être enregistré.',
    );
    expect(await bestScore(request, user, 'Pendu')).toBeNull();
  });
});
