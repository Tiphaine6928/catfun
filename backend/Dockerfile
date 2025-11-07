# Étape 1 : base PHP avec extensions utiles
FROM php:8.4-fpm

# Installation des dépendances nécessaires
RUN apt-get update && apt-get install -y \
    git unzip libicu-dev libpq-dev libzip-dev zip \
    && docker-php-ext-install intl pdo pdo_mysql zip

# Copie du code Symfony
WORKDIR /var/www/html
COPY . .

# Installation de Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
RUN composer install --no-interaction

# Droits d'accès
RUN chown -R www-data:www-data /var/www/html
