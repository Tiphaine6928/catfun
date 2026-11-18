import { login, loginErrorMessage } from '../auth';
import { navigate } from '../router';
import {
  clearErrorOnInput,
  hideAlert,
  safeRedirect,
  setFieldError,
  setLoading,
  setupPasswordToggle,
  showAlert,
  validateEmail,
} from '../ui/form';

const TEMPLATE = `
  <main class="auth-page">
    <section class="card" aria-labelledby="login-title">
      <p class="card__logo" aria-hidden="true">🐱</p>
      <h1 id="login-title">Connexion</h1>
      <p class="card__subtitle">Content de te revoir ! Connecte-toi pour enregistrer tes scores.</p>

      <div class="alert" role="alert" hidden></div>

      <form class="form" novalidate>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" name="email" type="email" autocomplete="email" required>
          <p class="field__error" id="email-error" hidden></p>
        </div>

        <div class="field">
          <label for="password">Mot de passe</label>
          <div class="password">
            <input id="password" name="password" type="password" autocomplete="current-password" required>
            <button type="button" class="password__toggle" aria-controls="password" aria-pressed="false">Afficher</button>
          </div>
          <p class="field__error" id="password-error" hidden></p>
        </div>

        <button type="submit" class="button button--primary">
          <span class="button__label">Se connecter</span>
        </button>
      </form>

      <p class="card__footer">
        Pas encore de compte ? <a class="register-link" href="#/register">Créer un compte</a>
      </p>
    </section>
  </main>
`;

export function renderLogin(container: HTMLElement, params: URLSearchParams): void {
  container.innerHTML = TEMPLATE;

  const form = container.querySelector<HTMLFormElement>('form')!;
  const email = form.querySelector<HTMLInputElement>('#email')!;
  const password = form.querySelector<HTMLInputElement>('#password')!;
  const toggle = form.querySelector<HTMLButtonElement>('.password__toggle')!;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const alert = container.querySelector<HTMLDivElement>('.alert')!;

  // On garde la page demandée si l'utilisateur passe par l'inscription
  const redirect = params.get('redirect');
  if (redirect) {
    container.querySelector<HTMLAnchorElement>('.register-link')!.href = `#/register?redirect=${encodeURIComponent(redirect)}`;
  }

  if (params.get('expired') === '1') {
    showAlert(alert, 'Ta session a expiré, reconnecte-toi.', 'info');
  }

  setupPasswordToggle(password, toggle);
  clearErrorOnInput(email, password);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert(alert);

    const emailError = validateEmail(email);
    const passwordError = password.value ? null : 'Merci de saisir ton mot de passe.';
    setFieldError(email, emailError);
    setFieldError(password, passwordError);

    if (emailError || passwordError) {
      (emailError ? email : password).focus();
      return;
    }

    setLoading(submit, true, 'Se connecter', 'Connexion…');
    try {
      await login(email.value.trim(), password.value);
      navigate(safeRedirect(params.get('redirect'), ['/login', '/register']));
    } catch (error) {
      showAlert(alert, loginErrorMessage(error), 'error');
      password.value = '';
      password.focus();
    } finally {
      setLoading(submit, false, 'Se connecter', 'Connexion…');
    }
  });

  email.focus();
}
