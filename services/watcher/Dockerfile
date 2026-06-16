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

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

CMD ["npm", "run", "start"]
