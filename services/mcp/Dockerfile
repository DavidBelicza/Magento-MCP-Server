FROM node:24-alpine AS deps

WORKDIR /app

COPY packages/mcp/package*.json ./
RUN npm install

FROM deps AS dev

COPY packages/mcp/ ./

EXPOSE 3000

CMD ["npm", "run", "dev"]

FROM deps AS build

COPY packages/mcp/ ./
RUN npm run build
RUN npm prune --omit=dev

FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV MCP_PORT=3000

LABEL org.opencontainers.image.title="Magentic MCP" \
      org.opencontainers.image.description="Model Context Protocol (MCP) endpoint exposing the code graph to AI agents." \
      org.opencontainers.image.authors="David Belicza <david@belicza.com>" \
      org.opencontainers.image.vendor="Magentic" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.url="https://github.com/DavidBelicza/Magento-MCP-Server" \
      org.opencontainers.image.source="https://github.com/DavidBelicza/Magento-MCP-Server" \
      org.opencontainers.image.documentation="https://github.com/DavidBelicza/Magento-MCP-Server#readme"

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/resource ./resource

EXPOSE 3000

CMD ["npm", "run", "start"]
