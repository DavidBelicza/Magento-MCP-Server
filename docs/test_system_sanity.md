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
- Services are named `magentic_frontend`, `magentic_backend`, `magentic_worker`, `magentic_redis`, `magentic_postgres`, and `magentic_graphdb`.
- No service is named `core`.
- `magentic_backend` and `magentic_worker` both use `magentic_backend:latest`.
- `magentic_frontend` uses `magentic_frontend:latest`.
- `magentic_backend` and `magentic_worker` both mount `${MAGENTIC_ANALYZED_SOURCE_HOST_PATH}` as read-only.

Validate the development override:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml config
```

Expected result:

- `magentic_backend` runs `npm run dev:backend`.
- `magentic_worker` runs `npm run dev:worker`.
- `magentic_backend` builds the `dev` target from `services/core/Dockerfile`.
- `magentic_backend` and `magentic_worker` use `magentic_backend_dev:latest` in dev mode.
- Both services mount `./packages/core/src:/app/src`.
- Both services keep image-built `node_modules` available inside `/app`.
- Both services keep the analyzed source mount read-only.

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

Create the default analyzed source path:

```bash
mkdir -p ./www/path/to/magento/source-code
```

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
- `magentic_postgres` is healthy.
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
{"ok":true,"service":"backend","redis":"ok","postgres":"ok","graphdb":"ok"}
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

## Analyzed Source Mount Checks

Check the backend mount:

```bash
docker compose exec -T magentic_backend sh -lc 'test -d "$MAGENTIC_ANALYZED_SOURCE_PATH" && echo mounted'
```

Check the worker mount:

```bash
docker compose exec -T magentic_worker sh -lc 'test -d "$MAGENTIC_ANALYZED_SOURCE_PATH" && echo mounted'
```

Expected result:

```text
mounted
```

Check that the mount is read-only inside the backend:

```bash
docker compose exec -T magentic_backend sh -lc 'touch "$MAGENTIC_ANALYZED_SOURCE_PATH/.magentic-write-test"'
```

Expected result:

- The command fails with a read-only file system or permission error.

Check that host-side changes are visible inside the worker:

```bash
touch ./www/path/to/magento/source-code/.magentic-host-sync-test
docker compose exec -T magentic_worker sh -lc 'test -f "$MAGENTIC_ANALYZED_SOURCE_PATH/.magentic-host-sync-test" && echo synced'
```

Expected result:

```text
synced
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
