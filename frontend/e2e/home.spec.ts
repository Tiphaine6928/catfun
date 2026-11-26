import { expect, test } from '@playwright/test';
import { createUser, loginWithToken, MOBILE } from './helpers';

test.describe('Accueil', () => {
  test('un visiteur arrive sur l’accueil, pas sur la connexion', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/(#\/?)?$/);
    await expect(page).toHaveTitle('Accueil · CatFun');
    await expect(page.getByRole('heading', { name: 'Bienvenue sur CatFun !', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Les jeux' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Pendu/ }).last()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Se déconnecter' })).toHaveCount(0);

    // Chaque jeu est présenté par son chat
    await expect(page.getByRole('link', { name: /Suivre Twixy pour jouer au pendu/ })).toHaveAttribute('href', '#/pendu');
    await expect(page.getByRole('link', { name: /Suivre Aïna pour jouer au jeu de mémoire/ })).toHaveAttribute('href', '#/memoire');

    const hero = page.getByRole('region', { name: 'Bienvenue sur CatFun !' });
    await expect(hero.getByRole('link', { name: 'Créer un compte' })).toHaveAttribute('href', '#/register');
    await expect(hero.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', '#/login');
  });

  test('un visiteur peut jouer directement, sans se connecter', async ({ page }) => {
    await page.goto('/');

    await page.locator('a.game-card[href="#/memoire"]').click();
    await expect(page).toHaveURL(/#\/memoire$/);
    await expect(page.locator('.card-tile').first()).toBeVisible();
    await expect(page.getByRole('banner').getByRole('link', { name: 'Se connecter' })).toBeVisible();
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

  test('favicon de CatFun servi par le site', async ({ page, request }) => {
    await page.goto('/');
    for (const selector of ['link[rel="icon"][href="/favicon.ico"]', 'link[rel="icon"][href="/favicon-192.png"]', 'link[rel="apple-touch-icon"]']) {
      const href = await page.locator(selector).getAttribute('href');
      const response = await request.get(href!);
      expect(response.status(), href!).toBe(200);
      expect(response.headers()['content-type'], href!).toMatch(/^image\//);
    }
  });

  test('les couleurs de la charte restent, même si l’appareil est en mode sombre', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');

    const colors = await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      return { background: body.backgroundColor, text: body.color };
    });
    expect(colors).toEqual({ background: 'rgb(237, 231, 246)', text: 'rgb(94, 53, 177)' }); // #ede7f6, #5e35b1
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
