# AGENTS.md

## Project Snapshot

Magentic is a Docker-based, self-hosted MCP server for agentic AI workflows. It uses an npm workspace monorepo with two Node.js application packages and one PHP analyzer package:

- `packages/core`: Fastify backend, BullMQ worker, Redis queues, PostgreSQL storage, Neo4j graph writes, startup schema installation.
- `packages/site`: React, Vite, Tailwind frontend with routed views and React Force Graph 2D visualization.
- `packages/php-analyzer`: PHP CLI analyzer package using Symfony Console and `nikic/php-parser`.

The holistic architecture notes are in `docs/architecture_project.md`. Source indexing and graph/world-mapping notes are in `docs/architecture_world_mapping.md`. Runtime sanity checks are in `docs/test_system_sanity.md`.

## Docker Services

The Compose project is named `magentic`. Main services:

- `magentic_frontend`: public entrypoint on `localhost:8080`; Nginx in production, Vite in dev override.
- `magentic_backend`: private Fastify API service; routes live in `packages/core/src/server.ts`.
- `magentic_worker`: private BullMQ worker; entrypoint is `packages/core/src/worker.ts`.
- `magentic_analyzer_php`: private PHP CLI analyzer runtime; command entrypoint is `packages/php-analyzer/bin/php-analyzer`.
- `magentic_redis`: queue backend for BullMQ.
- `magentic_postgres`: persistent application storage and schema history.
- `magentic_graphdb`: Neo4j graph database, exposed for local browser/debug access.

Dev Compose overrides are in `docker-compose.dev.yml`. Backend/worker/site/PHP analyzer source mounts allow most source edits without rebuilding. Rebuild only when package metadata or Dockerfiles change. In dev mode, `magentic_analyzer_php` runs Composer install on startup so `packages/php-analyzer/vendor` is available locally but ignored by Git.

## Common Commands

Root scripts are in `package.json`:

```bash
npm run build
npm run docker:up
npm run docker:dev
npm run docker:dev:build
npm run dev:backend
npm run dev:worker
npm run dev:site
```

Useful checks:

```bash
curl -s http://localhost:8080/api/health
curl -s -X POST http://localhost:8080/api/index/packages
curl -s "http://localhost:8080/api/index/get-status?jobId=<job-id>"
docker compose run --rm --no-deps magentic_analyzer_php php /app/bin/php-analyzer magentic:parse vendor/magento/module-catalog
```

## Core Layout

Important core paths:

- `src/server.ts`: Fastify server and API routes.
- `src/worker.ts`: indexing worker process.
- `src/queue/index-packages.ts`: BullMQ queue contract.
- `src/processing/composer-lock/`: Composer lock parsing and graph record building.
- `src/graph/`: generic graph write helpers.
- `src/schema/install-schemas.ts`: startup schema installer.
- `schema/postgresql/`: PostgreSQL `.sql` schema scripts.
- `schema/neo4j/`: Neo4j `.cypher` schema scripts.

Schema scripts are installed on backend/worker startup, not during Docker build and not from frontend requests. PostgreSQL stores executed schema scripts in `application_schema_history`.

## Frontend Layout

Important site paths:

- `src/app/App.tsx`: app shell, routing, fixed sidebar/top bar layout.
- `src/app/navigation.ts`: navigation IDs and route paths.
- `src/components/`: shared UI components.
- `src/features/graph/`: React Force Graph 2D graph visualization.
- `src/views/`: route views.

The frontend uses same-origin `/api/*` calls. In dev, Vite proxies `/api` to `magentic_backend:3000`.

## PHP Analyzer Layout

Important PHP analyzer paths:

- `packages/php-analyzer/composer.json`: PHP package manifest.
- `packages/php-analyzer/bin/php-analyzer`: Symfony Console entrypoint.
- `packages/php-analyzer/src/Command/Parse.php`: `magentic:parse` command.
- `services/analyzer-php/Dockerfile`: PHP analyzer runtime image.

The analyzer package uses PSR-4 namespace `Magentic\PhpAnalyzer\`. The analyzed source mount is read-only at `/mnt/analyzed-source`; do not confuse it with the analyzer application source in `packages/php-analyzer`.

## Conventions

- Keep source-code comments out unless they are genuinely necessary.
- Prefer dash-case filenames for consistency with the core package.
- Keep Docker service names as `magentic_*`.
- Keep Docker service Dockerfiles under matching `services/<service>/` directories when possible. `services/backend/Dockerfile` intentionally builds the shared backend image used by both `magentic_backend` and `magentic_worker`.
- Do not import from archive/reference folders.
- Do not add test files unless explicitly requested.
- Treat Redis as short-term process state; PostgreSQL is durable application state; Neo4j is graph storage.
