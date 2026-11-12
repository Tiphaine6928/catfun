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
et génère les clés JWT (si elles n'existent pas encore).

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
php bin/console lexik:jwt:generate-keypair --skip-if-exists
php bin/console doctrine:database:create
php bin/console doctrine:migrations:migrate
symfony server:start
```

La base de données se configure dans `backend/.env.local` :
`DATABASE_URL="mysql://admin:root@127.0.0.1:3306/catfun?serverVersion=8.0"`

### Lancer le frontend sans Docker
```bash
cd frontend
npm install
npm start
```

### API d'authentification
- `POST /api/login` avec `{"email": "...", "password": "..."}` → renvoie `{"token": "..."}`
- `GET /api/me` avec l'en-tête `Authorization: Bearer <token>`

Le CORS (nelmio/cors-bundle) autorise par défaut les appels vers `/api/` depuis `localhost`
et `127.0.0.1` sur n'importe quel port. Pour une autre origine, surcharger `CORS_ALLOW_ORIGIN`
dans `backend/.env.local` (expression régulière).

### Etat du projet
Projet en cours de développement <br>
Les fonctionnalités sont implémentés progressivement selon une roadmap

### Auteur
Projet développé par Tiphaine <br>
Etudiante en développement web - Ada Tech School