/**
 * Message à afficher une seule fois en haut de la prochaine page (après une redirection).
 * Exemple : « Score enregistré » après s'être connecté depuis la fin d'une partie.
 */
export interface Flash {
  message: string;
  kind: 'info' | 'error';
}

let pending: Flash | null = null;

export function setFlash(flash: Flash): void {
  pending = flash;
}

/** Renvoie le message en attente et l'efface. */
export function takeFlash(): Flash | null {
  const flash = pending;
  pending = null;
  return flash;
}
