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
- PHP
- Composer
- MySQL
- Symfony CLI
- Node.js / npm

### Backend
---bash
cd backend
composer install

### Configurer la base de données dans le fichier .env 
DATABASE_URL="mysql://admin:root@127.0.0.1:3306/catfun?serverVersion=8.0"

### Créer la base de données
php bin/console doctrine:database:create
php bin/console doctrine:migration:migrate

### Lancer le serveur
symfony server:start

### Lancer le frontend
cd frontend
npm install
npm run dev

### Etat du projet
Projet en cours de développement
Les fonctionnalités sont implémentés progressivement selon une roadmap

### Auteur
Projet développé par Tiphaine
Etudiante en développement web - Ada Tech School