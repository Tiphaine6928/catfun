import { expect, test, type Page } from '@playwright/test';
import { addScore, API_URL, createUser, cutApi, gameId, loginWithToken, MOBILE, restoreApi, type TestUser } from './helpers';

/**
 * 21 joueurs avec des scores très élevés : ils occupent toujours le haut du classement,
 * quels que soient les scores laissés par les autres tests.
 * Points : 2 ex aequo en tête, puis 2 ex aequo, puis des scores tous différents.
 */
const players: TestUser[] = [];
let base = 0;
let pendu = 0;
const pointsOf = (i: number) => (i < 4 ? base + [500, 500, 400, 400][i] : base + 300 - i);

test.describe('Classement', () => {
  test.beforeAll(async ({ request }) => {
    base = 1_000_000 + (Date.now() % 1_000_000); // plus haut à chaque lancement
    pendu = await gameId(request, 'Pendu');
    for (let i = 0; i < 21; i++) {
      const player = await createUser(request, `Top${i}`);
      await addScore(request, player, 'Pendu', 10); // une moins bonne partie, qui ne doit pas compter
      await addScore(request, player, 'Pendu', pointsOf(i));
      players.push(player);
    }
  });

  const rows = (page: Page) => page.locator('.ranking tbody tr');
  const rankOf = (page: Page, i: number) => rows(page).nth(i).locator('.ranking__rank [aria-hidden], .ranking__rank:not(:has(*))');

  test('public : accessible sans compte, avec la barre des visiteurs', async ({ page }) => {
    await page.goto('/#/classement');
    await expect(page).toHaveTitle('Classement · CatFun');
    await expect(page.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', '#/login?redirect=%2Fclassement');
    await expect(page.getByRole('link', { name: 'Créer un compte' })).toHaveAttribute('href', '#/register?redirect=%2Fclassement');
    await expect(page.getByRole('button', { name: 'Se déconnecter' })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Classement' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('un onglet par jeu, le premier jeu jouable sélectionné, navigation dans l’historique', async ({ page }) => {
    await page.goto('/#/classement');
    const tabs = page.getByRole('navigation', { name: 'Choisir un jeu' }).getByRole('link');
    await expect(tabs).toHaveText(['Mémoire', 'Pendu']);
    await expect(tabs.first()).toHaveAttribute('aria-current', 'page');

    await tabs.filter({ hasText: 'Pendu' }).click();
    await expect(page).toHaveURL(new RegExp(`jeu=${pendu}$`));
    await expect(rows(page)).toHaveCount(20);

    await tabs.filter({ hasText: 'Mémoire' }).click();
    await page.goBack();
    await expect(tabs.filter({ hasText: 'Pendu' })).toHaveAttribute('aria-current', 'page');
  });

  test('meilleur score de chaque joueur, rangs partagés et médailles', async ({ page, request }) => {
    await page.goto(`/#/classement?jeu=${pendu}`);
    await expect(rows(page)).toHaveCount(20);

    const names = await rows(page).locator('.ranking__player').allTextContents();
    expect(new Set(names).size).toBe(20); // une ligne par joueur
    expect(names.slice(0, 4).sort()).toEqual(players.slice(0, 4).map((p) => p.pseudo).sort());

    // Ex aequo : même rang, et le rang suivant saute (1, 1, 3, 3, 5…)
    await expect(rankOf(page, 0)).toHaveText('🥇');
    await expect(rankOf(page, 1)).toHaveText('🥇');
    await expect(rankOf(page, 2)).toHaveText('🥉');
    await expect(rankOf(page, 3)).toHaveText('🥉');
    await expect(rankOf(page, 4)).toHaveText('5');
    await expect(rows(page).first().locator('.ranking__rank .visually-hidden')).toHaveText('1');

    // La moins bonne partie (10 points) ne compte pas
    await expect(rows(page).first().locator('.ranking__points')).toHaveText(String(base + 500));
    await expect(rows(page).first().locator('time')).toHaveText(/^\d{1,2} \S+ \d{4}$/);

    const { totalPlayers } = await (await request.get(`${API_URL}/api/games/${pendu}/leaderboard?limit=1`)).json();
    await expect(page.locator('.leaderboard__count')).toHaveText(`${totalPlayers} joueurs classés, les 20 meilleurs sont affichés.`);
  });

  test('connecté : mon record, mon rang et ma ligne mise en avant', async ({ page }) => {
    const me = players[2]; // 3e ex aequo
    await loginWithToken(page, me);
    await page.goto(`/#/classement?jeu=${pendu}`);

    await expect(page.locator('.my-rank')).toContainText(`Ton record : ${base + 400} points · 3e sur`);
    await expect(page.locator('.ranking__me')).toHaveCount(1);
    await expect(page.locator('.ranking__me .ranking__player')).toContainText(me.pseudo);
    await expect(page.locator('.ranking__me .badge--me')).toHaveText('Toi');
    await expect(page.locator('.my-rank').getByRole('link', { name: 'Rejouer' })).toHaveAttribute('href', '#/pendu');
  });

  test('connecté hors du top 20, ou sans score', async ({ page, request }) => {
    const weak = await createUser(request, 'Faible');
    await addScore(request, weak, 'Pendu', 1);
    await loginWithToken(page, weak);
    await page.goto(`/#/classement?jeu=${pendu}`);
    await expect(page.locator('.my-rank')).toContainText('Ton record : 1 points · hors du top 20');
    await expect(page.locator('.ranking__me')).toHaveCount(0);

    const newbie = await createUser(request, 'Novice');
    await page.evaluate((token) => localStorage.setItem('catfun.token', token), newbie.token);
    await page.reload();
    await expect(page.locator('.my-rank')).toContainText('Tu n’as pas encore de score sur Pendu.');
  });

  test('serveur injoignable : message et « Réessayer »', async ({ page }) => {
    await cutApi(page);
    await page.goto(`/#/classement?jeu=${pendu}`);
    await expect(page.getByRole('alert')).toContainText('Impossible de joindre le serveur');

    await restoreApi(page);
    await page.getByRole('button', { name: 'Réessayer' }).click();
    await expect(rows(page)).toHaveCount(20);
  });

  test.describe('sur mobile', () => {
    test.use(MOBILE);

    test('colonne Date masquée, pas de défilement horizontal', async ({ page }) => {
      await page.goto(`/#/classement?jeu=${pendu}`);
      await expect(rows(page)).toHaveCount(20);
      await expect(page.locator('.ranking__date').first()).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
    });
  });
});
