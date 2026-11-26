import { ApiError } from '../api';
import { loginErrorMessage, requestEmailChange } from '../auth';
import { clearErrorOnInput, setFieldError, setLoading, setupPasswordToggle, validateEmail } from '../ui/form';

/**
 * Formulaire « Changer d'email » de Mon profil (droit de rectification).
 * L'adresse ne change qu'après un clic sur le lien envoyé à la nouvelle adresse.
 */
const TEMPLATE = `
  <summary>Changer d’email</summary>
  <p>Un lien de confirmation sera envoyé à ta nouvelle adresse : elle ne remplacera l’ancienne qu’après un clic sur ce lien.</p>
  <form class="form" novalidate>
    <div class="field">
      <label for="new-email">Nouvelle adresse email</label>
      <input id="new-email" name="email" type="email" autocomplete="email" required>
      <p class="field__error" id="new-email-error" hidden></p>
    </div>
    <div class="field">
      <label for="email-password">Ton mot de passe actuel</label>
      <div class="password">
        <input id="email-password" name="password" type="password" autocomplete="current-password" required>
        <button type="button" class="password__toggle" aria-controls="email-password" aria-pressed="false">Afficher</button>
      </div>
      <p class="field__error" id="email-password-error" hidden></p>
    </div>
    <div class="profile__actions">
      <button type="submit" class="button button--primary"><span class="button__label">Envoyer le lien</span></button>
    </div>
  </form>
  <p class="email-change__status" role="status"></p>
`;

export function renderEmailChange(): HTMLElement {
  const details = document.createElement('details');
  details.className = 'email-change';
  details.innerHTML = TEMPLATE;

  const form = details.querySelector<HTMLFormElement>('form')!;
  const email = form.querySelector<HTMLInputElement>('#new-email')!;
  const password = form.querySelector<HTMLInputElement>('#email-password')!;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const status = details.querySelector<HTMLElement>('.email-change__status')!;
  setupPasswordToggle(password, form.querySelector<HTMLButtonElement>('.password__toggle')!);
  clearErrorOnInput(email, password);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.textContent = '';
    const errors = {
      email: validateEmail(email),
      password: password.value ? null : 'Merci de saisir ton mot de passe pour confirmer.',
    };
    setFieldError(email, errors.email);
    setFieldError(password, errors.password);
    if (errors.email || errors.password) {
      (errors.email ? email : password).focus();
      return;
    }

    setLoading(submit, true, 'Envoyer le lien', 'Envoi…');
    try {
      const message = await requestEmailChange(email.value.trim(), password.value);
      form.reset();
      form.hidden = true;
      status.className = 'email-change__status score-save--ok';
      status.textContent = `${message} Pense à regarder dans tes courriers indésirables.`;
    } catch (error) {
      const fields = error instanceof ApiError ? error.fieldErrors : {};
      if (fields.email || fields.password) {
        setFieldError(email, fields.email ?? null);
        setFieldError(password, fields.password ?? null);
        (fields.email ? email : password).focus();
      } else {
        status.className = 'email-change__status score-save--error';
        status.textContent = loginErrorMessage(error);
      }
    } finally {
      setLoading(submit, false, 'Envoyer le lien', 'Envoi…');
    }
  });

  return details;
}
