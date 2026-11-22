import { ApiError, apiFetch } from './api';
import { clearToken, getToken, saveToken } from './session';

export interface CurrentUser {
  user: string; // email
  pseudo: string;
}

let currentUser: CurrentUser | null = null;

export function isLoggedIn(): boolean {
  return getToken() !== null;
}

/**
 * Connexion : échange email + mot de passe contre un token JWT.
 * Lève ApiError 401 si les identifiants sont incorrects.
 */
export async function login(email: string, password: string): Promise<CurrentUser> {
  const { token } = await apiFetch<{ token: string }>('/api/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  });
  saveToken(token);
  currentUser = null;

  return fetchCurrentUser();
}

/**
 * Inscription : crée le compte et connecte directement l'utilisateur.
 * Lève ApiError 422 avec les erreurs par champ (email, pseudo, password).
 */
export async function register(email: string, pseudo: string, password: string): Promise<CurrentUser> {
  const { token, ...user } = await apiFetch<{ token: string } & CurrentUser>('/api/register', {
    method: 'POST',
    body: { email, pseudo, password },
    auth: false,
  });
  saveToken(token);
  currentUser = user;

  return user;
}

export function logout(): void {
  clearToken();
  currentUser = null;
}

/**
 * Change le pseudo de l'utilisateur connecté (PATCH /api/me).
 * Lève ApiError 422 avec le message du serveur (pseudo déjà pris…).
 */
export async function updatePseudo(pseudo: string): Promise<CurrentUser> {
  const { user, pseudo: saved } = await apiFetch<CurrentUser>('/api/me', { method: 'PATCH', body: { pseudo } });
  currentUser = { user, pseudo: saved };

  return currentUser;
}

/** Utilisateur connecté (mis en cache après le premier appel). */
export async function fetchCurrentUser(): Promise<CurrentUser> {
  currentUser ??= await apiFetch<CurrentUser>('/api/me');

  return currentUser;
}

/** Message à afficher pour une erreur de connexion ou d'inscription. */
export function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Email ou mot de passe incorrect.';
    }
    if (error.status === 422) {
      return 'Certains champs sont invalides, corrige-les puis réessaie.';
    }
    if (error.status === 429) {
      // Le serveur précise combien de temps attendre (« Réessaie dans 15 minutes. »)
      return error.message.startsWith('Erreur ') ? 'Trop de tentatives, réessaie dans quelques minutes.' : error.message;
    }

    return 'Le serveur a rencontré un problème. Réessaie plus tard.';
  }

  return error instanceof Error ? error.message : 'Une erreur inattendue est survenue.';
}
