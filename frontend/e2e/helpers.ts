import { devices, expect, type APIRequestContext, type Page } from '@playwright/test';
import { API_URL } from '../playwright.config';

export { API_URL };

export interface TestUser {
  email: string;
  pseudo: string;
  password: string;
  token: string;
}

let counter = 0;

/** Identifiant unique par test : les tests ne dépendent pas des comptes des autres. */
export function uniqueId(): string {
  counter += 1;
  return `${Date.now().toString(36)}${counter}`;
}

/** Crée un compte via l'API (plus rapide que le formulaire). */
export async function createUser(request: APIRequestContext, prefix = 'Chat'): Promise<TestUser> {
  const id = uniqueId();
  const user = { email: `${prefix.toLowerCase()}-${id}@cat.fun`, pseudo: `${prefix}-${id}`, password: 'miaou123' };
  const response = await request.post(`${API_URL}/api/register`, { data: user });
  expect(response.status(), await response.text()).toBe(201);
  const { token } = await response.json();

  return { ...user, token };
}

/** Connecte l'utilisateur sans passer par le formulaire : le token est posé avant le chargement. */
export async function loginWithToken(page: Page, user: TestUser): Promise<void> {
  await page.addInitScript((token) => {
    // Seulement si aucun token n'est déjà là (une déconnexion pendant le test doit rester effective)
    if (!sessionStorage.getItem('e2e.tokenSet')) {
      localStorage.setItem('catfun.token', token);
      sessionStorage.setItem('e2e.tokenSet', '1');
    }
  }, user.token);
}

/** Connexion par le formulaire. */
export async function loginWithForm(page: Page, user: Pick<TestUser, 'email' | 'password'>): Promise<void> {
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

export async function gameId(request: APIRequestContext, name: string): Promise<number> {
  const games: { id: number; name: string }[] = await (await request.get(`${API_URL}/api/games`)).json();
  const game = games.find((g) => g.name === name);
  expect(game, `jeu ${name}`).toBeTruthy();

  return game!.id;
}

/** Enregistre un score via l'API ; `level` est obligatoire pour le Mémoire. */
export async function addScore(request: APIRequestContext, user: TestUser, gameName: string, points: number, level?: string): Promise<void> {
  const response = await request.post(`${API_URL}/api/scores`, {
    headers: { Authorization: `Bearer ${user.token}` },
    data: { gameId: await gameId(request, gameName), points, ...(level ? { level } : {}) },
  });
  expect(response.status(), await response.text()).toBe(201);
}

/** Meilleur score d'un joueur, à un niveau donné ou tous niveaux confondus. */
export async function bestScore(request: APIRequestContext, user: TestUser, gameName: string, level?: string): Promise<number | null> {
  const query = level ? `?level=${level}` : '';
  const response = await request.get(`${API_URL}/api/me/games/${await gameId(request, gameName)}/best${query}`, {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  return (await response.json()).best;
}

/** Rend le tirage aléatoire prévisible (Pendu : premier mot = MOUSTACHES). */
export async function fixRandom(page: Page, value = 0): Promise<void> {
  await page.addInitScript((v) => {
    Math.random = () => v;
  }, value);
}

/** Simule un serveur injoignable pour les appels à l'API commençant par `path`. */
export async function cutApi(page: Page, path = '/api/'): Promise<void> {
  await page.route((url) => url.href.startsWith(`${API_URL}${path}`), (route) => route.abort());
}

/** Rétablit l'accès à l'API après cutApi. */
export async function restoreApi(page: Page): Promise<void> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
}

/** Écran de téléphone (taille, tactile, densité) sans changer de navigateur. */
const { defaultBrowserType: _browser, ...pixel7 } = devices['Pixel 7'];
export const MOBILE = pixel7;
