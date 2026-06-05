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

Build the Docker images:

```bash
docker compose build
```

Start the Docker environment:

```bash
docker compose up -d
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
