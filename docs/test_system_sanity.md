# System Sanity Tests

Run these checks after major Docker Compose, Dockerfile, service naming, port, or package-script changes.

## Local Package Checks

Install dependencies:

```bash
npm install
```

Build all npm workspaces:

```bash
npm run build
```

Expected result:

- `@magentic/core` TypeScript build passes.
- `@magentic/site` TypeScript and Vite build passes.

## Docker Compose Config

Validate the Compose file:

```bash
docker compose config
```

Expected result:

- Compose project name is `magentic`.
- Services are named `magentic_frontend`, `magentic_backend`, `magentic_worker`, `magentic_redis`, and `magentic_graphdb`.
- No service is named `core`.
- `magentic_backend` and `magentic_worker` both use `magentic_backend:latest`.
- `magentic_frontend` uses `magentic_frontend:latest`.

## Docker Build

Build images:

```bash
docker compose build
```

Expected result:

- `magentic_backend:latest` builds successfully.
- `magentic_frontend:latest` builds successfully.
- npm install runs during image builds, not manually inside containers.

## Start Services

Start the stack:

```bash
docker compose up -d
```

Check service state:

```bash
docker compose ps
```

Expected result:

- `magentic_backend` is healthy.
- `magentic_redis` is healthy.
- `magentic_graphdb` is healthy.
- `magentic_frontend` publishes `8080->80`.
- `magentic_graphdb` publishes `7474->7474` and `7687->7687`.
- `magentic_backend` does not publish a host port.
- `magentic_worker` does not publish a host port.

## HTTP Checks

Check the frontend API proxy:

```bash
curl -s http://localhost:8080/api/health
```

Expected response:

```json
{"ok":true,"service":"backend","redis":"ok","graphdb":"ok"}
```

Check frontend deep-link fallback:

```bash
curl -I http://localhost:8080/deep/link
```

Expected result:

- HTTP status is `200`.
- Response is served by Nginx.

Check Neo4j Browser exposure:

```bash
curl -I http://localhost:7474
```

Expected result:

- HTTP status is `200`.

## Container npm Checks

Check npm inside the backend container:

```bash
docker compose exec -T magentic_backend npm --version
```

Check npm inside the worker container:

```bash
docker compose exec -T magentic_worker npm --version
```

Check npm inside the frontend container:

```bash
docker compose exec -T magentic_frontend npm --version
```

Expected result:

- Each command prints an npm version.

## Shared Backend Image Check

Confirm backend and worker use the same image ID:

```bash
docker inspect magentic-magentic_backend-1 magentic-magentic_worker-1 --format '{{.Name}} {{.Image}}'
```

Expected result:

- Both containers print the same image hash.

## Worker Mount Check

Check the worker mount:

```bash
docker compose exec -T magentic_worker sh -lc 'test -d /mnt/worker-index/test && echo mounted'
```

Expected result:

```text
mounted
```

## Cleanup

Stop containers without removing volumes:

```bash
docker compose down
```

Stop containers and remove volumes when a clean database/queue state is needed:

```bash
docker compose down -v
```
