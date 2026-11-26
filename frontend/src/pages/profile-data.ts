import { ApiError } from '../api';
import { deleteAccount, exportMyData, loginErrorMessage } from '../auth';
import { navigate } from '../router';
import { addFlash } from '../ui/flash';
import { clearErrorOnInput, setFieldError, setLoading, setupPasswordToggle } from '../ui/form';

/**
 * Section « Mes données » du profil : télécharger ses données et supprimer son compte (RGPD).
 */
const TEMPLATE = `
  <h2 id="data-title">Mes données</h2>
  <p>Ce que CatFun garde sur toi est expliqué dans la page <a href="#/confidentialite">Confidentialité</a>.</p>

  <div class="data-export">
    <button type="button" class="button button--ghost export"><span class="button__label">Télécharger mes données</span></button>
    <p class="data-export__status" role="status"></p>
  </div>

  <details class="danger-zone">
    <summary>Supprimer mon compte</summary>
    <p>Ton compte, tes scores et toutes tes parties seront <strong>supprimés définitivement</strong>, et ton pseudo disparaîtra des classements. Impossible de revenir en arrière.</p>
    <form class="form delete-form" novalidate>
      <div class="field">
        <label for="delete-password">Ton mot de passe, pour confirmer</label>
        <div class="password">
          <input id="delete-password" name="password" type="password" autocomplete="current-password" required>
          <button type="button" class="password__toggle" aria-controls="delete-password" aria-pressed="false">Afficher</button>
        </div>
        <p class="field__error" id="delete-password-error" hidden></p>
      </div>
      <button type="submit" class="button button--danger"><span class="button__label">Supprimer définitivement mon compte</span></button>
    </form>
  </details>
`;

export function renderMyDataSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'profile-section';
  section.setAttribute('aria-labelledby', 'data-title');
  section.innerHTML = TEMPLATE;

  const exportButton = section.querySelector<HTMLButtonElement>('.export')!;
  const exportStatus = section.querySelector<HTMLElement>('.data-export__status')!;
  exportButton.addEventListener('click', async () => {
    setLoading(exportButton, true, 'Télécharger mes données', 'Préparation…');
    exportStatus.className = 'data-export__status';
    exportStatus.textContent = '';
    try {
      download('catfun-mes-donnees.json', JSON.stringify(await exportMyData(), null, 2));
      exportStatus.textContent = 'Fichier téléchargé ✓';
    } catch (error) {
      exportStatus.className = 'data-export__status score-save--error';
      exportStatus.textContent = loginErrorMessage(error);
    } finally {
      setLoading(exportButton, false, 'Télécharger mes données', 'Préparation…');
    }
  });

  const form = section.querySelector<HTMLFormElement>('.delete-form')!;
  const password = form.querySelector<HTMLInputElement>('#delete-password')!;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  setupPasswordToggle(password, section.querySelector<HTMLButtonElement>('.password__toggle')!);
  clearErrorOnInput(password);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!password.value) {
      setFieldError(password, 'Merci de saisir ton mot de passe pour confirmer.');
      password.focus();
      return;
    }

    setLoading(submit, true, 'Supprimer définitivement mon compte', 'Suppression…');
    try {
      await deleteAccount(password.value);
      addFlash({ message: 'Ton compte et toutes tes données ont été supprimés. Merci d’avoir joué avec Twixy et Aïna 🐾', kind: 'info' });
      navigate('/');
    } catch (error) {
      const message = error instanceof ApiError && error.fieldErrors.password ? error.fieldErrors.password : loginErrorMessage(error);
      setFieldError(password, message);
      password.focus();
    } finally {
      setLoading(submit, false, 'Supprimer définitivement mon compte', 'Suppression…');
    }
  });

  return section;
}

/** Fait télécharger un texte comme fichier par le navigateur. */
function download(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
