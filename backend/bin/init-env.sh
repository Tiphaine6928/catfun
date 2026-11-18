#!/bin/sh
# Prépare l'environnement local :
#  - génère APP_SECRET et JWT_PASSPHRASE dans .env.local s'ils n'y sont pas encore
#  - génère les clés JWT (dev et test) si elles n'existent pas
# Sans danger si on le relance : rien n'est écrasé.
set -e
cd "$(dirname "$0")/.."

random_hex() {
    php -r "echo bin2hex(random_bytes($1));"
}

touch .env.local

if ! grep -q '^APP_SECRET=..*' .env.local; then
    echo "APP_SECRET=$(random_hex 16)" >> .env.local
    echo "APP_SECRET généré dans .env.local"
fi

if ! grep -q '^JWT_PASSPHRASE=..*' .env.local; then
    echo "JWT_PASSPHRASE=$(random_hex 32)" >> .env.local
    # Les clés existantes étaient chiffrées avec l'ancienne passphrase : on les régénère.
    rm -f config/jwt/private.pem config/jwt/public.pem
    echo "JWT_PASSPHRASE généré dans .env.local"
fi

php bin/console lexik:jwt:generate-keypair --skip-if-exists --no-interaction
php bin/console lexik:jwt:generate-keypair --skip-if-exists --no-interaction --env=test
