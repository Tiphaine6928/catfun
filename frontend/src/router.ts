/**
 * Routeur minimal basé sur le hash de l'URL (#/login, #/…) :
 * pas besoin de configurer le serveur, les URL fonctionnent même après un rechargement.
 */
export interface Route {
  /** Affiche la page dans le conteneur. Peut renvoyer une fonction de nettoyage. */
  render: (container: HTMLElement, params: URLSearchParams) => void | (() => void) | Promise<void>;
  /** true si la page est réservée aux utilisateurs connectés. */
  requiresAuth?: boolean;
  /** true si la page n'a pas de sens une fois connecté (la connexion). */
  guestOnly?: boolean;
  title: string;
}

export interface RouterOptions {
  routes: Record<string, Route>;
  container: HTMLElement;
  isLoggedIn: () => boolean;
  loginPath: string;
  homePath: string;
}

let options: RouterOptions;
let cleanup: (() => void) | null = null;

export function startRouter(routerOptions: RouterOptions): void {
  options = routerOptions;
  window.addEventListener('hashchange', () => void render());
  void render();
}

/** Va sur une page, par exemple navigate('/login'). */
export function navigate(path: string): void {
  const target = `#${path}`;
  if (window.location.hash === target) {
    void render();
  } else {
    window.location.hash = target;
  }
}

function currentLocation(): { path: string; params: URLSearchParams } {
  const [path, query = ''] = window.location.hash.replace(/^#/, '').split('?');

  return { path: path || options.homePath, params: new URLSearchParams(query) };
}

async function render(): Promise<void> {
  const { path, params } = currentLocation();
  const route = options.routes[path];

  if (!route) {
    navigate(options.homePath);
    return;
  }

  if (route.requiresAuth && !options.isLoggedIn()) {
    // On retient la page demandée pour y revenir après la connexion
    navigate(`${options.loginPath}?redirect=${encodeURIComponent(path)}`);
    return;
  }

  if (route.guestOnly && options.isLoggedIn()) {
    navigate(options.homePath);
    return;
  }

  cleanup?.();
  cleanup = null;
  options.container.replaceChildren();
  document.title = `${route.title} · CatFun`;

  const result = await route.render(options.container, params);
  if (typeof result === 'function') {
    cleanup = result;
  }
}
