import { LEGAL } from '../legal';
import { renderLayout } from '../ui/layout';

/**
 * Page « Confidentialité » : ce que CatFun fait des données personnelles (RGPD).
 * Les informations sur le responsable et le contact viennent de src/legal.ts.
 */

const TODO = '<mark class="todo">à compléter</mark>';

/** Texte d'un réglage, échappé, ou la mention « à compléter ». */
function setting(value: string | null): string {
  if (value === null) {
    return TODO;
  }
  const span = document.createElement('span');
  span.textContent = value;
  return span.innerHTML;
}

function contact(): string {
  if (LEGAL.contactEmail === null) {
    return TODO;
  }
  const link = document.createElement('a');
  link.href = `mailto:${LEGAL.contactEmail}`;
  link.textContent = LEGAL.contactEmail;
  return link.outerHTML;
}

export function renderPrivacy(container: HTMLElement): void {
  const page = renderLayout(container, '/confidentialite');
  const missing = [LEGAL.controller, LEGAL.contactEmail, LEGAL.host, LEGAL.logsRetention].some((value) => value === null);

  page.innerHTML = `
    <article class="legal">
      <h1>Confidentialité</h1>
      <p class="page__intro">Ce que CatFun fait de tes données personnelles, et comment garder la main dessus. Mise à jour le ${setting(LEGAL.updatedOn)}.</p>

      ${missing ? '<p class="alert alert--error">Page à compléter avant la mise en ligne : responsable, contact, hébergeur et durée des journaux (fichier <code>frontend/src/legal.ts</code>).</p>' : ''}

      <h2>En bref</h2>
      <ul>
        <li>Tu peux jouer <strong>sans compte</strong> : on ne te demande rien.</li>
        <li>Avec un compte, on garde seulement ton <strong>email</strong>, ton <strong>pseudo</strong>, ton <strong>mot de passe</strong> (chiffré) et tes <strong>parties</strong>.</li>
        <li>Pas de publicité, pas de revente, pas de cookie, pas de mouchard.</li>
        <li>Tu peux <strong>télécharger</strong> tes données ou <strong>supprimer ton compte</strong> à tout moment, depuis <a href="#/profil">Mon profil</a>.</li>
      </ul>

      <h2>Qui est responsable de tes données ?</h2>
      <p>${setting(LEGAL.controller)}. Pour toute question ou demande sur tes données : ${contact()}.</p>

      <h2>Quelles données, pourquoi, et combien de temps ?</h2>
      <div class="table-scroll">
        <table class="legal__table">
          <thead>
            <tr><th scope="col">Donnée</th><th scope="col">À quoi elle sert</th><th scope="col">Combien de temps</th></tr>
          </thead>
          <tbody>
            <tr><td>Email</td><td>Te connecter, et t'envoyer un lien si tu oublies ton mot de passe. Il n'est jamais affiché aux autres joueurs.</td><td>Tant que ton compte existe</td></tr>
            <tr><td>Pseudo</td><td>T'identifier dans les classements (il est public).</td><td>Tant que ton compte existe</td></tr>
            <tr><td>Mot de passe</td><td>Te connecter. Il est chiffré de façon irréversible : personne ne peut le lire, même pas nous.</td><td>Tant que ton compte existe</td></tr>
            <tr><td>Scores et parties</td><td>Faire fonctionner les jeux, ton profil et les classements (ton pseudo et tes meilleurs scores sont publics).</td><td>Tant que ton compte existe</td></tr>
            <tr><td>Parties jouées sans compte</td><td>Te laisser enregistrer ton score si tu crées un compte juste après.</td><td>1 jour au plus</td></tr>
            <tr><td>Lien « mot de passe oublié »</td><td>Te laisser choisir un nouveau mot de passe.</td><td>1 heure</td></tr>
            <tr><td>Adresse IP</td><td>Bloquer les abus (trop de tentatives de connexion, d'inscription…).</td><td>1 heure au plus pour les compteurs anti-abus</td></tr>
            <tr><td>Journaux du serveur</td><td>Comprendre et corriger les pannes, repérer les attaques (ils contiennent les adresses IP et les pages demandées).</td><td>${setting(LEGAL.logsRetention)}</td></tr>
          </tbody>
        </table>
      </div>
      <p>Base légale : ces données sont nécessaires pour te fournir le service que tu demandes en créant un compte (exécution du contrat). La protection contre les abus repose sur notre intérêt légitime à garder le site sûr.</p>

      <h2>Qui y a accès ?</h2>
      <p>Seulement les personnes qui font fonctionner CatFun, et l'hébergeur du site (${setting(LEGAL.host)}), qui stocke les données pour nous. Les autres joueurs ne voient que ton pseudo et tes scores dans les classements. Tes données ne sont ni vendues, ni utilisées pour de la publicité.</p>

      <h2>Cookies et stockage dans ton navigateur</h2>
      <p>CatFun n'utilise <strong>aucun cookie</strong> et aucun outil de statistiques ou de publicité. La police d'écriture est hébergée sur le site lui-même (aucun appel à Google). Le site garde seulement dans ton navigateur :</p>
      <ul>
        <li>ton jeton de connexion, pour que tu restes connecté (il disparaît quand tu te déconnectes) ;</li>
        <li>le score d'une partie gagnée sans compte, le temps que tu crées un compte (il disparaît à la fermeture de l'onglet).</li>
      </ul>
      <p>Ces éléments sont indispensables au fonctionnement du site : ils ne demandent donc pas ton accord.</p>

      <h2>Tes droits</h2>
      <ul>
        <li><strong>Voir et récupérer tes données</strong> : bouton « Télécharger mes données » dans <a href="#/profil">Mon profil</a> (fichier JSON).</li>
        <li><strong>Les corriger</strong> : ton pseudo se change dans Mon profil ; pour ton email, écris-nous.</li>
        <li><strong>Les effacer</strong> : bouton « Supprimer mon compte » dans Mon profil. Tout est supprimé aussitôt et définitivement.</li>
        <li><strong>T'opposer</strong> à un usage de tes données ou demander qu'il soit limité : écris-nous.</li>
      </ul>
      <p>Pour toute demande, écris à ${contact()}. On te répond dans un délai d'un mois au plus. Si tu n'es pas satisfait de la réponse, tu peux t'adresser à la CNIL : <a href="https://www.cnil.fr/fr/plaintes" rel="noopener" target="_blank">cnil.fr/fr/plaintes</a>.</p>

      <h2>Sécurité</h2>
      <p>Les mots de passe sont chiffrés, les tentatives répétées sont bloquées, et les parties sont calculées par le serveur. Si tu as moins de 15 ans, parles-en à un adulte avant de créer un compte.</p>
    </article>
  `;
}
