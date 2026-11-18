import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

/**
 * Tests de bout en bout : le vrai frontend (Vite) contre le vrai backend Symfony.
 *
 * Par défaut, Playwright démarre lui-même :
 *  - le backend avec le serveur PHP intégré, en environnement "test" (base catfun_test),
 *  - le frontend avec Vite, branché sur ce backend.
 * La base de test est recréée avant les tests (voir e2e/global-setup.ts).
 *
 * Pour viser un backend déjà lancé (Docker…), sans toucher à sa base :
 *   E2E_API_URL=http://localhost:8082 npm run test:e2e
 */
const externalApi = process.env.E2E_API_URL;
export const API_URL = externalApi ?? 'http://127.0.0.1:8099';
const FRONT_PORT = 5174;
const backendDir = resolve(process.env.E2E_BACKEND_DIR ?? '../backend');

export default defineConfig({
  testDir: './e2e',
  // Les tests partagent une base : on les lance un par un, dans un ordre stable
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: externalApi ? undefined : './e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${FRONT_PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Chromium déjà installé ailleurs (ex. conteneur de CI) : chemin optionnel
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    ...(externalApi
      ? []
      : [
          {
            // variables_order=EGPCS : transmet APP_ENV=test au serveur PHP intégré
            command: `php -d variables_order=EGPCS -S 127.0.0.1:8099 -t "${resolve(backendDir, 'public')}"`,
            url: `${API_URL}/api/games`,
            env: { APP_ENV: 'test' },
            reuseExistingServer: !process.env.CI,
            timeout: 60_000,
          },
        ]),
    {
      command: `npx vite --port ${FRONT_PORT} --strictPort`,
      url: `http://localhost:${FRONT_PORT}`,
      env: { VITE_API_URL: API_URL },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
