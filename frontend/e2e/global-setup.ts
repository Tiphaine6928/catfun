import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * Prépare le backend avant les tests :
 *  - secrets et clés JWT (bin/init-env.sh, ne réécrit rien d'existant),
 *  - base de TEST (catfun_test) recréée par les migrations : les deux jeux, aucun joueur.
 * La base de développement n'est jamais touchée.
 */
export default function globalSetup(): void {
  const backendDir = resolve(process.env.E2E_BACKEND_DIR ?? '../backend');
  const run = (command: string) => execSync(command, { cwd: backendDir, stdio: 'pipe', env: { ...process.env, APP_ENV: 'test' } });

  run('sh bin/init-env.sh');
  run('php bin/console doctrine:database:create --env=test --if-not-exists --no-interaction');
  run('php bin/console doctrine:schema:drop --env=test --force --full-database --no-interaction');
  run('php bin/console doctrine:migrations:migrate --env=test --no-interaction');
}
