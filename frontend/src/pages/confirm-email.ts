import { ApiError } from '../api';
import { confirmEmailChange, loginErrorMessage } from '../auth';
import { navigate } from '../router';
import { hideAlert, setLoading, showAlert } from '../ui/form';
import { rememberRegisteredEmail } from './login';

const TEMPLATE = `
  <main class="auth-page">
    <section class="card" aria-labelledby="confirm-title">
      <p class="card__logo" aria-hidden="true">📬</p>
      <h1 id="confirm-title">Nouvelle adresse email</h1>
      <p class="card__subtitle">Confirme que c’est bien la nouvelle adresse de ton compte CatFun. Tu devras ensuite te reconnecter avec elle.</p>

      <div class="alert" role="alert" hidden></div>

      <button type="button" class="button button--primary confirm">
        <span class="button__label">Confirmer ma nouvelle adresse</span>
      </button>

      <p class="card__footer"><a href="#/profil">Retour à Mon profil</a></p>
    </section>
  </main>
`;

/**
 * Page ouverte depuis le lien reçu à la nouvelle adresse : #/confirmer-email?token=…
 * Un bouton confirme (rien ne change à la simple ouverture du lien, par exemple par un antivirus).
 */
export function renderConfirmEmail(container: HTMLElement, params: URLSearchParams): void {
  container.innerHTML = TEMPLATE;
  const alert = container.querySelector<HTMLDivElement>('.alert')!;
  const button = container.querySelector<HTMLButtonElement>('.confirm')!;

  const token = params.get('token') ?? '';
  if (!/^[0-9a-f]{64}$/.test(token)) {
    showAlert(alert, 'Ce lien n’est plus valable (il a expiré ou a déjà servi). Refais la demande depuis Mon profil.', 'error');
    button.hidden = true;
    return;
  }

  button.addEventListener('click', async () => {
    hideAlert(alert);
    setLoading(button, true, 'Confirmer ma nouvelle adresse', 'Confirmation…');
    try {
      const email = await confirmEmailChange(token);
      rememberRegisteredEmail(email);
      navigate('/login?nouvelemail=1');
    } catch (error) {
      const expired = error instanceof ApiError && (error.status === 410 || error.status === 409);
      showAlert(alert, expired ? (error as ApiError).message : loginErrorMessage(error), 'error');
      button.hidden = expired;
    } finally {
      setLoading(button, false, 'Confirmer ma nouvelle adresse', 'Confirmation…');
    }
  });

  button.focus();
}
