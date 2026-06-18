FROM node:24-alpine AS deps

WORKDIR /app

COPY packages/site/package*.json ./
RUN npm install

FROM deps AS dev

RUN apk add --no-cache nginx gettext

COPY packages/site/ ./
COPY README.md ./README.md
COPY services/frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY services/frontend/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
CMD ["sh", "-c", "npm run build:watch & nginx -g 'daemon off;'"]

FROM deps AS build

COPY packages/site/ ./
COPY README.md ./README.md
RUN npm run build

FROM node:24-alpine

RUN apk add --no-cache nginx gettext

LABEL org.opencontainers.image.title="Magentic Frontend" \
      org.opencontainers.image.description="Web UI and gateway for Magentic." \
      org.opencontainers.image.authors="David Belicza <david@belicza.com>" \
      org.opencontainers.image.vendor="Magentic" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.url="https://github.com/DavidBelicza/Magento-MCP-Server" \
      org.opencontainers.image.source="https://github.com/DavidBelicza/Magento-MCP-Server" \
      org.opencontainers.image.documentation="https://github.com/DavidBelicza/Magento-MCP-Server#readme"

COPY services/frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY services/frontend/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
COPY --from=build /app/dist /app/dist

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
