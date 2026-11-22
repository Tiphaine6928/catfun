/**
 * Messages à afficher une seule fois en haut de la prochaine page (après une redirection).
 * Exemples : « Connexion réussie », « Score enregistré » après s'être connecté depuis la fin d'une partie.
 */
export interface Flash {
  message: string;
  kind: 'info' | 'error';
}

let pending: Flash[] = [];

export function addFlash(flash: Flash): void {
  pending.push(flash);
}

/** Renvoie les messages en attente et les efface. */
export function takeFlashes(): Flash[] {
  const flashes = pending;
  pending = [];
  return flashes;
}
