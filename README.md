# Catfun

[![CI](https://github.com/Tiphaine6928/catfun/actions/workflows/ci.yml/badge.svg)](https://github.com/Tiphaine6928/catfun/actions/workflows/ci.yml)

Catfun est une plateforme de mini-jeux fun et accessible, développée autour du thème des chats.
Le projet propose des jeux simples et rapides, permettant aux utilisateurs de s'amuser, de suivre 
leurs scores et de comparer leurs performances.

---

## Objectifs du projet

- Développer une plateforme web complète (front + back)
- Approfondir mes compétences en Symfony et TypeScript
- Mettre en place une architecture propre et évolutive
- Travailler sur un projet personnel en autonomie

---

## Fonctionnalités principales

- Mini-jeux sur le thème des chats :
    - Jeu du Pendu
    - Jeu de Mémoire
- Création de compte et authentification
- Enregistrement des scores
- Classement des joueurs (leaderboard)
- Statistiques de progression

---

## Stack technique

### Backend
- Symfony
- PHP
- MySQL
- Doctrine ORM

### Frontend
- TypeScript
- HTML/CSS
- Vite

### Outils
- Git / GitHub
- Docker
- Symfony CLI

## Installation

### Prérequis
- Docker et Docker Compose

### Lancer le projet avec Docker
```bash
docker compose up --build
```

Au démarrage, le conteneur backend installe les dépendances PHP (si `vendor/` est absent)
et lance `bin/init-env.sh`, qui génère les secrets dans `backend/.env.local` et les clés JWT
s'ils n'existent pas encore.

Créer ensuite les tables :
```bash
docker compose exec backend php bin/console doctrine:migrations:migrate
```

- API (Symfony via nginx) : http://localhost:8082/api/… (ouvrir http://localhost:8082 renvoie vers le site)
- Frontend : http://localhost:8081
- Base MySQL (pour un outil comme DBeaver ou MySQL Workbench) : `127.0.0.1`, port **3307**,
  utilisateur `admin`, mot de passe `root`. Le port 3307 évite le conflit avec un MySQL déjà
  installé sur ta machine (qui utilise 3306).

Au premier démarrage, MySQL met jusqu'à une minute à s'initialiser : le backend attend qu'il soit prêt.
Si un conteneur reste à l'état `Created` (`docker compose ps -a`), un port est sans doute déjà utilisé
sur ta machine : le message d'erreur s'affiche dans la sortie de `docker compose up`.

### Lancer le backend sans Docker
```bash
cd backend
composer install
sh bin/init-env.sh
php bin/console doctrine:database:create
php bin/console doctrine:migrations:migrate
symfony server:start
```

Les secrets (`APP_SECRET`, `JWT_PASSPHRASE`) sont générés par `bin/init-env.sh` dans
`backend/.env.local`, qui n'est pas versionné. Ne mets jamais de vrai secret dans `.env`.

La base de données se configure aussi dans `backend/.env.local` :
`DATABASE_URL="mysql://admin:root@127.0.0.1:3306/catfun?serverVersion=8.0"`

Si le frontend tourne avec Vite (port 5173) plutôt qu'avec Docker, indique aussi son adresse
dans `backend/.env.local`, pour que l'adresse du backend redirige vers le bon site :
`FRONTEND_URL=http://localhost:5173`

### Lancer le frontend sans Docker
```bash
cd frontend
npm install
npm run dev
```

Vite démarre un serveur de développement sur http://localhost:5173 avec rechargement automatique.
`npm run build` vérifie les types et génère le site dans `frontend/dist/`.

Le frontend appelle l'API sur http://localhost:8082 (nginx du docker-compose).
Pour un backend ailleurs (par exemple `symfony server:start` sur le port 8000),
crée `frontend/.env.local` :
```
VITE_API_URL=http://localhost:8000
```

Pages disponibles :
- `#/login` : connexion (le token JWT est gardé dans le navigateur)
- `#/register` : création de compte (connecte directement après l'inscription)
- `#/` : accueil avec la liste des jeux (public : c'est la première page du site)
- `#/pendu` : jeu du Pendu
- `#/memoire?niveau=facile|normal|difficile` : jeu de Mémoire
- `#/classement` : classement par jeu (public, accessible sans compte)
- `#/profil` : mon profil (changer de pseudo, records et parties jouées par jeu, dernières parties gagnées) ; on y accède en cliquant sur son pseudo

### Charte graphique

| Élément | Valeur |
|---|---|
| Fond | Violet clair `#EDE7F6` |
| Texte, boutons et liens | Violet foncé `#5E35B1` |
| Police | Baloo 2 (arrondie, ludique), intégrée au site via `@fontsource/baloo-2` |

Toutes les couleurs sont des variables CSS au début de `frontend/src/styles.css` (`--color-…`).
Les nuances secondaires (titres, textes discrets, bordures, survol) sont dérivées de la palette, et chaque
couleur de texte respecte un contraste d'au moins 4,5:1 (norme WCAG AA). Un thème sombre dans les mêmes
violets s'applique quand l'appareil est réglé en mode sombre.

### Jeu du Pendu
- Le chat a **neuf vies** : 9 erreurs autorisées.
- Mots sur le thème des chats (`frontend/src/games/pendu/words.ts`). Les accents sont gérés :
  la lettre E révèle aussi É, È, Ê.
- On joue à la souris, au doigt ou avec le clavier de l'ordinateur.
- Score d'une victoire : **100 + 20 par vie restante + 5 par lettre différente du mot**,
  calculé et enregistré par le serveur. Une défaite ne rapporte pas de points.

### Jeu de Mémoire
- Retrouver toutes les paires de cartes (chats, pelote de laine, souris…).
- Trois niveaux : **Facile** (6 paires), **Normal** (8 paires), **Difficile** (12 paires).
- Deux cartes différentes se recachent après une seconde, ou dès qu'on retourne une 3e carte.
- Jouable à la souris, au doigt ou au clavier (flèches, Entrée / Espace).
- Score : **50 par paire + bonus de précision de 50 par paire, moins 10 par erreur**
  (le bonus ne descend jamais sous 0). Maximum : 600 en Facile, 800 en Normal, 1200 en Difficile.
  Pas de chronomètre : seul le nombre de coups compte.
- Un classement par niveau (Facile, Normal, Difficile), plus un classement « Tous niveaux ».
  Les parties jouées avant l'ajout des niveaux n'apparaissent que dans « Tous niveaux ».

### Anti-triche

Les parties sont jouées **par le serveur**, jamais par le navigateur :

- le serveur choisit le mot du Pendu et mélange les cartes du Mémoire, avec un hasard imprévisible
  (`random_int`) ; la liste de mots et les symboles ne sont pas envoyés au navigateur ;
- le navigateur envoie seulement les coups (une lettre, une carte) et ne reçoit que ce qu'il a le droit
  de voir : le mot n'est révélé qu'à la fin, une carte seulement quand on la retourne ;
- le score est calculé et enregistré par le serveur à la victoire. Il n'existe plus de route pour envoyer
  un score : `POST /api/scores` a été supprimée ;
- chaque coup est joué dans une transaction, partie verrouillée : deux coups simultanés sont appliqués
  l'un après l'autre et un score n'est enregistré qu'une fois.

Les règles sont dans `backend/src/Game/` (`PenduEngine`, `MemoireEngine`). En test, le hasard est
prévisible (`PredictableRandomizer`) pour que les parties soient reproductibles.

### Limites de tentatives

Pour freiner les robots (mots de passe essayés en masse, comptes créés à la chaîne) :

| Action | Limite par défaut | Variable (`backend/.env.local`) |
|---|---|---|
| Connexion ratée, même email et même adresse IP | 5 par quart d'heure | `LOGIN_MAX_ATTEMPTS_PER_ACCOUNT` |
| Connexion ratée, même adresse IP (tous emails) | 25 par quart d'heure | `LOGIN_MAX_ATTEMPTS_PER_IP` |
| Inscription (même refusée), même adresse IP | 10 par heure | `REGISTRATION_MAX_ATTEMPTS` |

Au-delà, l'API répond `429 Too Many Requests` avec un message en français (« Réessaie dans 15 minutes. »)
et l'en-tête `Retry-After`. Seules les connexions ratées comptent ; elles expirent au bout du quart d'heure.

Si le site est un jour placé derrière un autre proxy (hébergeur, CDN), il faudra déclarer ce proxy
(`framework.trusted_proxies`) : sinon toutes les requêtes sembleraient venir de la même adresse IP.

### Intégration continue (GitHub Actions)

À chaque push et à chaque pull request, GitHub lance automatiquement trois tâches
(fichier `.github/workflows/ci.yml`) :

| Tâche | Ce qu'elle vérifie |
|---|---|
| Backend | `composer.json`, schéma de la base, configuration, tests PHPUnit (PHP 8.4, MySQL 8.0) |
| Frontend | types TypeScript, build Vite, tests Vitest (Node 22) |
| Bout en bout | tests Playwright dans Chromium, contre le vrai backend et MySQL |

Les résultats sont visibles dans l'onglet **Actions** du dépôt GitHub, et à côté de chaque commit
(✓ vert ou ✗ rouge). En cas d'échec des tests de bout en bout, le rapport Playwright et les captures
d'écran sont téléchargeables en bas de la page de l'exécution (« Artifacts »).

### Tests du frontend

**Tests unitaires** (règles des jeux, avec Vitest) :
```bash
cd frontend
npm test
```

**Tests de bout en bout** (Playwright : le vrai site dans un vrai navigateur, contre le vrai backend) :
```bash
cd frontend
npx playwright install chromium   # une seule fois
npm run test:e2e
```

Playwright démarre lui-même le backend (serveur PHP intégré, environnement `test`) et le frontend (Vite).
Il faut donc PHP, les dépendances du backend (`composer install`) et MySQL accessibles sur ta machine.
Avant les tests, la **base de test** `catfun_test` est recréée par les migrations ;
la base de développement n'est jamais touchée. Chaque test crée ses propres comptes.

- `npm run test:e2e:ui` ouvre l'interface de Playwright pour suivre les tests pas à pas.
- En cas d'échec, une capture d'écran est enregistrée dans `frontend/test-results/`.

### API

Les routes marquées 🔒 demandent l'en-tête `Authorization: Bearer <token>`.

**Authentification**
- `POST /api/register` avec `{"email": "...", "pseudo": "...", "password": "..."}` → crée le compte et renvoie directement un token (201)
- `POST /api/login` avec `{"email": "...", "password": "..."}` → renvoie `{"token": "..."}`
- 🔒 `GET /api/me` → utilisateur connecté (email et pseudo)
- 🔒 `PATCH /api/me` avec `{"pseudo": "NouveauPseudo"}` → change le pseudo (seul champ modifiable)

**Parties (jouées par le serveur)**

| Méthode | Route | Description |
|---|---|---|
| 🔒 `POST` | `/api/games/{id}/sessions` | Commence une partie → 201. Pour le Mémoire : `{"level": "facile"}` (`normal`, `difficile`) |
| 🔒 `GET` | `/api/sessions/{id}` | État visible d'une partie (pour la reprendre) |
| 🔒 `POST` | `/api/sessions/{id}/guess` | Pendu : propose une lettre, `{"letter": "e"}` |
| 🔒 `POST` | `/api/sessions/{id}/flip` | Mémoire : retourne une carte, `{"index": 3}` |

Chaque réponse contient l'état visible de la partie (`state`), le résultat du coup (`result`) et,
à la victoire, le score enregistré (`score` : points, meilleur score, nouveau record ou non).
Une partie terminée n'accepte plus de coup (`409`), et seul son joueur peut la voir ou la jouer.

**Jeux et scores**

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/games` | Liste des jeux (id, nom, description, niveaux) |
| `GET` | `/api/games/{id}/leaderboard?limit=10&level=facile` | Classement d'un jeu : meilleur score de chaque joueur, rang partagé en cas d'égalité, nombre total de joueurs (`limit` entre 1 et 100 ; `level` facultatif, pour un jeu à niveaux) |
| 🔒 `GET` | `/api/me/scores?game={id}&limit=10` | Historique de mes scores, du plus récent au plus ancien (`game` et `limit` facultatifs) |
| 🔒 `GET` | `/api/me/stats` | Pour chaque jeu : mon record (par niveau pour le Mémoire), mes parties terminées et gagnées |
| 🔒 `GET` | `/api/me/games/{id}/best?level=facile` | Mon meilleur score sur un jeu (`null` si jamais joué ; `level` facultatif) |

Erreurs renvoyées en JSON : `400` (JSON ou paramètre invalide), `401` (token absent ou invalide),
`404` (jeu inexistant), `422` (données invalides, détail par champ dans `errors`).

Le classement est public : il affiche le pseudo des joueurs, jamais leur email.
Le pseudo est choisi à l'inscription (3 à 30 caractères : lettres, chiffres, `_` et `-`)
et il est unique, sans tenir compte des majuscules.

### Tests
```bash
cd backend
sh bin/init-env.sh
php bin/console doctrine:database:create --env=test
php bin/console doctrine:migrations:migrate --env=test
php bin/phpunit
```

Le CORS (nelmio/cors-bundle) autorise par défaut les appels vers `/api/` depuis `localhost`
et `127.0.0.1` sur n'importe quel port. Pour une autre origine, surcharger `CORS_ALLOW_ORIGIN`
dans `backend/.env.local` (expression régulière).

### Etat du projet
Projet en cours de développement <br>
Les fonctionnalités sont implémentés progressivement selon une roadmap

### Auteur
Projet développé par Tiphaine <br>
Etudiante en développement web - Ada Tech School