# Magentic

## MCP Server for Agentic AI

## Documentation

- `docs/architecture_project.md`: holistic project and service architecture.
- `docs/architecture_world_mapping.md`: source-code indexing and graph/world-mapping architecture.
- `docs/test_system_sanity.md`: runtime and integration sanity checks.

## Installation

### Prerequisites

- Docker environment, such as OrbStack or Docker Desktop
- npm, for local workspace commands outside Docker

### First Start

Install local workspace dependencies:

```bash
npm install
```

Build the local packages:

```bash
npm run build
```

Create the local Magento source-code path that Magentic will analyze:

```bash
mkdir -p ./www/path/to/magento/source-code
```

Build the Docker images:

```bash
docker compose build
```

Start the Docker environment:

```bash
docker compose up -d
```

Start the Docker environment in development mode:

```bash
npm run docker:dev
```

Rebuild before starting development mode:

```bash
npm run docker:dev:build
```

Open the frontend:

```text
http://localhost:8080
```

Open Neo4j Browser:

```text
http://localhost:7474
```

Default Neo4j credentials:

```text
username: neo4j
password: dev-password
```

The default analyzed source mount is:

```text
./www/path/to/magento/source-code -> /mnt/analyzed-source
```

The mount is read-only inside the containers and host-side file changes are visible inside `magentic_backend`, `magentic_worker`, and `magentic_analyzer_php`.

The PHP analyzer application source lives in:

```text
packages/php-analyzer
```

In development mode, Composer dependencies are installed automatically into `packages/php-analyzer/vendor` when `magentic_analyzer_php` starts. The local `vendor` directory is ignored by Git and Docker build context.

### Useful Commands

Check running services:

```bash
docker compose ps
```

Check the backend through the frontend Nginx proxy:

```bash
curl http://localhost:8080/api/health
```

Run npm inside the backend container:

```bash
docker compose exec magentic_backend npm --version
```

Run npm inside the worker container:

```bash
docker compose exec magentic_worker npm --version
```

Run npm inside the frontend container:

```bash
docker compose exec magentic_frontend npm --version
```


To manually test the end-to-end Node indexing API (which enqueues the job for the worker):

```bash
curl -X POST http://localhost:8080/api/index/source \
  -H "Content-Type: application/json" \
  -d '{"directories": ["vendor/magento/module-catalog"]}'
```

To manually test the internal PHP Analyzer HTTP endpoint (`/analyze`) directly via the Docker network:

```bash
docker run --rm --network magentic_default curlimages/curl \
  -X POST http://magentic_analyzer_php/analyze \
  -H "Content-Type: application/json" \
  -d '{"path": "vendor/magento/module-catalog"}'
```

Stop the Docker environment:

```bash
docker compose down
```
