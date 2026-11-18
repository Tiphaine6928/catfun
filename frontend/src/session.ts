/**
 * Stockage du token JWT dans le navigateur.
 * localStorage : la session survit à un rechargement de la page et à la fermeture de l'onglet.
 */
const TOKEN_KEY = 'catfun.token';

export function getToken(): string | null {
  let token: string | null = null;
  try {
    token = localStorage.getItem(TOKEN_KEY);
  } catch {
    return null; // stockage indisponible (navigation privée stricte…)
  }

  if (token && isExpired(token)) {
    clearToken();
    return null;
  }

  return token;
}

export function saveToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Sans stockage, la session ne durera que le temps de la page
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // rien à faire
  }
}

/** Lit la date d'expiration ("exp", en secondes) contenue dans le token. */
function isExpired(token: string): boolean {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const { exp } = JSON.parse(json) as { exp?: number };
    return typeof exp === 'number' && exp * 1000 <= Date.now();
  } catch {
    return true; // token illisible : on le considère comme invalide
  }
}
