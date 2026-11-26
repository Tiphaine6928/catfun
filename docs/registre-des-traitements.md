# Registre des activités de traitement — CatFun

Document interne exigé par l'article 30 du RGPD. Il recense ce que CatFun fait des données personnelles, pourquoi,
combien de temps et comment elles sont protégées. Il se présente à la CNIL si elle le demande ; il n'a pas à être publié
(la version destinée aux joueurs est la page « Confidentialité » du site, `#/confidentialite`).

**À tenir à jour** à chaque fonctionnalité qui touche aux données (nouveau champ, nouveau prestataire, nouvelle durée…).
Les éléments marqués **⚠ À compléter** doivent l'être avant la mise en ligne.

| | |
|---|---|
| Créé le | 26 novembre 2026 |
| Dernière mise à jour | 26 novembre 2026 |
| Version du site décrite | branche `main`, commit `aac6f4f` et suivants |

---

## 1. Responsable du traitement

| | |
|---|---|
| Responsable | **⚠ À compléter** (personne, groupe ou école ; le même que dans `frontend/src/legal.ts`) |
| Adresse | **⚠ À compléter** |
| Contact pour les données | **⚠ À compléter** (email ; le même que sur la page Confidentialité) |
| Délégué à la protection des données (DPO) | Aucun : pas obligatoire pour CatFun (pas d'organisme public, pas de suivi à grande échelle, pas de données sensibles) |
| Représentant hors UE | Sans objet |

---

## 2. Vue d'ensemble

| N° | Traitement | Base légale | Personnes | Conservation (résumé) |
|---|---|---|---|---|
| T1 | Comptes joueurs | Contrat | Joueurs inscrits | Tant que le compte existe ; 3 ans sans connexion au plus |
| T2 | Parties, scores et classements | Contrat | Joueurs inscrits | Comme le compte ; parties jamais finies : 30 jours |
| T3 | Parties sans compte | Intérêt légitime | Visiteurs | 1 jour |
| T4 | Mot de passe oublié | Contrat | Joueurs inscrits | 1 heure |
| T5 | Suppression des comptes inactifs | Obligation légale (limitation de la conservation) | Joueurs inscrits | Jusqu'à la suppression du compte |
| T6 | Sécurité et prévention des abus | Intérêt légitime | Visiteurs et joueurs | Compteurs : 1 heure ; journaux : **⚠ À compléter** |
| T7 | Exercice des droits (accès, effacement…) | Obligation légale | Joueurs inscrits | Voir la fiche |

Aucune donnée sensible (santé, opinions, origine…) n'est collectée. Aucune décision automatisée, aucun profilage,
aucune publicité, aucune revente. Aucun cookie ni traceur : rien à faire figurer dans un bandeau cookies.

---

## 3. Fiches des traitements

### T1 — Comptes joueurs

| | |
|---|---|
| Finalités | Créer un compte, se connecter, modifier son pseudo ou son email, se déconnecter |
| Base légale | Exécution du contrat (art. 6.1.b) : le joueur demande un compte pour enregistrer ses scores |
| Personnes concernées | Joueurs qui créent un compte (le site peut être utilisé par des mineurs : textes rédigés simplement) |
| Données | Email, pseudo (public), mot de passe chiffré, rôles techniques, date de dernière connexion, date de l'email d'avertissement d'inactivité ; pendant un changement d'email : la nouvelle adresse et l'empreinte du jeton du lien de confirmation |
| Source | Le joueur (formulaire d'inscription) ; la date de connexion est enregistrée par le serveur |
| Destinataires | Personnes qui administrent CatFun ; hébergeur (sous-traitant, voir § 4). Le pseudo est visible de tous dans les classements ; l'email n'est jamais affiché aux autres |
| Transferts hors UE | Aucun prévu — **⚠ À vérifier** selon l'hébergeur choisi |
| Conservation | Tant que le compte existe. Supprimé à la demande (« Supprimer mon compte ») ou après 3 ans sans connexion (voir T5). Demande de changement d'email : 24 heures (supprimée à la confirmation ou, une fois expirée, par le nettoyage quotidien) |
| Sécurité | Mot de passe chiffré de façon irréversible (algorithme recommandé par Symfony : bcrypt ou Argon2id) ; email et pseudo uniques ; jeton de connexion JWT signé, valable 1 heure, gardé dans le navigateur (localStorage) ; limites de tentatives (voir T6). Changement d'email : mot de passe demandé, nouvelle adresse confirmée par un lien à usage unique (seule l'empreinte SHA-256 du jeton est gardée), ancienne adresse prévenue, reconnexion obligatoire ensuite |
| Dans le code | `backend/src/Entity/User.php`, `RegistrationController`, `UserController`, `EmailChangeController`, `Entity/EmailChangeRequest.php`, `EventListener/RecordLoginListener.php` |

### T2 — Parties, scores et classements

| | |
|---|---|
| Finalités | Faire jouer au Pendu et au Mémoire, calculer et enregistrer les scores, afficher le profil et les classements |
| Base légale | Exécution du contrat (art. 6.1.b) |
| Personnes concernées | Joueurs inscrits |
| Données | Parties (jeu, niveau, état, statut, dates de début et de fin), scores (points, niveau, date) |
| Source | Le serveur, à partir des coups joués |
| Destinataires | Le joueur (profil) ; tout le monde pour les classements (pseudo, meilleur score, date) ; hébergeur |
| Transferts hors UE | Aucun prévu — **⚠ À vérifier** selon l'hébergeur |
| Conservation | Parties terminées et scores : comme le compte. Parties commencées et jamais finies : 30 jours (suppression automatique quotidienne) |
| Sécurité | Parties jouées et scores calculés par le serveur (un joueur ne peut ni envoyer de score ni voir le mot caché) ; une partie n'est accessible qu'à son joueur |
| Dans le code | `Entity/GameSession.php`, `Entity/Score.php`, `GameSessionController`, `ScoreController` |

### T3 — Parties sans compte

| | |
|---|---|
| Finalités | Laisser jouer sans compte ; permettre d'enregistrer le score d'une partie gagnée si le visiteur s'inscrit ou se connecte dans l'heure |
| Base légale | Intérêt légitime (art. 6.1.f) : proposer le jeu sans inscription. Aucune donnée d'identité n'est demandée |
| Personnes concernées | Visiteurs non connectés |
| Données | Partie (jeu, niveau, état, dates) liée à un identifiant aléatoire, sans nom ni email ; dans le navigateur (sessionStorage), le score en attente le temps de la visite. Adresse IP pour la limite de parties (voir T6) |
| Destinataires | Hébergeur |
| Conservation | 1 jour (suppression automatique quotidienne) ; le score en attente disparaît à la fermeture de l'onglet. Si le score est enregistré, la partie rejoint T2 |
| Sécurité | Identifiant de partie aléatoire (128 bits), seul moyen d'y accéder ; 200 parties par heure et par adresse IP au plus |
| Dans le code | `GameSessionController` (`start`, `claim`), `frontend/src/games/pending-score.ts` |

### T4 — Mot de passe oublié

| | |
|---|---|
| Finalités | Envoyer par email un lien pour choisir un nouveau mot de passe |
| Base légale | Exécution du contrat (art. 6.1.b) |
| Personnes concernées | Joueurs inscrits qui le demandent |
| Données | Email, pseudo (dans l'email), empreinte du jeton du lien, dates de création et d'expiration |
| Destinataires | Prestataire d'envoi d'emails (sous-traitant, voir § 4) ; hébergeur |
| Conservation | 1 heure ; un lien expiré ou utilisé est supprimé (suppression automatique quotidienne pour les liens expirés) |
| Sécurité | Seule l'empreinte SHA-256 du jeton est gardée ; lien à usage unique ; une nouvelle demande annule la précédente ; même réponse que le compte existe ou non ; 10 demandes par heure et par IP, 3 emails par heure et par compte |
| Dans le code | `Entity/ResetPasswordRequest.php`, `PasswordResetController` |

### T5 — Suppression des comptes inactifs

| | |
|---|---|
| Finalités | Ne pas garder indéfiniment les comptes abandonnés |
| Base légale | Obligation légale (art. 6.1.c) : principe de limitation de la conservation (art. 5.1.e) |
| Personnes concernées | Joueurs sans connexion depuis 3 ans |
| Données | Email, pseudo, date de dernière connexion, date de l'avertissement |
| Destinataires | Prestataire d'envoi d'emails ; hébergeur |
| Déroulement | Après 3 ans sans connexion : email d'avertissement. 30 jours plus tard, sans nouvelle connexion : suppression du compte, des scores et des parties. Une connexion annule la suppression |
| Conservation | Jusqu'à la suppression du compte |
| Dans le code | `Command/PurgeDataCommand.php` (`app:data:purge`), lancée chaque jour par le service `cron` de `docker-compose.yml` ; durées réglables par `ACCOUNT_INACTIVITY_LIMIT` et `ACCOUNT_DELETION_NOTICE` |

### T6 — Sécurité et prévention des abus

| | |
|---|---|
| Finalités | Bloquer les tentatives répétées (connexion, inscription, mot de passe oublié, suppression de compte, parties sans compte) ; diagnostiquer les pannes et les attaques |
| Base légale | Intérêt légitime (art. 6.1.f) : protéger le site et les comptes |
| Personnes concernées | Toute personne qui utilise le site |
| Données | Adresse IP et compteurs de tentatives (par IP, par compte) ; journaux techniques du serveur (adresse IP, page demandée, date, erreurs) |
| Destinataires | Personnes qui administrent CatFun ; hébergeur |
| Conservation | Compteurs : 1 heure au plus. Journaux du serveur : **⚠ À compléter** (la CNIL recommande de 6 mois à 1 an), à régler chez l'hébergeur |
| Limites en place | Connexion : 5 échecs par quart d'heure pour un compte et une IP, 25 par IP ; inscription : 10 par heure et par IP ; mot de passe oublié : 10 par heure et par IP ; suppression de compte : 5 essais par quart d'heure ; changement d'email : 5 demandes par heure et par compte ; parties sans compte : 200 par heure et par IP |
| Dans le code | `config/packages/rate_limiter.yaml`, `config/packages/security.yaml`, `config/packages/monolog.yaml` |

### T7 — Exercice des droits

| | |
|---|---|
| Finalités | Répondre aux demandes des joueurs sur leurs données |
| Base légale | Obligation légale (art. 6.1.c ; art. 15 à 21) |
| Moyens | Accès et portabilité : « Télécharger mes données » (Mon profil, fichier JSON). Rectification : pseudo et email modifiables dans Mon profil (nouvel email confirmé par lien). Effacement : « Supprimer mon compte » (Mon profil, effet immédiat). Opposition et limitation : demande au contact |
| Délai de réponse | 1 mois au plus (art. 12.3) |
| Conservation | Les demandes reçues par email : le temps de les traiter, puis 1 an pour pouvoir prouver la réponse — **⚠ À confirmer** |
| Dans le code | `MyDataController` (`GET /api/me/export`, `DELETE /api/me`), `EmailChangeController`, `frontend/src/pages/profile-data.ts`, `frontend/src/pages/profile-email.ts`, `frontend/src/pages/privacy.ts` |

---

## 4. Sous-traitants

| Sous-traitant | Rôle | Données concernées | Localisation | Contrat (art. 28) |
|---|---|---|---|---|
| **⚠ À compléter** (hébergeur) | Héberge le site et la base de données | Toutes | **⚠ À compléter** | **⚠ À vérifier** (conditions de l'hébergeur) |
| **⚠ À compléter** (service d'envoi d'emails) | Envoie les emails (mot de passe oublié, changement d'email, avertissement d'inactivité) | Email, pseudo, contenu de l'email | **⚠ À compléter** | **⚠ À vérifier** |

En local, les emails ne partent pas : Mailpit (`http://localhost:8025`) les attrape. La police d'écriture est hébergée
par le site lui-même : aucune donnée n'est envoyée à Google ou à un autre service.

---

## 5. Mesures de sécurité

**En place**

- Mots de passe chiffrés de façon irréversible ; jamais renvoyés par l'API, ni dans l'export des données.
- Jetons de connexion signés (clés privées générées sur le serveur, hors du dépôt Git), valables 1 heure.
- Secrets (`.env.local`, clés JWT) générés au premier démarrage et ignorés par Git.
- Limites de tentatives sur toutes les actions sensibles (voir T6).
- Parties et scores calculés côté serveur ; chaque joueur n'accède qu'à ses propres données.
- Suppression automatique des données arrivées au bout de leur durée de conservation (`app:data:purge`, chaque jour).
- Tests automatiques (PHPUnit, Playwright) sur l'export, la suppression, les durées de conservation et les limites, lancés par la CI à chaque modification.
- Dépendances sans faille connue au 26 novembre 2026 (`composer audit` et `npm audit` : 0 faille). À revérifier régulièrement.

**⚠ À faire avant la mise en ligne**

- HTTPS obligatoire sur le site et l'API.
- Remplacer les mots de passe par défaut de la base de données (`docker-compose.yml` : `admin` / `root`) et ne pas exposer MySQL sur Internet.
- Passer Symfony en `APP_ENV=prod` (pas de messages d'erreur détaillés, journaux réduits).
- Sauvegardes de la base (fréquence, durée de conservation, lieu) : **⚠ À définir**.
- Limiter l'accès au serveur et à la base aux personnes qui en ont besoin.

---

## 6. Analyse d'impact (AIPD)

Non requise : CatFun ne remplit pas les critères qui la rendent obligatoire (pas de données sensibles, pas de
profilage ni de surveillance, pas de traitement à grande échelle, pas de croisement de fichiers). Les joueurs peuvent
être mineurs, mais seules des données peu nombreuses et non sensibles sont collectées. À réexaminer si le site
grandit ou collecte de nouvelles données.

---

## 7. En cas de violation de données

Exemple : fuite de la base, accès d'une personne non autorisée.

1. Contenir l'incident (couper l'accès, changer les mots de passe et les clés JWT).
2. Noter dans ce registre ce qui s'est passé, quand, quelles données et combien de personnes sont touchées.
3. Si un risque existe pour les joueurs : prévenir la CNIL **dans les 72 heures** (notifications.cnil.fr).
4. Si le risque est élevé (par exemple des emails et mots de passe exposés) : prévenir aussi les joueurs concernés.

| Date | Incident | Données et personnes touchées | Mesures prises | Notification CNIL |
|---|---|---|---|---|
| — | Aucun incident à ce jour | — | — | — |

---

## 8. Historique des mises à jour

| Date | Modification |
|---|---|
| 26 novembre 2026 | Création du registre (T1 à T7), à partir de l'état du code : comptes, jeux, parties sans compte, mot de passe oublié, durées de conservation, droits des joueurs |
| 26 novembre 2026 | Changement d'email depuis Mon profil (T1, T6, T7, sous-traitant d'emails) ; l'export des données inclut la date de dernière connexion et un éventuel changement d'email en attente |
| 26 novembre 2026 | Mise à jour des dépendances du backend : 62 failles connues corrigées (Symfony 6.4.51, Twig 3.31, PHPUnit 9.6.39) |
