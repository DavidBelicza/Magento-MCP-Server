FROM composer:2 AS composer

FROM dunglas/frankenphp:php8.4-alpine

WORKDIR /app

LABEL org.opencontainers.image.title="Magentic PHP Analyzer" \
      org.opencontainers.image.description="Parses PHP source into an Abstract Syntax Tree for the code graph." \
      org.opencontainers.image.authors="David Belicza <david@belicza.com>" \
      org.opencontainers.image.vendor="Magentic" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.url="https://github.com/DavidBelicza/Magento-MCP-Server" \
      org.opencontainers.image.source="https://github.com/DavidBelicza/Magento-MCP-Server" \
      org.opencontainers.image.documentation="https://github.com/DavidBelicza/Magento-MCP-Server#readme"

COPY --from=composer /usr/bin/composer /usr/bin/composer
COPY services/analyzer-php/php.ini /usr/local/etc/php/conf.d/magentic-cli.ini
COPY packages/php-analyzer/composer.json packages/php-analyzer/composer.lock ./

RUN composer install --no-interaction --no-progress --prefer-dist --no-dev --optimize-autoloader

COPY packages/php-analyzer/ ./
COPY services/analyzer-php/Caddyfile /etc/caddy/Caddyfile

ENV MAGENTIC_ANALYZED_SOURCE_PATH=/mnt/analyzed-source
ENV SERVER_NAME=":80"

CMD ["frankenphp", "run", "--config", "/etc/caddy/Caddyfile"]
