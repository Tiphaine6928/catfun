#!/bin/sh
set -e

cd /var/www/html

# vendor/ est dans un volume Docker (voir docker-compose.yml) : rempli depuis l'image au
# premier démarrage. On (ré)installe les dépendances s'il manque, ou si composer.lock a changé depuis
# la dernière installation (par exemple après un git pull qui ajoute ou retire un paquet).
if [ ! -f vendor/autoload.php ] || [ composer.lock -nt vendor/composer/installed.json ]; then
    composer install --no-interaction --prefer-dist
    # Date de l'installation, même si rien n'a changé : évite de relancer au prochain démarrage
    touch vendor/composer/installed.json
fi

# Secrets (.env.local) et clés JWT : générés au premier démarrage, jamais écrasés ensuite.
sh bin/init-env.sh

# PHP-FPM tourne en www-data : il doit pouvoir écrire le cache/les logs et lire les clés.
mkdir -p var
chown -R www-data:www-data var config/jwt

exec docker-php-entrypoint "$@"
