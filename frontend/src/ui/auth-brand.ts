import logoUrl from '../assets/logo-catfun.webp';

/**
 * Logo CatFun au-dessus de la carte des pages sans barre du haut
 * (connexion, inscription, mot de passe, confirmation d'email). Il ramène à l'accueil.
 */
export const AUTH_BRAND = `
  <a class="auth-page__brand" href="#/">
    <img src="${logoUrl}" alt="CatFun, retour à l’accueil" width="720" height="515">
  </a>
`;
