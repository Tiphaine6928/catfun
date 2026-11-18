import './styles.css';
import { setUnauthorizedHandler } from './api';
import { isLoggedIn, logout } from './auth';
import { renderHome } from './pages/home';
import { renderLogin } from './pages/login';
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
    '/': { title: 'Accueil', render: renderHome, requiresAuth: true },
    '/login': { title: 'Connexion', render: renderLogin, guestOnly: true },
  },
});
