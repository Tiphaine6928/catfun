/**
 * Helpers partagés par les formulaires (connexion, inscription…).
 * Les messages sont toujours insérés avec textContent : jamais interprétés comme du HTML.
 */

/** Affiche (ou efface avec null) le message d'erreur sous un champ. */
export function setFieldError(input: HTMLInputElement, message: string | null): void {
  const error = document.getElementById(`${input.id}-error`);
  if (!error) {
    return;
  }

  error.textContent = message ?? '';
  error.hidden = !message;
  input.setAttribute('aria-invalid', String(Boolean(message)));

  // Le message d'erreur s'ajoute à l'aide éventuelle du champ pour les lecteurs d'écran
  const help = document.getElementById(`${input.id}-help`);
  const describedBy = [help?.id, message ? error.id : null].filter(Boolean).join(' ');
  if (describedBy) {
    input.setAttribute('aria-describedby', describedBy);
  } else {
    input.removeAttribute('aria-describedby');
  }
}

/** Efface l'erreur d'un champ dès que l'utilisateur modifie sa saisie. */
export function clearErrorOnInput(...inputs: HTMLInputElement[]): void {
  for (const input of inputs) {
    input.addEventListener('input', () => setFieldError(input, null));
  }
}

export function showAlert(alert: HTMLElement, message: string, kind: 'error' | 'info'): void {
  alert.textContent = message;
  alert.className = `alert alert--${kind}`;
  alert.hidden = false;
}

export function hideAlert(alert: HTMLElement): void {
  alert.hidden = true;
  alert.textContent = '';
}

/** Bouton "Afficher / Masquer" d'un champ mot de passe. */
export function setupPasswordToggle(password: HTMLInputElement, toggle: HTMLButtonElement): void {
  toggle.addEventListener('click', () => {
    const visible = password.type === 'text';
    password.type = visible ? 'password' : 'text';
    toggle.textContent = visible ? 'Afficher' : 'Masquer';
    toggle.setAttribute('aria-pressed', String(!visible));
  });
}

/** Désactive le bouton d'envoi et change son texte pendant une requête. */
export function setLoading(button: HTMLButtonElement, loading: boolean, idleLabel: string, loadingLabel: string): void {
  button.disabled = loading;
  button.setAttribute('aria-busy', String(loading));
  const label = button.querySelector('.button__label') ?? button;
  label.textContent = loading ? loadingLabel : idleLabel;
}

/** Message d'erreur pour un champ email (null si valide). */
export function validateEmail(input: HTMLInputElement): string | null {
  if (!input.value.trim()) {
    return 'Merci de saisir ton email.';
  }

  return input.validity.typeMismatch ? 'Cette adresse email n’est pas valide.' : null;
}

/** N'accepte que des chemins internes (#/…) pour éviter les redirections vers un autre site. */
export function safeRedirect(redirect: string | null, excluded: string[] = []): string {
  return redirect && /^\/[\w\-/]*$/.test(redirect) && !excluded.includes(redirect) ? redirect : '/';
}
