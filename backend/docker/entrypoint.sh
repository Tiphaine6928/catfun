#!/bin/sh
set -e

cd /var/www/html

# Le code est monté en volume (./backend:/var/www/html) : le vendor/ de l'image est masqué,
# on (ré)installe donc les dépendances si besoin.
if [ ! -f vendor/autoload.php ]; then
    composer install --no-interaction --prefer-dist
fi

# Secrets (.env.local) et clés JWT : générés au premier démarrage, jamais écrasés ensuite.
sh bin/init-env.sh

# PHP-FPM tourne en www-data : il doit pouvoir écrire le cache/les logs et lire les clés.
mkdir -p var
chown -R www-data:www-data var config/jwt

exec docker-php-entrypoint "$@"
