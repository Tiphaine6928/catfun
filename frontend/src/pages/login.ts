import { login, loginErrorMessage } from '../auth';
import { API_URL } from '../config';
import { navigate } from '../router';

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
        Pas encore de compte ? <a class="register-link" href="#">Créer un compte</a>
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
  const submitLabel = submit.querySelector<HTMLSpanElement>('.button__label')!;
  const alert = container.querySelector<HTMLDivElement>('.alert')!;

  // L'inscription se fait encore sur le backend (formulaire Symfony)
  container.querySelector<HTMLAnchorElement>('.register-link')!.href = `${API_URL}/register`;

  if (params.get('expired') === '1') {
    showAlert(alert, 'Ta session a expiré, reconnecte-toi.', 'info');
  }

  toggle.addEventListener('click', () => {
    const visible = password.type === 'text';
    password.type = visible ? 'password' : 'text';
    toggle.textContent = visible ? 'Afficher' : 'Masquer';
    toggle.setAttribute('aria-pressed', String(!visible));
  });

  // Une erreur de champ disparaît dès qu'on corrige la saisie
  for (const input of [email, password]) {
    input.addEventListener('input', () => setFieldError(input, null));
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert(alert);

    const emailValue = email.value.trim();
    const emailError = !emailValue
      ? 'Merci de saisir ton email.'
      : email.validity.typeMismatch
        ? 'Cette adresse email n’est pas valide.'
        : null;
    const passwordError = password.value ? null : 'Merci de saisir ton mot de passe.';
    setFieldError(email, emailError);
    setFieldError(password, passwordError);

    if (emailError || passwordError) {
      (emailError ? email : password).focus();
      return;
    }

    setLoading(true);
    try {
      await login(emailValue, password.value);
      navigate(safeRedirect(params.get('redirect')));
    } catch (error) {
      showAlert(alert, loginErrorMessage(error), 'error');
      password.value = '';
      password.focus();
    } finally {
      setLoading(false);
    }
  });

  email.focus();

  function setLoading(loading: boolean): void {
    submit.disabled = loading;
    submit.setAttribute('aria-busy', String(loading));
    submitLabel.textContent = loading ? 'Connexion…' : 'Se connecter';
  }
}

function setFieldError(input: HTMLInputElement, message: string | null): void {
  const error = document.getElementById(`${input.id}-error`)!;
  error.textContent = message ?? '';
  error.hidden = !message;
  input.setAttribute('aria-invalid', String(Boolean(message)));
  if (message) {
    input.setAttribute('aria-describedby', error.id);
  } else {
    input.removeAttribute('aria-describedby');
  }
}

function showAlert(alert: HTMLElement, message: string, kind: 'error' | 'info'): void {
  alert.textContent = message;
  alert.className = `alert alert--${kind}`;
  alert.hidden = false;
}

function hideAlert(alert: HTMLElement): void {
  alert.hidden = true;
  alert.textContent = '';
}

/** N'accepte que des chemins internes (#/…) pour éviter les redirections vers un autre site. */
function safeRedirect(redirect: string | null): string {
  return redirect && /^\/[\w\-/]*$/.test(redirect) && redirect !== '/login' ? redirect : '/';
}
