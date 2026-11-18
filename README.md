# Catfun

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

- Backend (Symfony via nginx) : http://localhost:8082
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
dans `backend/.env.local`, pour les liens « Créer un compte » des pages Symfony :
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

### Jeu du Pendu
- Le chat a **neuf vies** : 9 erreurs autorisées.
- Mots sur le thème des chats (`frontend/src/games/pendu/words.ts`). Les accents sont gérés :
  la lettre E révèle aussi É, È, Ê.
- On joue à la souris, au doigt ou avec le clavier de l'ordinateur.
- Score d'une victoire : **100 + 20 par vie restante + 5 par lettre différente du mot**,
  enregistré automatiquement. Une défaite ne rapporte pas de points.

### Jeu de Mémoire
- Retrouver toutes les paires de cartes (chats, pelote de laine, souris…).
- Trois niveaux : **Facile** (6 paires), **Normal** (8 paires), **Difficile** (12 paires).
- Deux cartes différentes se recachent après une seconde, ou dès qu'on retourne une 3e carte.
- Jouable à la souris, au doigt ou au clavier (flèches, Entrée / Espace).
- Score : **50 par paire + bonus de précision de 50 par paire, moins 10 par erreur**
  (le bonus ne descend jamais sous 0). Maximum : 600 en Facile, 800 en Normal, 1200 en Difficile.
  Pas de chronomètre : seul le nombre de coups compte.

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
- Pour viser un backend déjà lancé (par exemple Docker), sans réinitialiser sa base :
  `E2E_API_URL=http://localhost:8082 npm run test:e2e`
- En cas d'échec, une capture d'écran est enregistrée dans `frontend/test-results/`.

### API

Les routes marquées 🔒 demandent l'en-tête `Authorization: Bearer <token>`.

**Authentification**
- `POST /api/register` avec `{"email": "...", "pseudo": "...", "password": "..."}` → crée le compte et renvoie directement un token (201)
- `POST /api/login` avec `{"email": "...", "password": "..."}` → renvoie `{"token": "..."}`
- 🔒 `GET /api/me` → utilisateur connecté (email et pseudo)
- 🔒 `PATCH /api/me` avec `{"pseudo": "NouveauPseudo"}` → change le pseudo (seul champ modifiable)

**Jeux et scores**

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/games` | Liste des jeux (id, nom, description) |
| `GET` | `/api/games/{id}/leaderboard?limit=10` | Classement d'un jeu : meilleur score de chaque joueur, rang partagé en cas d'égalité, nombre total de joueurs (`limit` entre 1 et 100) |
| 🔒 `POST` | `/api/scores` | Enregistre un score : `{"gameId": 1, "points": 120}` → 201 |
| 🔒 `GET` | `/api/me/scores?game={id}` | Historique de mes scores (filtre `game` optionnel) |
| 🔒 `GET` | `/api/me/games/{id}/best` | Mon meilleur score sur un jeu (`null` si jamais joué) |

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