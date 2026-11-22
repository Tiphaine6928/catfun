import { expect, test } from '@playwright/test';
import { createUser, cutApi, loginWithForm, uniqueId } from './helpers';

test.describe('Connexion', () => {
  test('une page protégée renvoie vers la connexion, puis revient après connexion', async ({ page, request }) => {
    const user = await createUser(request);

    await page.goto('/#/profil');
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
    await expect(page).toHaveURL(/#\/login\?redirect=%2Fprofil$/);
    await expect(page).toHaveTitle('Connexion · CatFun');
    await expect(page.getByLabel('Email')).toBeFocused();

    await loginWithForm(page, user);
    await expect(page).toHaveURL(/#\/profil$/);
    await expect(page.locator('.topbar__pseudo')).toHaveText(user.pseudo);
  });

  test('« Se connecter » depuis un jeu ramène sur ce jeu', async ({ page, request }) => {
    const user = await createUser(request);
    await page.goto('/#/pendu');
    await page.getByRole('banner').getByRole('link', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/#\/login\?redirect=%2Fpendu$/);

    await loginWithForm(page, user);
    await expect(page).toHaveURL(/#\/pendu$/);
    await expect(page.locator('.topbar__pseudo')).toHaveText(user.pseudo);
  });

  test('vérifie la saisie avant d’appeler le serveur', async ({ page }) => {
    await page.goto('/#/login');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.locator('#email-error')).toHaveText('Merci de saisir ton email.');
    await expect(page.locator('#password-error')).toHaveText('Merci de saisir ton mot de passe.');
    await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');

    await page.getByLabel('Email').fill('toto');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.locator('#email-error')).toContainText('pas valide');

    await page.getByLabel('Email').fill('toto@cat.fun');
    await expect(page.locator('#email-error')).toBeHidden();
  });

  test('mauvais mot de passe : message clair et mot de passe vidé', async ({ page, request }) => {
    const user = await createUser(request);
    await page.goto('/#/login');

    await loginWithForm(page, { email: user.email, password: 'mauvais' });

    await expect(page.getByRole('alert')).toHaveText('Email ou mot de passe incorrect.');
    await expect(page.getByLabel('Mot de passe', { exact: true })).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeEnabled();
  });

  test('bouton Afficher / Masquer le mot de passe', async ({ page }) => {
    await page.goto('/#/login');
    const password = page.getByLabel('Mot de passe', { exact: true });
    await page.getByRole('button', { name: 'Afficher' }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Masquer' }).click();
    await expect(password).toHaveAttribute('type', 'password');
  });

  test('la session survit au rechargement, la déconnexion supprime le token', async ({ page, request }) => {
    const user = await createUser(request);
    await page.goto('/#/login');
    await loginWithForm(page, user);
    await expect(page.locator('.topbar__pseudo')).toHaveText(user.pseudo);

    await page.reload();
    await expect(page.locator('.topbar__pseudo')).toHaveText(user.pseudo);

    // Déjà connecté : la page de connexion renvoie à l'accueil
    await page.goto('/#/login');
    await expect(page).toHaveURL(/#\/$/);

    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('catfun.token'))).toBeNull();
  });

  test('un token expiré ou refusé renvoie à la connexion', async ({ page }) => {
    const fakeToken = (exp: number) => `x.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.y`;
    await page.goto('/#/login');

    // Expiré : supprimé sans appeler le serveur
    await page.evaluate((t) => localStorage.setItem('catfun.token', t), fakeToken(1000));
    await page.goto('/#/profil');
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();

    // Pas expiré mais refusé par l'API (signature invalide)
    await page.evaluate((t) => localStorage.setItem('catfun.token', t), fakeToken(Math.floor(Date.now() / 1000) + 3600));
    await page.goto('/#/pendu');
    await expect(page.getByRole('alert')).toContainText('Ta session a expiré');
  });

  test('serveur injoignable : message d’erreur', async ({ page, request }) => {
    const user = await createUser(request);
    await page.goto('/#/login');
    await cutApi(page);

    await loginWithForm(page, user);

    await expect(page.getByRole('alert')).toContainText('Impossible de joindre le serveur');
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeEnabled();
  });
});

test.describe('Inscription', () => {
  test('les liens entre connexion et inscription gardent la page demandée', async ({ page }) => {
    await page.goto('/#/pendu');
    await page.getByRole('link', { name: 'Créer un compte' }).click();
    await expect(page).toHaveURL(/#\/register\?redirect=%2Fpendu$/);
    await expect(page).toHaveTitle('Créer un compte · CatFun');

    await page.getByRole('link', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/#\/login\?redirect=%2Fpendu$/);
  });

  test('vérifie chaque champ avant l’envoi', async ({ page }) => {
    await page.goto('/#/register');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page.locator('#email-error')).toHaveText('Merci de saisir ton email.');
    await expect(page.locator('#pseudo-error')).toHaveText('Merci de choisir un pseudo.');
    await expect(page.locator('#password-error')).toHaveText('Merci de choisir un mot de passe.');
    await expect(page.getByLabel('Email')).toBeFocused();
    await expect(page.getByLabel('Pseudo')).toHaveAttribute('aria-describedby', 'pseudo-help pseudo-error');

    await page.getByLabel('Email').fill('felix@cat.fun');
    await page.getByLabel('Pseudo').fill('ab');
    await page.getByLabel('Mot de passe', { exact: true }).fill('123');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page.locator('#pseudo-error')).toContainText('au moins 3');
    await expect(page.locator('#password-error')).toContainText('au moins 6');

    await page.getByLabel('Pseudo').fill('Félix le chat');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page.locator('#pseudo-error')).toContainText('ne peut contenir que');
  });

  test('email et pseudo déjà pris : erreurs renvoyées par l’API sous chaque champ', async ({ page, request }) => {
    const existing = await createUser(request);
    await page.goto('/#/register');

    await page.getByLabel('Email').fill(existing.email.toUpperCase());
    await page.getByLabel('Pseudo').fill(existing.pseudo.toUpperCase());
    await page.getByLabel('Mot de passe', { exact: true }).fill('miaou123');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();

    await expect(page.locator('#email-error')).toHaveText('Un compte existe déjà avec cet email.');
    await expect(page.locator('#pseudo-error')).toHaveText('Ce pseudo est déjà pris.');
    await expect(page.getByRole('alert')).toBeHidden();
  });

  test('inscription réussie : connecté directement, puis connexion avec le compte créé', async ({ page }) => {
    const id = uniqueId();
    const user = { email: `felix-${id}@cat.fun`, pseudo: `Félix-${id}`, password: 'miaou123' };
    await page.goto('/#/register');

    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Pseudo').fill(user.pseudo);
    await page.getByLabel('Mot de passe', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: 'Créer mon compte' }).click();

    await expect(page).toHaveURL(/#\/$/);
    await expect(page.locator('.topbar__pseudo')).toHaveText(user.pseudo);

    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await loginWithForm(page, user);
    await expect(page.locator('.topbar__pseudo')).toHaveText(user.pseudo);
  });
});

test.describe('Trop de tentatives', () => {
  // Le blocage lui-même est testé côté serveur (PHPUnit) ; ici, l'affichage du message du serveur.
  const tooMany = (message: string) => ({
    status: 429,
    contentType: 'application/json',
    headers: { 'Retry-After': '900' },
    body: JSON.stringify({ code: 429, message }),
  });

  test('connexion bloquée : le message du serveur est affiché', async ({ page }) => {
    await page.route('**/api/login', (route) => route.fulfill(tooMany('Trop de tentatives de connexion. Réessaie dans 15 minutes.')));
    await page.goto('/#/login');
    await loginWithForm(page, { email: 'felix@cat.fun', password: 'miaou123' });

    await expect(page.getByRole('alert')).toHaveText('Trop de tentatives de connexion. Réessaie dans 15 minutes.');
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeEnabled();
  });

  test('inscription bloquée : le message du serveur est affiché', async ({ page }) => {
    await page.route('**/api/register', (route) => route.fulfill(tooMany('Trop de tentatives d’inscription. Réessaie dans 42 minutes.')));
    await page.goto('/#/register');
    await page.getByLabel('Email').fill('felix@cat.fun');
    await page.getByLabel('Pseudo').fill('Félix');
    await page.getByLabel('Mot de passe', { exact: true }).fill('miaou123');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();

    await expect(page.getByRole('alert')).toHaveText('Trop de tentatives d’inscription. Réessaie dans 42 minutes.');
  });
});
