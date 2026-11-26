// Police de la charte graphique : Baloo 2, intégrée au site (aucune requête vers Google Fonts)
import '@fontsource/baloo-2/400.css';
import '@fontsource/baloo-2/500.css';
import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/700.css';
import '@fontsource/baloo-2/800.css';
import './styles.css';
import { setUnauthorizedHandler } from './api';
import { isLoggedIn, logout } from './auth';
import { renderHome } from './pages/home';
import { renderLeaderboard } from './pages/leaderboard';
import { renderForgotPassword } from './pages/forgot-password';
import { renderLogin } from './pages/login';
import { renderMemoire } from './pages/memoire';
import { renderPendu } from './pages/pendu';
import { renderPrivacy } from './pages/privacy';
import { renderProfile } from './pages/profile';
import { renderRegister } from './pages/register';
import { renderResetPassword } from './pages/reset-password';
import { navigate, startRouter } from './router';

const app = document.getElementById('app');
if (!app) {
  throw new Error('CatFun : élément #app introuvable dans index.html');
}

// Token refusé par l'API (expiré ou invalide) : retour à la connexion
setUnauthorizedHandler(() => {
  logout();
  navigate('/login?expired=1');
});

startRouter({
  container: app,
  isLoggedIn,
  loginPath: '/login',
  homePath: '/',
  routes: {
    '/': { title: 'Accueil', render: renderHome },
    // Les jeux se jouent aussi sans compte ; il faut un compte pour enregistrer son score
    '/pendu': { title: 'Pendu', render: renderPendu },
    '/memoire': { title: 'Mémoire', render: renderMemoire },
    '/classement': { title: 'Classement', render: renderLeaderboard },
    '/profil': { title: 'Mon profil', render: renderProfile, requiresAuth: true },
    '/confidentialite': { title: 'Confidentialité', render: renderPrivacy },
    '/login': { title: 'Connexion', render: renderLogin, guestOnly: true },
    '/register': { title: 'Créer un compte', render: renderRegister, guestOnly: true },
    '/mot-de-passe-oublie': { title: 'Mot de passe oublié', render: renderForgotPassword, guestOnly: true },
    '/nouveau-mot-de-passe': { title: 'Nouveau mot de passe', render: renderResetPassword, guestOnly: true },
  },
});
