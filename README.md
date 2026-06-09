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

Run the PHP analyzer command against a path inside the analyzed source mount:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm --no-deps magentic_analyzer_php php /app/bin/php-analyzer magentic:parse vendor/magento/module-catalog
```

The path argument is relative to `MAGENTIC_ANALYZED_SOURCE_PATH`, which defaults to `/mnt/analyzed-source` inside the container. The command writes JSONL facts to stdout.

Stop the Docker environment:

```bash
docker compose down
```
