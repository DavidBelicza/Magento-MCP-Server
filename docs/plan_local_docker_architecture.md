# Local Docker Architecture Plan

## Goal

Create a Docker-based local development architecture for Magentic. The system exposes one public HTTP entrypoint through `magentic_frontend` while keeping the backend, worker, Redis, and Neo4j services private except for explicit Neo4j browser/debug ports.

The first version uses plain HTTP on localhost. HTTPS, local domains, and a shared reverse proxy can be added later.

## Repository Layout

```text
.
├── docker-compose.yml
├── docs/
│   └── plan_local_docker_architecture.md
├── services/
│   ├── core/
│   ├── frontend/
│   ├── graphdb/
│   ├── redis/
│   └── worker/
└── packages/
    ├── core/
    └── site/
```

`docs/` contains Markdown documentation and planning notes.

`services/` contains Docker service definitions, runtime configuration, Dockerfiles, entrypoint scripts, and service-specific infrastructure files.

`packages/` contains application source packages. Each package is a separate Node.js project.

The root directory contains the primary `docker-compose.yml`, root `package.json`, and root `package-lock.json`. The root Node files are intentional because the project uses npm workspaces. They allow root-level commands such as `npm run build --workspaces` while keeping `packages/core` and `packages/site` as separate packages.

## Runtime Versions

Containers that build or run code from `packages/core` or `packages/site` should use Node.js 24 LTS.

As of June 5, 2026, the official Node.js download page lists Node.js `v24.16.0` as the latest LTS release. Dockerfiles should use the official Node.js 24 image line, such as:

```text
node:24-alpine
```

This requirement is for Node.js 24 LTS. npm is bundled with the official Node image. The `magentic_backend` image and `magentic_frontend` runtime image are both based on `node:24-alpine`, so npm commands can be run inside those containers through Docker Compose.

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

## Docker Compose Services

The Compose project name is explicitly set to `magentic`.

Services use the `magentic_` prefix:

- `magentic_frontend`
- `magentic_backend`
- `magentic_worker`
- `magentic_redis`
- `magentic_graphdb`

Custom images also use the `magentic_` prefix:

- `magentic_frontend:latest`
- `magentic_backend:latest`

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
- communicate with `magentic_graphdb`
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
- communicate with Neo4j
- share code from `packages/core`
- read the analyzed Magento source at `/mnt/analyzed-source`

Initial host mount:

```text
./www/path/to/magento/source-code -> /mnt/analyzed-source
```

The mount is read-only inside the container. Host-side file changes are visible through the bind mount.

This service does not publish any host port.

### `magentic_redis`

Private Redis service.

Responsibilities:

- BullMQ queue backend
- short-lived coordination/cache data if needed

Uses the official Redis image directly.

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
  | Redis + Neo4j clients
  v
magentic_redis, magentic_graphdb
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
services/core/Dockerfile
```

The backend and worker differ only by Compose command:

```text
npm run start:backend
npm run start:worker
```

### Services that do not need Dockerfiles initially

`magentic_redis` uses the official Redis image directly from Compose.

`magentic_graphdb` uses the official Neo4j image directly from Compose.

## Planned Files

Implemented infrastructure files:

```text
docker-compose.yml
services/core/Dockerfile
services/frontend/Dockerfile
services/frontend/nginx.conf
services/redis/
services/graphdb/
www/path/to/magento/source-code/
packages/core/package.json
packages/site/package.json
```

## Additional Architecture Items

The first implementation includes:

- `.env.example` with documented local defaults for ports, Redis connection values, Neo4j connection values, and Node environment.
- named Docker volumes for Redis and Neo4j.
- health checks for backend, Redis, and Neo4j.
- `depends_on` relationships for startup order.
- explicit environment variable names used by backend and worker, such as `REDIS_URL`, `NEO4J_URI`, `NEO4J_USERNAME`, and `NEO4J_PASSWORD`.
- npm workspaces at the root for package orchestration.

## Recommended First Implementation

Start with a root `docker-compose.yml` containing five services:

- `magentic_frontend`
- `magentic_backend`
- `magentic_worker`
- `magentic_redis`
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

Keep backend, worker, and Redis private on the Compose network.

Use same-origin browser API calls:

```text
/api/*
```

Proxy those calls through Nginx:

```text
magentic_frontend -> magentic_backend:3000
```

Use Redis for BullMQ communication between backend and worker, and Neo4j as the graph database used by backend and worker.
