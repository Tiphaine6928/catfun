import './styles.css';
import { setUnauthorizedHandler } from './api';
import { isLoggedIn, logout } from './auth';
import { renderHome } from './pages/home';
import { renderLeaderboard } from './pages/leaderboard';
import { renderLogin } from './pages/login';
import { renderMemoire } from './pages/memoire';
import { renderPendu } from './pages/pendu';
import { renderProfile } from './pages/profile';
import { renderRegister } from './pages/register';
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
    '/pendu': { title: 'Pendu', render: renderPendu, requiresAuth: true },
    '/memoire': { title: 'Mémoire', render: renderMemoire, requiresAuth: true },
    '/classement': { title: 'Classement', render: renderLeaderboard },
    '/profil': { title: 'Mon profil', render: renderProfile, requiresAuth: true },
    '/login': { title: 'Connexion', render: renderLogin, guestOnly: true },
    '/register': { title: 'Créer un compte', render: renderRegister, guestOnly: true },
  },
});
