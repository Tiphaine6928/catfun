import { ApiError } from '../api';
import { loginErrorMessage, register } from '../auth';
import { navigate } from '../router';
import { rememberRegisteredEmail } from './login';
import {
  clearErrorOnInput,
  hideAlert,
  safeRedirect,
  setFieldError,
  setLoading,
  setupPasswordToggle,
  showAlert,
  PASSWORD_MIN,
  PSEUDO_MAX,
  PSEUDO_MIN,
  validateEmail,
  validatePassword,
  validatePseudo,
} from '../ui/form';
import { AUTH_BRAND } from '../ui/auth-brand';

const TEMPLATE = `
  <main class="auth-page">
    ${AUTH_BRAND}
    <section class="card" aria-labelledby="register-title">
      <h1 id="register-title">Créer un compte</h1>
      <p class="card__subtitle">Rejoins CatFun pour enregistrer tes scores et grimper dans les classements.</p>

      <div class="alert" role="alert" hidden></div>

      <form class="form" novalidate>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" name="email" type="email" autocomplete="email" required>
          <p class="field__error" id="email-error" hidden></p>
        </div>

        <div class="field">
          <label for="pseudo">Pseudo</label>
          <input id="pseudo" name="pseudo" type="text" autocomplete="nickname"
                 minlength="${PSEUDO_MIN}" maxlength="${PSEUDO_MAX}" required aria-describedby="pseudo-help">
          <p class="field__help" id="pseudo-help">
            Affiché dans les classements. ${PSEUDO_MIN} à ${PSEUDO_MAX} caractères : lettres, chiffres, « _ » et « - ».
          </p>
          <p class="field__error" id="pseudo-error" hidden></p>
        </div>

        <div class="field">
          <label for="password">Mot de passe</label>
          <div class="password">
            <input id="password" name="password" type="password" autocomplete="new-password"
                   minlength="${PASSWORD_MIN}" required aria-describedby="password-help">
            <button type="button" class="password__toggle" aria-controls="password" aria-pressed="false">Afficher</button>
          </div>
          <p class="field__help" id="password-help">Au moins ${PASSWORD_MIN} caractères.</p>
          <p class="field__error" id="password-error" hidden></p>
        </div>

        <button type="submit" class="button button--primary">
          <span class="button__label">Créer mon compte</span>
        </button>
      </form>

      <p class="card__legal">
        En créant un compte, tu acceptes que CatFun garde ton email, ton pseudo et tes scores
        comme expliqué dans la page <a href="#/confidentialite">Confidentialité</a>.
      </p>

      <p class="card__footer">
        Déjà un compte ? <a class="login-link" href="#/login">Se connecter</a>
      </p>
    </section>
  </main>
`;

export function renderRegister(container: HTMLElement, params: URLSearchParams): void {
  container.innerHTML = TEMPLATE;

  const form = container.querySelector<HTMLFormElement>('form')!;
  const email = form.querySelector<HTMLInputElement>('#email')!;
  const pseudo = form.querySelector<HTMLInputElement>('#pseudo')!;
  const password = form.querySelector<HTMLInputElement>('#password')!;
  const toggle = form.querySelector<HTMLButtonElement>('.password__toggle')!;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const alert = container.querySelector<HTMLDivElement>('.alert')!;
  const fields: Record<string, HTMLInputElement> = { email, pseudo, password };

  const redirect = params.get('redirect');
  if (redirect) {
    container.querySelector<HTMLAnchorElement>('.login-link')!.href = `#/login?redirect=${encodeURIComponent(redirect)}`;
  }

  setupPasswordToggle(password, toggle);
  clearErrorOnInput(email, pseudo, password);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert(alert);

    const errors: Record<string, string | null> = {
      email: validateEmail(email),
      pseudo: validatePseudo(pseudo.value.trim()),
      password: validatePassword(password.value),
    };
    if (showFieldErrors(errors)) {
      return;
    }

    setLoading(submit, true, 'Créer mon compte', 'Création du compte…');
    try {
      await register(email.value.trim(), pseudo.value.trim(), password.value);
      // Compte créé : on passe à la connexion (email déjà rempli), en gardant la page demandée
      rememberRegisteredEmail(email.value.trim());
      const target = safeRedirect(redirect, ['/login', '/register']);
      navigate(`/login?inscrit=1${target === '/' ? '' : `&redirect=${encodeURIComponent(target)}`}`);
    } catch (error) {
      // Erreurs renvoyées par l'API (email ou pseudo déjà pris…) : affichées sous chaque champ
      const fieldErrors = error instanceof ApiError ? error.fieldErrors : {};
      const known = Object.fromEntries(Object.entries(fieldErrors).filter(([field]) => field in fields));
      if (Object.keys(known).length === 0 || !showFieldErrors(known)) {
        showAlert(alert, loginErrorMessage(error), 'error');
      }
    } finally {
      setLoading(submit, false, 'Créer mon compte', 'Création du compte…');
    }
  });

  email.focus();

  /** Affiche les erreurs et place le focus sur le premier champ en erreur. Renvoie true s'il y en a. */
  function showFieldErrors(errors: Record<string, string | null>): boolean {
    let first: HTMLInputElement | null = null;
    for (const [name, input] of Object.entries(fields)) {
      const message = errors[name] ?? null;
      setFieldError(input, message);
      if (message && !first) {
        first = input;
      }
    }
    first?.focus();

    return first !== null;
  }
}
