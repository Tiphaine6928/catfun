FROM php:8.4-fpm

# Installation des dépendances nécessaires
RUN apt-get update && apt-get install -y \
    git unzip libicu-dev libzip-dev zip \
    && docker-php-ext-install intl pdo pdo_mysql zip \
    && rm -rf /var/lib/apt/lists/*

# Installation de Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
# Le build tourne en root : sans cette variable, Composer désactive ses plugins
# (symfony/runtime ne génère alors pas vendor/autoload_runtime.php et l'app ne démarre pas)
ENV COMPOSER_ALLOW_SUPERUSER=1

WORKDIR /var/www/html

# Dépendances d'abord (meilleur cache des couches Docker)
COPY composer.json composer.lock symfony.lock ./
RUN composer install --no-interaction --prefer-dist --no-scripts --no-autoloader

# Copie du code Symfony
COPY . .
RUN composer dump-autoload --optimize \
    && chown -R www-data:www-data /var/www/html

COPY docker/entrypoint.sh /usr/local/bin/catfun-entrypoint
RUN chmod +x /usr/local/bin/catfun-entrypoint

ENTRYPOINT ["catfun-entrypoint"]
CMD ["php-fpm"]
