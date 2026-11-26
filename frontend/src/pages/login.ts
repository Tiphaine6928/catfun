import { login, loginErrorMessage } from '../auth';
import { claimPendingScore } from '../games/pending-score';
import { navigate } from '../router';
import { addFlash } from '../ui/flash';
import { rememberTypedEmail } from './forgot-password';
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
import { AUTH_BRAND } from '../ui/auth-brand';
import { renderLayout } from '../ui/layout';

const TEMPLATE = `
  <div class="auth-page">
    ${AUTH_BRAND}
    <section class="card" aria-labelledby="login-title">
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
          <div class="field__label-row">
            <label for="password">Mot de passe</label>
            <a class="forgot-link" href="#/mot-de-passe-oublie">Mot de passe oublié ?</a>
          </div>
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
  </div>
`;

/** Email du compte qui vient d'être créé (ou de changer d'adresse), pour pré-remplir le formulaire de connexion. */
let registeredEmail: string | null = null;

export function rememberRegisteredEmail(email: string): void {
  registeredEmail = email;
}

export function renderLogin(container: HTMLElement, params: URLSearchParams): void {
  // Barre du haut et pied de page communs à tout le site, la carte au milieu
  renderLayout(container, '/login').innerHTML = TEMPLATE;

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
  if (params.get('motdepasse') === '1') {
    showAlert(alert, 'Ton mot de passe a bien été changé ✓ Connecte-toi avec ton nouveau mot de passe.', 'info');
  }
  // L'email déjà tapé suit vers « Mot de passe oublié »
  container.querySelector('.forgot-link')!.addEventListener('click', () => rememberTypedEmail(email.value.trim()));

  if (params.get('inscrit') === '1') {
    showAlert(alert, 'Ton inscription a bien été prise en compte ✓ Connecte-toi pour commencer à jouer.', 'info');
  }
  if (params.get('nouvelemail') === '1') {
    showAlert(alert, 'Ton adresse email a bien été changée ✓ Connecte-toi avec ta nouvelle adresse.', 'info');
  }
  if (registeredEmail) {
    email.value = registeredEmail;
  }
  registeredEmail = null;

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
      const user = await login(email.value.trim(), password.value);
      addFlash({ message: `Connexion réussie ✓ Bienvenue, ${user.pseudo} !`, kind: 'info' });
      // Partie gagnée juste avant sans être connecté : on enregistre son score maintenant
      const claimed = await claimPendingScore();
      if (claimed) {
        addFlash({ message: claimed.message, kind: claimed.ok ? 'info' : 'error' });
      }
      navigate(safeRedirect(params.get('redirect'), ['/login', '/register']));
    } catch (error) {
      showAlert(alert, loginErrorMessage(error), 'error');
      password.value = '';
      password.focus();
    } finally {
      setLoading(submit, false, 'Se connecter', 'Connexion…');
    }
  });

  // Juste après l'inscription, l'email est déjà rempli : on passe directement au mot de passe
  (email.value ? password : email).focus();
}
