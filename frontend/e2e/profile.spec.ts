import { expect, test } from '@playwright/test';
import { API_URL, createUser, loginWithToken, MOBILE, winPenduViaApi, type TestUser } from './helpers';

test.describe('Mon profil', () => {
  let user: TestUser;

  test.beforeEach(async ({ request }) => {
    user = await createUser(request, 'Profil');
  });

  test('réservé aux joueurs connectés', async ({ page }) => {
    await page.goto('/#/profil');
    await expect(page).toHaveURL(/#\/login\?redirect=%2Fprofil$/);
  });

  test('accessible en cliquant sur son pseudo ; un nouveau joueur n’a encore rien', async ({ page }) => {
    await loginWithToken(page, user);
    await page.goto('/');
    await page.getByRole('link', { name: user.pseudo }).click();

    await expect(page).toHaveURL(/#\/profil$/);
    await expect(page).toHaveTitle('Mon profil · CatFun');
    await expect(page.locator('.topbar__pseudo')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.profile__email .email')).toHaveText(user.email);
    await expect(page.getByLabel('Pseudo')).toHaveValue(user.pseudo);

    const pendu = page.getByRole('article', { name: 'Pendu' });
    await expect(pendu).toContainText('Pas encore de partie terminée.');
    await expect(pendu.locator('dd')).toHaveText('—');
    const memoire = page.getByRole('article', { name: 'Mémoire' });
    await expect(memoire.locator('dt')).toHaveText(['Facile', 'Normal', 'Difficile']);
    await expect(page.locator('.history')).toContainText('Aucune partie gagnée pour l’instant.');
  });

  test('records, parties jouées et historique après une victoire', async ({ page, request }) => {
    await winPenduViaApi(request, user);
    await loginWithToken(page, user);
    await page.goto('/#/profil');

    const pendu = page.getByRole('article', { name: 'Pendu' });
    await expect(pendu).toContainText('1 partie terminée, 1 gagnée.');
    await expect(pendu.locator('dd')).toHaveText('325 points');
    await expect(pendu.getByRole('link', { name: 'Jouer' })).toHaveAttribute('href', '#/pendu');

    const rows = page.locator('.history__table tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.first().locator('td')).toHaveText([/\d{1,2} \S+ \d{4}/, 'Pendu', '—', '325']);
  });

  test('changer de pseudo : enregistré, barre du haut et classement à jour', async ({ page, request }) => {
    await winPenduViaApi(request, user);
    await loginWithToken(page, user);
    await page.goto('/#/profil');
    await expect(page.getByLabel('Pseudo')).toHaveValue(user.pseudo);

    const nouveau = `Nouveau-${user.pseudo.slice(-6)}`;
    await page.getByLabel('Pseudo').fill(`  ${nouveau}  `);
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page.locator('.profile__saved')).toHaveText(`Pseudo enregistré ✓ Tu apparais maintenant sous le nom « ${nouveau} ».`);
    await expect(page.locator('.topbar__pseudo')).toHaveText(nouveau);
    await expect(page.getByLabel('Pseudo')).toHaveValue(nouveau);

    const me = await (await request.get(`${API_URL}/api/me`, { headers: { Authorization: `Bearer ${user.token}` } })).json();
    expect(me.pseudo).toBe(nouveau);

    // Le classement affiche le nouveau pseudo (vérifié sur le classement complet : d'autres tests
    // placent des joueurs aux scores très élevés dans le top 20)
    const pendu = (await (await request.get(`${API_URL}/api/games`)).json()).find((g: { name: string }) => g.name === 'Pendu');
    const board = await (await request.get(`${API_URL}/api/games/${pendu.id}/leaderboard?limit=100`)).json();
    const players = board.scores.map((s: { player: string }) => s.player);
    expect(players).toContain(nouveau);
    expect(players).not.toContain(user.pseudo);
  });

  test('pseudo invalide, déjà pris ou inchangé', async ({ page, request }) => {
    const other = await createUser(request, 'Autre');
    await loginWithToken(page, user);
    await page.goto('/#/profil');
    await expect(page.getByLabel('Pseudo')).toHaveValue(user.pseudo);
    const pseudo = page.getByLabel('Pseudo');
    const save = page.getByRole('button', { name: 'Enregistrer' });

    await pseudo.fill('a b');
    await save.click();
    await expect(page.locator('#pseudo-error')).toContainText('ne peut contenir que');
    await expect(pseudo).toHaveAttribute('aria-invalid', 'true');

    await pseudo.fill(other.pseudo.toUpperCase());
    await save.click();
    await expect(page.locator('#pseudo-error')).toHaveText('Ce pseudo est déjà pris.');
    await expect(page.locator('.topbar__pseudo')).toHaveText(user.pseudo);

    await pseudo.fill(user.pseudo);
    await expect(page.locator('#pseudo-error')).toBeHidden();
    await save.click();
    await expect(page.locator('.profile__saved')).toHaveText('C’est déjà ton pseudo.');
  });

  test.describe('sur mobile', () => {
    test.use(MOBILE);

    test('page lisible, sans défilement horizontal', async ({ page, request }) => {
      await winPenduViaApi(request, user);
      await loginWithToken(page, user);
      await page.goto('/#/profil');
      await expect(page.locator('.history__table')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
    });
  });
});
