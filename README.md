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

### Lancer le frontend sans Docker
```bash
cd frontend
npm install
npm run dev
```

Vite démarre un serveur de développement sur http://localhost:5173 avec rechargement automatique.
`npm run build` vérifie les types et génère le site dans `frontend/dist/`.

### API

Les routes marquées 🔒 demandent l'en-tête `Authorization: Bearer <token>`.

**Authentification**
- `POST /api/login` avec `{"email": "...", "password": "..."}` → renvoie `{"token": "..."}`
- 🔒 `GET /api/me` → utilisateur connecté

**Jeux et scores**

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/games` | Liste des jeux (id, nom, description) |
| `GET` | `/api/games/{id}/leaderboard?limit=10` | Classement d'un jeu (`limit` entre 1 et 100) |
| 🔒 `POST` | `/api/scores` | Enregistre un score : `{"gameId": 1, "points": 120}` → 201 |
| 🔒 `GET` | `/api/me/scores?game={id}` | Historique de mes scores (filtre `game` optionnel) |
| 🔒 `GET` | `/api/me/games/{id}/best` | Mon meilleur score sur un jeu (`null` si jamais joué) |

Erreurs renvoyées en JSON : `400` (JSON ou paramètre invalide), `401` (token absent ou invalide),
`404` (jeu inexistant), `422` (données invalides, détail par champ dans `errors`).

Le classement est public : il affiche seulement la partie de l'email avant le `@`.

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