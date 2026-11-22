import { ApiError } from '../api';
import { loginErrorMessage, resetPassword } from '../auth';
import { navigate } from '../router';
import {
  clearErrorOnInput,
  hideAlert,
  PASSWORD_MIN,
  setFieldError,
  setLoading,
  setupPasswordToggle,
  showAlert,
  validatePassword,
} from '../ui/form';

const TEMPLATE = `
  <main class="auth-page">
    <section class="card" aria-labelledby="reset-title">
      <p class="card__logo" aria-hidden="true">🔑</p>
      <h1 id="reset-title">Choisis un nouveau mot de passe</h1>
      <p class="card__subtitle">Il remplacera l’ancien pour te connecter à CatFun.</p>

      <div class="alert" role="alert" hidden></div>

      <form class="form" novalidate>
        <div class="field">
          <label for="password">Nouveau mot de passe</label>
          <div class="password">
            <input id="password" name="password" type="password" autocomplete="new-password"
                   minlength="${PASSWORD_MIN}" required aria-describedby="password-help">
            <button type="button" class="password__toggle" aria-controls="password" aria-pressed="false">Afficher</button>
          </div>
          <p class="field__help" id="password-help">Au moins ${PASSWORD_MIN} caractères.</p>
          <p class="field__error" id="password-error" hidden></p>
        </div>

        <button type="submit" class="button button--primary">
          <span class="button__label">Changer mon mot de passe</span>
        </button>
      </form>

      <p class="card__footer">
        <a class="forgot-link" href="#/mot-de-passe-oublie">Demander un nouveau lien</a>
      </p>
    </section>
  </main>
`;

const EXPIRED = 'Ce lien n’est plus valable (il a expiré ou a déjà servi). Demande un nouveau lien ci-dessous.';

/** Page ouverte depuis le lien de l'email : #/nouveau-mot-de-passe?token=… */
export function renderResetPassword(container: HTMLElement, params: URLSearchParams): void {
  container.innerHTML = TEMPLATE;

  const form = container.querySelector<HTMLFormElement>('form')!;
  const password = form.querySelector<HTMLInputElement>('#password')!;
  const toggle = form.querySelector<HTMLButtonElement>('.password__toggle')!;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const alert = container.querySelector<HTMLDivElement>('.alert')!;

  const token = params.get('token') ?? '';
  if (!/^[0-9a-f]{64}$/.test(token)) {
    showAlert(alert, EXPIRED, 'error');
    form.hidden = true;
    return;
  }

  setupPasswordToggle(password, toggle);
  clearErrorOnInput(password);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert(alert);

    const error = validatePassword(password.value);
    setFieldError(password, error);
    if (error) {
      password.focus();
      return;
    }

    setLoading(submit, true, 'Changer mon mot de passe', 'Enregistrement…');
    try {
      await resetPassword(token, password.value);
      navigate('/login?motdepasse=1');
    } catch (error) {
      if (error instanceof ApiError && error.status === 410) {
        showAlert(alert, EXPIRED, 'error');
        form.hidden = true;
      } else if (error instanceof ApiError && error.fieldErrors.password) {
        setFieldError(password, error.fieldErrors.password);
        password.focus();
      } else {
        showAlert(alert, loginErrorMessage(error), 'error');
      }
    } finally {
      setLoading(submit, false, 'Changer mon mot de passe', 'Enregistrement…');
    }
  });

  password.focus();
}
