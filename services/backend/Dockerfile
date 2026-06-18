FROM node:24-alpine AS deps

WORKDIR /app

COPY packages/core/package*.json ./
RUN npm install

FROM deps AS dev

COPY packages/core/ ./

EXPOSE 3000

CMD ["npm", "run", "dev:backend"]

FROM deps AS build

COPY packages/core/ ./
RUN npm run build
RUN npm prune --omit=dev

FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

LABEL org.opencontainers.image.title="Magentic Backend" \
      org.opencontainers.image.description="API and primary business logic for the Magentic MCP server." \
      org.opencontainers.image.authors="David Belicza <david@belicza.com>" \
      org.opencontainers.image.vendor="Magentic" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.url="https://github.com/DavidBelicza/Magento-MCP-Server" \
      org.opencontainers.image.source="https://github.com/DavidBelicza/Magento-MCP-Server" \
      org.opencontainers.image.documentation="https://github.com/DavidBelicza/Magento-MCP-Server#readme"

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/schema ./schema

EXPOSE 3000

CMD ["npm", "run", "start:backend"]
