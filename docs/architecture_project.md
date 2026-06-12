# Project Architecture

## Goal

Magentic is a Docker-based, self-hosted MCP server for agentic AI workflows. It exposes one public HTTP entrypoint through `magentic_frontend` while keeping the backend, worker, PHP analyzer, Redis, PostgreSQL, and Neo4j services private except for explicit Neo4j browser/debug ports.

The first version uses plain HTTP on localhost. HTTPS, local domains, and a shared reverse proxy can be added later.

The project has two architecture documents:

- `docs/architecture_project.md`: holistic project, service, package, and runtime architecture.
- `docs/architecture_world_mapping.md`: source-code indexing and graph/world-mapping architecture.

## Repository Layout

```text
.
├── docker-compose.yml
├── docs/
│   ├── architecture_project.md
│   ├── architecture_world_mapping.md
│   └── test_system_sanity.md
├── services/
│   ├── analyzer-php/
│   ├── backend/
│   ├── frontend/
│   ├── graphdb/
│   ├── postgres/
│   ├── redis/
│   └── worker/
└── packages/
    ├── core/
    ├── php-analyzer/
    └── site/
```

`docs/` contains architecture and sanity-check documentation.

`services/` contains Docker service definitions, runtime configuration, Dockerfiles, entrypoint scripts, and service-specific infrastructure files.

`packages/` contains application source packages. `packages/core` and `packages/site` are Node.js projects. `packages/php-analyzer` is a Composer-based PHP project.

The root directory contains the primary `docker-compose.yml`, root `package.json`, and root `package-lock.json`. The root Node files are intentional because the project uses npm workspaces. They allow root-level commands such as `npm run build --workspaces` while keeping `packages/core` and `packages/site` as separate packages.

## Runtime Versions

Containers that build or run code from `packages/core` or `packages/site` should use Node.js 24 LTS.

As of June 5, 2026, the official Node.js download page lists Node.js `v24.16.0` as the latest LTS release. Dockerfiles should use the official Node.js 24 image line, such as:

```text
node:24-alpine
```

This requirement is for Node.js 24 LTS. npm is bundled with the official Node image. The `magentic_backend` image and `magentic_frontend` runtime image are both based on `node:24-alpine`, so npm commands can be run inside those containers through Docker Compose.

The PHP analyzer runtime uses FrankenPHP for a high performance HTTP server:

```text
dunglas/frankenphp:php8.4-alpine
```

Composer is copied into the analyzer image from the official Composer image. Production image builds run `composer install` from `packages/php-analyzer/composer.lock`. In development mode, the analyzer package is bind-mounted into `/app`, and Composer install runs on container startup so local `packages/php-analyzer/vendor` is available for editor support while remaining ignored by Git.

## Application Packages

### `packages/core`

Node.js TypeScript package used by:

- `magentic_backend`
- `magentic_worker`

Responsibilities:

- Fastify HTTP server
- API route handlers under `/api/*`
- shared domain logic
- Redis integration
- PostgreSQL access
- BullMQ queues and jobs
- Neo4j access
- worker process entrypoints

### `packages/site`

React, Vite, Tailwind CSS, and TypeScript package used by:

- `magentic_frontend`

Responsibilities:

- browser application
- client-side routing
- static production build output
- API calls using same-origin `/api/*` URLs

The browser application should never call the backend container directly. It should call relative URLs such as `/api/health`, and Nginx should proxy those requests to the backend service.

### `packages/php-analyzer`

PHP Composer package used by:

- `magentic_analyzer_php`

Responsibilities:

- provide an HTTP endpoint to analyze PHP code
- parse PHP source code with `nikic/php-parser`
- expose the `/analyze` endpoint
- emit newline-delimited JSON facts for source symbols and references
- read the analyzed source at `/mnt/analyzed-source`

The package name is `magentic/php-analyzer`. PHP source uses the PSR-4 namespace `Magentic\PhpAnalyzer\`.

The PHP analyzer does not write directly to PostgreSQL or Neo4j. It is an extraction microservice used by the Node.js worker. See `docs/architecture_world_mapping.md` for the indexing flow.

## Docker Compose Services

The Compose project name is explicitly set to `magentic`.

Services use the `magentic_` prefix:

- `magentic_frontend`
- `magentic_backend`
- `magentic_worker`
- `magentic_analyzer_php`
- `magentic_redis`
- `magentic_postgres`
- `magentic_graphdb`
- `magentic_loki` (optional, via telemetry profile)
- `magentic_promtail` (optional, via telemetry profile)
- `magentic_grafana` (optional, via telemetry profile)

Custom images also use the `magentic_` prefix:

- `magentic_frontend:latest`
- `magentic_backend:latest`
- `magentic_analyzer_php:latest`

### `magentic_frontend`

Public HTTP entrypoint for the local system.

Technology:

- Node.js 24 LTS runtime image
- Nginx installed during image build
- built static assets from `packages/site`

Responsibilities:

- expose the app on localhost, for example `http://localhost:8080`
- serve the React/Vite static site
- support frontend deep links and refreshes by falling back to `index.html`
- proxy `/api/*` requests to `magentic_backend`
- allow npm commands inside the container when needed

Expected routing:

```text
Browser -> http://localhost:8080/
Nginx   -> serves packages/site build output
```

```text
Browser -> http://localhost:8080/api/health
Nginx   -> http://magentic_backend:3000/api/health
Fastify -> receives /api/health
```

The `/api` prefix is preserved when proxying to Fastify.

### `magentic_backend`

Private HTTP API service.

Technology:

- `magentic_backend:latest`
- Node.js 24 LTS
- TypeScript
- Fastify
- BullMQ client/producer

Responsibilities:

- listen on port `3000` inside Docker
- expose Fastify API routes under `/api/*`
- communicate with `magentic_redis`
- communicate with `magentic_postgres`
- communicate with `magentic_graphdb`
- execute read-only graph search requests through `/api/graph/search`
- store graph search descriptions, generated Cypher queries, and raw normalized results in PostgreSQL `query_history`
- optionally enqueue jobs or coordinate with `magentic_worker` before responding

The backend service does not publish a host port. It is reachable only inside the Docker Compose network.

### `magentic_worker`

Private background worker service.

Technology:

- `magentic_backend:latest`
- Node.js 24 LTS
- TypeScript
- BullMQ worker

Responsibilities:

- consume indexing jobs from Redis/BullMQ
- read and write indexing-related data
- communicate with PostgreSQL
- communicate with Neo4j
- call analyzer HTTP endpoints and consume their JSONL output
- share code from `packages/core`
- read the analyzed Magento source at `/mnt/analyzed-source`

Initial host mount:

```text
./www/path/to/magento/source-code -> /mnt/analyzed-source
```

The mount is read-only inside the container. Host-side file changes are visible through the bind mount.

This service does not publish any host port.

### `magentic_analyzer_php`

Private PHP analyzer service.

Technology:

- `magentic_analyzer_php:latest`
- FrankenPHP 8.4
- Composer
- `nikic/php-parser`

Responsibilities:

- provide PHP analysis tooling via an HTTP API
- expose `/analyze` as a JSONL-producing analyzer endpoint
- read the analyzed source at `/mnt/analyzed-source`
- use larger PHP runtime limits through `services/analyzer-php/php.ini`

The analyzed source mount is read-only inside the container. The analyzer application source itself lives in `packages/php-analyzer`, not in the analyzed source mount.

This service does not publish any host port.

### `magentic_redis`

Private Redis service.

Responsibilities:

- BullMQ queue backend
- short-lived coordination/cache data if needed

Uses the official Redis image directly.

### `magentic_postgres`

Private PostgreSQL service.

Responsibilities:

- ordinary application storage
- graph search query history records
- future persisted metadata that does not belong in Redis or Neo4j

Uses the official PostgreSQL image directly.

### `magentic_graphdb`

Neo4j graph database service.

Responsibilities:

- graph database storage
- graph queries used by backend and worker services
- local Neo4j browser access during development

The service directory is named `graphdb`, while the implementation uses Neo4j.

Neo4j ports exposed to the host for now:

- `7474` for Neo4j Browser and HTTP
- `7687` for Bolt

Default local URLs:

```text
http://localhost:7474
bolt://localhost:7687
```

### Telemetry Services (`magentic_loki`, `magentic_promtail`, `magentic_grafana`)

The PLG stack provides centralized, zero-overhead logging.

Responsibilities:
- **Loki**: Stores structured JSON logs received from Promtail. Available on port `3100`.
- **Promtail**: Binds to the Docker Daemon to securely read container `stdout`/`stderr` logs without application coupling, and pushes them to Loki.
- **Grafana**: A UI for querying Loki using LogQL. Exposed on port `3001`.

The telemetry services are placed under the `telemetry` Compose profile and will only boot if explicitly requested (e.g., `docker compose --profile telemetry up -d`).

Logging behavior in the application code can be completely muted by setting `ENABLE_TELEMETRY=false` in the `.env` file, bypassing all JSON string formatting.

## Networking Model

The browser should communicate with `magentic_frontend`.

```text
Browser
  |
  | HTTP localhost
  v
magentic_frontend / Nginx
  |
  | /api/* proxy over Docker network
  v
magentic_backend / Fastify
  |
  | Redis + PostgreSQL + Neo4j clients
  v
magentic_redis, magentic_postgres, magentic_graphdb
```

The worker is private:

```text
magentic_worker
  |
  | BullMQ
  v
magentic_redis

magentic_worker
  |
  | PostgreSQL
  v
magentic_postgres

magentic_worker
  |
  | Bolt
  v
magentic_graphdb
```

## Local HTTP Strategy

The first version uses HTTP only:

```text
http://localhost:8080
```

The frontend host port is configurable:

```env
FRONTEND_HTTP_PORT=8080
```

Recommended Compose mapping:

```yaml
ports:
  - "${FRONTEND_HTTP_PORT:-8080}:80"
```

The backend listens on port `3000` inside Docker. This internal port remains fixed because Nginx proxies to `http://magentic_backend:3000`.

## Nginx Routing Rules

The `magentic_frontend` service uses Nginx with three important behaviors:

1. Proxy `/api/*` to `http://magentic_backend:3000`.
2. Preserve the `/api` prefix.
3. Fall back non-API paths to `index.html` for React Router or equivalent client-side routing.

Expected Nginx behavior:

```nginx
location /api/ {
    proxy_pass http://magentic_backend:3000;
}

location / {
    try_files $uri $uri/ /index.html;
}
```

## Dockerfile Requirements

### Services that need Dockerfiles

`magentic_frontend` needs a Dockerfile because it must build `packages/site` with Node.js 24 LTS, install Nginx, and serve the generated static files.

`magentic_backend` and `magentic_worker` use the same Docker image:

```text
magentic_backend:latest
```

That image is built from:

```text
services/backend/Dockerfile
```

The backend and worker differ only by Compose command:

```text
npm run start:backend
npm run start:worker
```

`magentic_analyzer_php` needs a Dockerfile because it must provide PHP 8.4, Composer, and the PHP analyzer dependencies from `packages/php-analyzer`.

### Services that do not need Dockerfiles initially

`magentic_redis` uses the official Redis image directly from Compose.

`magentic_postgres` uses the official PostgreSQL image directly from Compose.

`magentic_graphdb` uses the official Neo4j image directly from Compose.

## Implemented Infrastructure Files

Important infrastructure files:

```text
docker-compose.yml
services/backend/Dockerfile
services/analyzer-php/Dockerfile
services/analyzer-php/php.ini
services/frontend/Dockerfile
services/frontend/nginx.conf
services/redis/
services/postgres/
services/graphdb/
www/path/to/magento/source-code/
packages/core/package.json
packages/php-analyzer/composer.json
packages/site/package.json
```

## Supporting Architecture Items

The runtime includes:

- `.env.example` with documented local defaults for ports, Redis connection values, PostgreSQL connection values, Neo4j connection values, and Node environment.
- named Docker volumes for Redis, PostgreSQL, and Neo4j.
- health checks for backend, Redis, PostgreSQL, and Neo4j.
- `depends_on` relationships for startup order.
- explicit environment variable names used by backend and worker, such as `REDIS_URL`, `POSTGRES_URL`, `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, and `GRAPH_BATCH_SIZE` (source ingestion batch and transaction size, default 5000).
- npm workspaces at the root for Node package orchestration.
- Composer dependency locking for the PHP analyzer package.

## Runtime Topology

The root `docker-compose.yml` defines seven services:

- `magentic_frontend`
- `magentic_backend`
- `magentic_worker`
- `magentic_analyzer_php`
- `magentic_redis`
- `magentic_postgres`
- `magentic_graphdb`

Expose the frontend to the host:

```text
localhost:${FRONTEND_HTTP_PORT:-8080} -> magentic_frontend:80
```

Expose Neo4j browser/debug access to the host for now:

```text
localhost:${NEO4J_HTTP_PORT:-7474} -> magentic_graphdb:7474
localhost:${NEO4J_BOLT_PORT:-7687} -> magentic_graphdb:7687
```

Keep backend, worker, PHP analyzer, Redis, and PostgreSQL private on the Compose network.

Use same-origin browser API calls:

```text
/api/*
```

Proxy those calls through Nginx:

```text
magentic_frontend -> magentic_backend:3000
```

Use Redis for BullMQ communication between backend and worker, PostgreSQL for ordinary application storage, Neo4j as the graph database used by backend and worker, and the PHP analyzer service for PHP source parsing commands.

## Graph Search API

The backend exposes a general graph search endpoint through the frontend proxy:

```text
POST /api/graph/search
```

Expected request body:

```json
{
  "description": "Count graph nodes by label",
  "cypherQuery": "MATCH (node) RETURN labels(node) AS labels, count(node) AS count ORDER BY count DESC LIMIT 10"
}
```

The `description` is the English user question or goal that led to the generated Cypher query. It is required because graph search history is intended to preserve both the user intent and the generated query.

The endpoint executes read-only Cypher against Neo4j, stores the raw normalized result in PostgreSQL `query_history`, and returns both:

- `result`: raw normalized rows plus extracted graph nodes and relationships.
- `structuredResult`: domain-aware graph entities built from known node labels and relationship types, such as Composer packages, authors, and Composer package relationships.

The raw normalized `result` is the persisted audit/history payload. `structuredResult` is an API convenience layer that can evolve as new graph domains are added.

Recent graph search history can be listed through:

```text
GET /api/graph/get-query-history
```

This endpoint returns the 20 most recent records ordered newest-first. It returns only query-history metadata needed by the frontend Query History tab:

- `id`
- `createdAt`
- `description`
- `nodeCount`
- `relationshipCount`

It does not return generated Cypher or stored graph result JSON.

A single saved graph search can be loaded by ID through:

```text
GET /api/graph/get-query-history/:id
```

This endpoint returns the saved raw normalized `result` and rebuilds `structuredResult` from that stored result. The frontend Graph page uses this endpoint when opened with a query-history ID:

```text
/graph?queryHistoryId=<query-history-id>
```

The Query History tab links each listed history item to that Graph page URL. When `/graph` is opened without a query-history ID, the frontend loads the latest query history item and replaces the URL with `/graph?queryHistoryId=<latest-query-history-id>`. Missing or invalid query-history IDs show an error state with a link back to Query History instead of rendering an empty graph canvas.
