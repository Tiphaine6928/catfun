import { expect, test } from '@playwright/test';
import { createUser, loginWithForm, loginWithToken, MOBILE } from './helpers';

test.describe('Accueil', () => {
  test('un visiteur arrive sur l’accueil, pas sur la connexion', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/(#\/?)?$/);
    await expect(page).toHaveTitle('Accueil · CatFun');
    await expect(page.getByRole('heading', { name: 'Bienvenue sur CatFun !', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Les jeux' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Pendu/ }).last()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Se déconnecter' })).toHaveCount(0);

    const hero = page.getByRole('region', { name: 'Bienvenue sur CatFun !' });
    await expect(hero.getByRole('link', { name: 'Créer un compte' })).toHaveAttribute('href', '#/register');
    await expect(hero.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', '#/login');
  });

  test('un visiteur qui choisit un jeu se connecte, puis arrive sur ce jeu', async ({ page, request }) => {
    const user = await createUser(request);
    await page.goto('/');

    await page.locator('a.game-card[href="#/memoire"]').click();
    await expect(page).toHaveURL(/#\/login\?redirect=%2Fmemoire$/);

    await loginWithForm(page, user);
    await expect(page).toHaveURL(/#\/memoire$/);
    await expect(page.locator('.card-tile').first()).toBeVisible();
  });

  test('depuis l’accueil, « Créer un compte » mène à l’inscription', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('region', { name: 'Bienvenue sur CatFun !' }).getByRole('link', { name: 'Créer un compte' }).click();
    await expect(page.getByRole('heading', { name: 'Créer un compte' })).toBeVisible();
  });

  test('connecté : accueil sans le bandeau d’inscription, avec le pseudo', async ({ page, request }) => {
    const user = await createUser(request);
    await loginWithToken(page, user);
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Bienvenue sur CatFun !', level: 1 })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Bienvenue sur CatFun !' })).toHaveCount(0);
    await expect(page.locator('.topbar__pseudo')).toHaveText(user.pseudo);
    await expect(page.locator('a.game-card')).toHaveCount(2);
  });

  test.describe('sur mobile', () => {
    test.use(MOBILE);

    test('accueil visiteur lisible, sans défilement horizontal', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Bienvenue sur CatFun !', level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
    });
  });
});
