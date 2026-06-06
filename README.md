# Magentic

## MCP Server for Agentic AI

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

Start the backend and worker in development mode:

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

The mount is read-only inside the containers and host-side file changes are visible inside `magentic_backend` and `magentic_worker`.

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

Stop the Docker environment:

```bash
docker compose down
```
