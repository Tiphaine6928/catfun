import { expect, test } from '@playwright/test';
import { createEmailChangeToken, createUser, loginWithForm, loginWithToken, uniqueId } from './helpers';

test.describe('Changer d’email', () => {
  test('depuis Mon profil : mot de passe demandé, puis lien envoyé', async ({ page, request }) => {
    const user = await createUser(request);
    await loginWithToken(page, user);
    await page.goto('/#/profil');

    await page.getByText('Changer d’email').click();
    const newEmail = page.getByLabel('Nouvelle adresse email');
    const password = page.getByLabel('Ton mot de passe actuel');
    const send = page.getByRole('button', { name: 'Envoyer le lien' });

    await send.click();
    await expect(page.locator('#new-email-error')).toHaveText('Merci de saisir ton email.');
    await expect(page.locator('#email-password-error')).toHaveText('Merci de saisir ton mot de passe pour confirmer.');

    await newEmail.fill(user.email.toUpperCase());
    await password.fill(user.password);
    await send.click();
    await expect(page.locator('#new-email-error')).toHaveText('C\'est déjà ton adresse email.');

    const target = `nouveau-${uniqueId()}@cat.fun`;
    await newEmail.fill(target);
    await password.fill('pas-le-bon');
    await send.click();
    await expect(page.locator('#email-password-error')).toHaveText('Mot de passe incorrect.');

    await password.fill(user.password);
    await send.click();
    await expect(page.getByRole('status').filter({ hasText: 'Un lien de confirmation a été envoyé' })).toContainText(target);
    await expect(send).toBeHidden();

    // L'adresse n'a pas encore changé
    await page.reload();
    await expect(page.locator('.profile__email .email')).toHaveText(user.email);
  });

  test('le lien confirme la nouvelle adresse, puis on se reconnecte avec', async ({ page, request }) => {
    const user = await createUser(request);
    const target = `confirme-${uniqueId()}@cat.fun`;
    const token = createEmailChangeToken(user, target);
    await loginWithToken(page, user);

    await page.goto(`/#/confirmer-email?token=${token}`);
    await expect(page.getByRole('heading', { name: 'Nouvelle adresse email' })).toBeVisible();
    await page.getByRole('button', { name: 'Confirmer ma nouvelle adresse' }).click();

    // Déconnecté, sur la connexion avec la nouvelle adresse déjà remplie
    await expect(page).toHaveURL(/#\/login\?nouvelemail=1$/);
    await expect(page.getByRole('alert')).toHaveText('Ton adresse email a bien été changée ✓ Connecte-toi avec ta nouvelle adresse.');
    await expect(page.getByLabel('Email')).toHaveValue(target);

    await loginWithForm(page, { email: user.email, password: user.password });
    await expect(page.getByRole('alert')).toHaveText('Email ou mot de passe incorrect.');
    await loginWithForm(page, { email: target, password: user.password });
    await expect(page.locator('.topbar__pseudo')).toHaveText(user.pseudo);

    // Le lien ne sert qu'une fois
    await page.goto(`/#/confirmer-email?token=${token}`);
    await page.getByRole('button', { name: 'Confirmer ma nouvelle adresse' }).click();
    await expect(page.getByRole('alert')).toContainText('Ce lien n\'est plus valable');
    await expect(page.getByRole('button', { name: 'Confirmer ma nouvelle adresse' })).toBeHidden();
  });

  test('lien incomplet : message et bouton masqué', async ({ page }) => {
    await page.goto('/#/confirmer-email');
    await expect(page.getByRole('alert')).toContainText('Ce lien n’est plus valable');
    await expect(page.getByRole('button', { name: 'Confirmer ma nouvelle adresse' })).toBeHidden();
  });
});
