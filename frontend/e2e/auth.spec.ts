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

test.describe('Logo CatFun', () => {
  for (const [path, title] of [
    ['/#/login', 'Connexion'],
    ['/#/register', 'Créer un compte'],
  ]) {
    test(`affiché sur la page « ${title} », il ramène à l’accueil`, async ({ page }) => {
      await page.goto(path);
      const logo = page.getByRole('link', { name: 'CatFun, retour à l’accueil' });
      await expect(logo.getByRole('img')).toBeVisible();

      await logo.click();
      await expect(page).toHaveURL(/#\/$/);
      await expect(page.getByRole('heading', { name: 'Bienvenue sur CatFun !', level: 1 })).toBeVisible();
    });
  }
});

test.describe('Menu de navigation', () => {
  for (const path of ['/#/login', '/#/register', '/#/mot-de-passe-oublie', '/#/nouveau-mot-de-passe', '/#/confirmer-email']) {
    test(`présent sur ${path}`, async ({ page }) => {
      await page.goto(path);
      const menu = page.getByRole('navigation', { name: 'Navigation principale' });
      for (const name of ['Accueil', 'Pendu', 'Mémoire', 'Classement']) {
        await expect(menu.getByRole('link', { name, exact: true })).toBeVisible();
      }
      await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Confidentialité' })).toBeVisible();
    });
  }

  test('pas de bouton vers la page où l’on est déjà', async ({ page }) => {
    await page.goto('/#/login');
    await expect(page.getByRole('banner').getByRole('link', { name: 'Se connecter' })).toHaveCount(0);
    await expect(page.getByRole('banner').getByRole('link', { name: 'Créer un compte' })).toBeVisible();

    await page.goto('/#/register');
    await expect(page.getByRole('banner').getByRole('link', { name: 'Créer un compte' })).toHaveCount(0);
    await expect(page.getByRole('banner').getByRole('link', { name: 'Se connecter' })).toBeVisible();
  });
});

test.describe('Inscription', () => {
  test('les liens entre connexion et inscription gardent la page demandée', async ({ page }) => {
    await page.goto('/#/pendu');
    await page.getByRole('banner').getByRole('link', { name: 'Créer un compte' }).click();
    await expect(page).toHaveURL(/#\/register\?redirect=%2Fpendu$/);
    await expect(page).toHaveTitle('Créer un compte · CatFun');

    // Depuis la carte…
    await page.getByRole('main').getByRole('link', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/#\/login\?redirect=%2Fpendu$/);

    // … ou depuis la barre du haut : la page demandée est gardée aussi
    await page.getByRole('banner').getByRole('link', { name: 'Créer un compte' }).click();
    await expect(page).toHaveURL(/#\/register\?redirect=%2Fpendu$/);
    await page.getByRole('banner').getByRole('link', { name: 'Se connecter' }).click();
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

  test('inscription réussie : message, puis connexion avec l’email déjà rempli', async ({ page }) => {
    const id = uniqueId();
    const user = { email: `felix-${id}@cat.fun`, pseudo: `Félix-${id}`, password: 'miaou123' };
    await page.goto('/#/register');

    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Pseudo').fill(user.pseudo);
    await page.getByLabel('Mot de passe', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: 'Créer mon compte' }).click();

    // Pas encore connecté : on arrive sur la connexion avec un message
    await expect(page).toHaveURL(/#\/login\?inscrit=1$/);
    await expect(page.getByRole('alert')).toHaveText('Ton inscription a bien été prise en compte ✓ Connecte-toi pour commencer à jouer.');
    await expect(page.getByLabel('Email')).toHaveValue(user.email);
    await expect(page.getByLabel('Mot de passe', { exact: true })).toBeFocused();
    expect(await page.evaluate(() => localStorage.getItem('catfun.token'))).toBeNull();

    await page.getByLabel('Mot de passe', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page).toHaveURL(/#\/$/);
    await expect(page.locator('.topbar__pseudo')).toHaveText(user.pseudo);
    await expect(page.locator('.flash').getByRole('status')).toHaveText(`Connexion réussie ✓ Bienvenue, ${user.pseudo} !`);

    // Le message ne s'affiche qu'une fois
    await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Classement' }).click();
    await expect(page.locator('.flash')).toBeHidden();
  });

  test('l’inscription garde la page demandée jusqu’à la connexion', async ({ page }) => {
    const id = uniqueId();
    const user = { email: `minou-${id}@cat.fun`, pseudo: `Minou-${id}`, password: 'miaou123' };
    await page.goto('/#/register?redirect=%2Fmemoire');
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Pseudo').fill(user.pseudo);
    await page.getByLabel('Mot de passe', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: 'Créer mon compte' }).click();

    await expect(page).toHaveURL(/#\/login\?inscrit=1&redirect=%2Fmemoire$/);
    await page.getByLabel('Mot de passe', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/#\/memoire$/);
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
