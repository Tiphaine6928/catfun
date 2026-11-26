import { requestPasswordReset, loginErrorMessage } from '../auth';
import { clearErrorOnInput, hideAlert, setFieldError, setLoading, showAlert, validateEmail } from '../ui/form';
import { AUTH_BRAND } from '../ui/auth-brand';

const TEMPLATE = `
  <main class="auth-page">
    ${AUTH_BRAND}
    <section class="card" aria-labelledby="forgot-title">
      <p class="card__logo" aria-hidden="true">🙀</p>
      <h1 id="forgot-title">Mot de passe oublié</h1>
      <p class="card__subtitle">Pas de panique ! Indique ton email : tu vas recevoir un lien pour choisir un nouveau mot de passe.</p>

      <div class="alert" role="alert" hidden></div>

      <form class="form" novalidate>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" name="email" type="email" autocomplete="email" required>
          <p class="field__error" id="email-error" hidden></p>
        </div>

        <button type="submit" class="button button--primary">
          <span class="button__label">Recevoir le lien</span>
        </button>
      </form>

      <p class="card__footer">
        <a class="login-link" href="#/login">Retour à la connexion</a>
      </p>
    </section>
  </main>
`;

/** Email déjà saisi sur la page de connexion, pour pré-remplir le formulaire. */
let typedEmail = '';

export function rememberTypedEmail(email: string): void {
  typedEmail = email;
}

export function renderForgotPassword(container: HTMLElement): void {
  container.innerHTML = TEMPLATE;

  const form = container.querySelector<HTMLFormElement>('form')!;
  const email = form.querySelector<HTMLInputElement>('#email')!;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const alert = container.querySelector<HTMLDivElement>('.alert')!;

  email.value = typedEmail;
  typedEmail = '';
  clearErrorOnInput(email);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert(alert);

    const error = validateEmail(email);
    setFieldError(email, error);
    if (error) {
      email.focus();
      return;
    }

    setLoading(submit, true, 'Recevoir le lien', 'Envoi…');
    try {
      const message = await requestPasswordReset(email.value.trim());
      // Même message que l'email ait un compte ou non (le serveur ne le révèle pas)
      showAlert(alert, `${message} Pense à regarder dans tes courriers indésirables.`, 'info');
      form.hidden = true;
    } catch (error) {
      showAlert(alert, loginErrorMessage(error), 'error');
    } finally {
      setLoading(submit, false, 'Recevoir le lien', 'Envoi…');
    }
  });

  email.focus();
}
