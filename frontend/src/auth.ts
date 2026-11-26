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
 * Inscription : crée le compte. L'utilisateur se connecte ensuite avec ses identifiants
 * (le token renvoyé par l'API n'est pas utilisé).
 * Lève ApiError 422 avec les erreurs par champ (email, pseudo, password).
 */
export async function register(email: string, pseudo: string, password: string): Promise<CurrentUser> {
  const { user, pseudo: saved } = await apiFetch<CurrentUser>('/api/register', {
    method: 'POST',
    body: { email, pseudo, password },
    auth: false,
  });

  return { user, pseudo: saved };
}

/**
 * « Mot de passe oublié » : demande l'envoi d'un lien par email.
 * Renvoie le message du serveur (le même, que l'email ait un compte ou non).
 */
export async function requestPasswordReset(email: string): Promise<string> {
  const { message } = await apiFetch<{ message: string }>('/api/password/forgot', { method: 'POST', body: { email }, auth: false });
  return message;
}

/**
 * Choisit un nouveau mot de passe avec le jeton reçu par email.
 * Lève ApiError 410 si le lien a expiré ou a déjà servi, 422 si le mot de passe ne respecte pas les règles.
 */
export async function resetPassword(token: string, password: string): Promise<void> {
  await apiFetch('/api/password/reset', { method: 'POST', body: { token, password }, auth: false });
}

/** Toutes les données du compte (droit d'accès et de portabilité), telles que renvoyées par le serveur. */
export function exportMyData(): Promise<unknown> {
  return apiFetch<unknown>('/api/me/export');
}

/**
 * Supprime définitivement le compte et toutes ses données, puis déconnecte.
 * Lève ApiError 422 si le mot de passe est incorrect.
 */
export async function deleteAccount(password: string): Promise<void> {
  await apiFetch('/api/me', { method: 'DELETE', body: { password } });
  logout();
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
