import { expect, test } from '@playwright/test';
import { createResetToken, createUser, loginWithForm } from './helpers';

test.describe('Mot de passe oublié', () => {
  test('depuis la connexion : l’email suit, et le message ne révèle pas si le compte existe', async ({ page }) => {
    await page.goto('/#/login');
    await page.getByLabel('Email').fill('personne@cat.fun');
    await page.getByRole('link', { name: 'Mot de passe oublié ?' }).click();

    await expect(page).toHaveURL(/#\/mot-de-passe-oublie$/);
    await expect(page).toHaveTitle('Mot de passe oublié · CatFun');
    await expect(page.getByLabel('Email')).toHaveValue('personne@cat.fun');

    await page.getByRole('button', { name: 'Recevoir le lien' }).click();
    await expect(page.getByRole('alert')).toContainText('Si un compte existe avec cet email, tu vas recevoir un lien');
    await expect(page.getByRole('button', { name: 'Recevoir le lien' })).toBeHidden();

    await page.getByRole('link', { name: 'Retour à la connexion' }).click();
    await expect(page).toHaveURL(/#\/login$/);
  });

  test('vérifie l’email avant l’envoi', async ({ page }) => {
    await page.goto('/#/mot-de-passe-oublie');
    await page.getByRole('button', { name: 'Recevoir le lien' }).click();
    await expect(page.locator('#email-error')).toHaveText('Merci de saisir ton email.');
  });

  test('le lien de l’email permet de choisir un nouveau mot de passe', async ({ page, request }) => {
    const user = await createUser(request);
    const token = createResetToken(user);

    await page.goto(`/#/nouveau-mot-de-passe?token=${token}`);
    await expect(page.getByRole('heading', { name: 'Choisis un nouveau mot de passe' })).toBeVisible();

    const field = page.getByLabel('Nouveau mot de passe', { exact: true });
    await field.fill('123');
    await page.getByRole('button', { name: 'Changer mon mot de passe' }).click();
    await expect(page.locator('#password-error')).toHaveText('Le mot de passe doit faire au moins 6 caractères.');

    await field.fill('ronron456');
    await page.getByRole('button', { name: 'Changer mon mot de passe' }).click();

    await expect(page).toHaveURL(/#\/login\?motdepasse=1$/);
    await expect(page.getByRole('alert')).toHaveText('Ton mot de passe a bien été changé ✓ Connecte-toi avec ton nouveau mot de passe.');

    // L'ancien mot de passe ne marche plus, le nouveau oui
    await loginWithForm(page, user);
    await expect(page.getByRole('alert')).toHaveText('Email ou mot de passe incorrect.');
    await loginWithForm(page, { email: user.email, password: 'ronron456' });
    await expect(page.locator('.topbar__pseudo')).toHaveText(user.pseudo);

    // Le lien ne sert qu'une fois
    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await page.goto(`/#/nouveau-mot-de-passe?token=${token}`);
    await page.getByLabel('Nouveau mot de passe', { exact: true }).fill('encore789');
    await page.getByRole('button', { name: 'Changer mon mot de passe' }).click();
    await expect(page.getByRole('alert')).toContainText('Ce lien n’est plus valable');
    await expect(page.getByRole('link', { name: 'Demander un nouveau lien' })).toHaveAttribute('href', '#/mot-de-passe-oublie');
  });

  test('lien expiré ou incomplet : message et nouveau lien proposé', async ({ page, request }) => {
    const user = await createUser(request);

    await page.goto('/#/nouveau-mot-de-passe');
    await expect(page.getByRole('alert')).toContainText('Ce lien n’est plus valable');
    await expect(page.getByRole('button', { name: 'Changer mon mot de passe' })).toBeHidden();

    await page.goto(`/#/nouveau-mot-de-passe?token=${createResetToken(user, true)}`);
    await page.getByLabel('Nouveau mot de passe', { exact: true }).fill('ronron456');
    await page.getByRole('button', { name: 'Changer mon mot de passe' }).click();
    await expect(page.getByRole('alert')).toContainText('Ce lien n’est plus valable');
  });
});
