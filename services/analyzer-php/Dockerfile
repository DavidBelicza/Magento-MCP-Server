FROM composer:2 AS composer

FROM dunglas/frankenphp:php8.4-alpine

WORKDIR /app

COPY --from=composer /usr/bin/composer /usr/bin/composer
COPY services/analyzer-php/php.ini /usr/local/etc/php/conf.d/magentic-cli.ini
COPY packages/php-analyzer/composer.json packages/php-analyzer/composer.lock ./

RUN composer install --no-interaction --no-progress --prefer-dist --no-dev --optimize-autoloader

COPY packages/php-analyzer/ ./
COPY services/analyzer-php/Caddyfile /etc/caddy/Caddyfile

ENV MAGENTIC_ANALYZED_SOURCE_PATH=/mnt/analyzed-source
ENV SERVER_NAME=":80"

CMD ["frankenphp", "run", "--config", "/etc/caddy/Caddyfile"]
