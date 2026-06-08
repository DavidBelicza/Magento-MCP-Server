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

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/schema ./schema

EXPOSE 3000

CMD ["npm", "run", "start:backend"]
