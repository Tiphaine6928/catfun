import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

/**
 * Tests de bout en bout : le vrai frontend (Vite) contre le vrai backend Symfony.
 *
 * Playwright démarre lui-même :
 *  - le backend avec le serveur PHP intégré, en environnement "test" (base catfun_test),
 *  - le frontend avec Vite, branché sur ce backend.
 * La base de test est recréée avant les tests (voir e2e/global-setup.ts).
 *
 * L'environnement "test" est indispensable : le hasard des jeux y est prévisible
 * (premier mot du Pendu = MOUSTACHES, cartes du Mémoire par paires côte à côte),
 * et les tests du classement y insèrent leurs scores directement en base.
 */
export const API_URL = 'http://127.0.0.1:8099';
/** Dossier du backend (bin/console), modifiable pour une copie installée ailleurs. */
export const BACKEND_DIR = resolve(process.env.E2E_BACKEND_DIR ?? '../backend');
const FRONT_PORT = 5174;

export default defineConfig({
  testDir: './e2e',
  // Les tests partagent une base : on les lance un par un, dans un ordre stable
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${FRONT_PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Chromium déjà installé ailleurs (ex. conteneur de CI) : chemin optionnel
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // variables_order=EGPCS : transmet APP_ENV=test au serveur PHP intégré
      command: `php -d variables_order=EGPCS -S 127.0.0.1:8099 -t "${resolve(BACKEND_DIR, 'public')}"`,
      // Route qui ne lit pas la base : celle-ci n'est créée qu'ensuite, par global-setup.
      // Sans token, /api/me répond 401, ce que Playwright considère comme « serveur prêt ».
      url: `${API_URL}/api/me`,
      // Seuils de tentatives très élevés : les tests créent des dizaines de comptes depuis la même adresse.
      // (Les limites elles-mêmes sont testées par PHPUnit : tests/Controller/Api/RateLimitTest.php.)
      env: {
        APP_ENV: 'test',
        REGISTRATION_MAX_ATTEMPTS: '100000',
        LOGIN_MAX_ATTEMPTS_PER_ACCOUNT: '100000',
        LOGIN_MAX_ATTEMPTS_PER_IP: '100000',
        GUEST_GAMES_MAX_PER_HOUR: '100000',
        PASSWORD_RESET_MAX_PER_HOUR: '100000',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${FRONT_PORT} --strictPort`,
      url: `http://localhost:${FRONT_PORT}`,
      env: { VITE_API_URL: API_URL },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
