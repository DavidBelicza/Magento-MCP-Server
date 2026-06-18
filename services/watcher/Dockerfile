FROM node:24-alpine AS deps

WORKDIR /app

COPY packages/watcher/package*.json ./
RUN npm install

FROM deps AS dev

COPY packages/watcher/ ./

CMD ["npm", "run", "dev"]

FROM deps AS build

COPY packages/watcher/ ./
RUN npm run build
RUN npm prune --omit=dev

FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production

LABEL org.opencontainers.image.title="Magentic Watcher" \
      org.opencontainers.image.description="Watches source files and triggers indexing." \
      org.opencontainers.image.authors="David Belicza <david@belicza.com>" \
      org.opencontainers.image.vendor="Magentic" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.url="https://github.com/DavidBelicza/Magento-MCP-Server" \
      org.opencontainers.image.source="https://github.com/DavidBelicza/Magento-MCP-Server" \
      org.opencontainers.image.documentation="https://github.com/DavidBelicza/Magento-MCP-Server#readme"

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

CMD ["npm", "run", "start"]
