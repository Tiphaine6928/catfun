import { API_URL } from './config';
import { clearToken, getToken } from './session';

/** Erreur renvoyée par l'API (statut HTTP + message + erreurs par champ). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Le serveur n'a pas répondu (backend arrêté, mauvaise URL, CORS…). */
export class NetworkError extends Error {
  constructor() {
    super('Impossible de joindre le serveur. Vérifie que le backend est lancé.');
    this.name = 'NetworkError';
  }
}

/** Appelé quand le token est refusé (expiré, invalide) : la session est terminée. */
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** false pour les routes publiques (connexion) : aucun token envoyé. */
  auth?: boolean;
}

/**
 * Appelle l'API en JSON. Ajoute le token JWT si l'utilisateur est connecté.
 * Lève ApiError (réponse d'erreur) ou NetworkError (pas de réponse).
 */
export async function apiFetch<T>(path: string, { method = 'GET', body, auth = true }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const token = auth ? getToken() : null;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new NetworkError();
  }

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && token) {
      clearToken();
      onUnauthorized();
    }
    const payload = (data ?? {}) as { message?: unknown; errors?: unknown };
    throw new ApiError(
      response.status,
      typeof payload.message === 'string' ? payload.message : `Erreur ${response.status}`,
      isStringRecord(payload.errors) ? payload.errors : {},
    );
  }

  return data as T;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return typeof value === 'object' && value !== null && Object.values(value).every((v) => typeof v === 'string');
}
