import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Tests unitaires seulement : les tests de bout en bout (e2e/) sont lancés par Playwright
    include: ['src/**/*.test.ts'],
  },
});
