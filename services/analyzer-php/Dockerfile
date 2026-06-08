FROM composer:2 AS composer

FROM php:8.5-cli-alpine

WORKDIR /app

COPY --from=composer /usr/bin/composer /usr/bin/composer
COPY packages/php-analyzer/composer.json packages/php-analyzer/composer.lock ./

RUN composer install --no-interaction --no-progress --prefer-dist --no-dev --optimize-autoloader

COPY packages/php-analyzer/ ./

ENV MAGENTIC_ANALYZED_SOURCE_PATH=/mnt/analyzed-source

CMD ["sh", "-c", "trap 'exit 0' TERM INT; while sleep 3600; do :; done"]
