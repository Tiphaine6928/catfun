import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { addScore, API_URL, createUser, loginWithForm, loginWithToken, winPenduViaApi } from './helpers';

test.describe('RGPD', () => {
  test('la page Confidentialité est accessible partout, même sans compte', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('contentinfo').getByRole('link', { name: 'Confidentialité' }).click();

    await expect(page).toHaveURL(/#\/confidentialite$/);
    await expect(page).toHaveTitle('Confidentialité · CatFun');
    await expect(page.getByRole('heading', { name: 'Confidentialité', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tes droits' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'cnil.fr/fr/plaintes' })).toHaveAttribute('href', 'https://www.cnil.fr/fr/plaintes');

    // Lien depuis l'inscription et la connexion
    await page.goto('/#/register');
    await expect(page.getByRole('link', { name: 'Confidentialité' })).toHaveAttribute('href', '#/confidentialite');
    await page.goto('/#/login');
    await expect(page.getByRole('link', { name: 'Confidentialité' })).toHaveAttribute('href', '#/confidentialite');
  });

  test('« Télécharger mes données » donne un fichier avec le compte et les scores', async ({ page, request }) => {
    const user = await createUser(request);
    await winPenduViaApi(request, user);
    await loginWithToken(page, user);
    await page.goto('/#/profil');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Télécharger mes données' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('catfun-mes-donnees.json');
    const data = JSON.parse(await readFile((await download.path())!, 'utf8'));
    expect(data.compte).toMatchObject({ email: user.email, pseudo: user.pseudo, changement_email_en_attente: null });
    expect(data.scores).toHaveLength(1);
    expect(data.scores[0]).toMatchObject({ jeu: 'Pendu', points: 325 });
    await expect(page.getByText('Fichier téléchargé ✓')).toBeVisible();
  });

  test('« Supprimer mon compte » efface tout, avec le mot de passe', async ({ page, request }) => {
    const user = await createUser(request);
    await addScore(request, user, 'Pendu', 4321);
    await loginWithToken(page, user);
    await page.goto('/#/profil');

    await page.getByText('Supprimer mon compte').click();
    const password = page.getByLabel('Ton mot de passe, pour confirmer');
    const confirm = page.getByRole('button', { name: 'Supprimer définitivement mon compte' });

    await confirm.click();
    await expect(page.locator('#delete-password-error')).toHaveText('Merci de saisir ton mot de passe pour confirmer.');

    await password.fill('pas-le-bon');
    await confirm.click();
    await expect(page.locator('#delete-password-error')).toHaveText('Mot de passe incorrect.');

    await password.fill(user.password);
    await confirm.click();

    // Retour à l'accueil, déconnecté, avec un message
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.locator('.flash').getByRole('status')).toContainText('Ton compte et toutes tes données ont été supprimés');
    await expect(page.getByRole('banner').getByRole('link', { name: 'Se connecter' })).toBeVisible();

    // Plus de score dans le classement, plus de connexion possible
    const games: { id: number; name: string }[] = await (await request.get(`${API_URL}/api/games`)).json();
    const pendu = games.find((g) => g.name === 'Pendu')!;
    const leaderboard = await (await request.get(`${API_URL}/api/games/${pendu.id}/leaderboard?limit=100`)).json();
    expect(leaderboard.scores.map((s: { player: string }) => s.player)).not.toContain(user.pseudo);

    await page.goto('/#/login');
    await loginWithForm(page, user);
    await expect(page.getByRole('alert')).toHaveText('Email ou mot de passe incorrect.');
  });
});
