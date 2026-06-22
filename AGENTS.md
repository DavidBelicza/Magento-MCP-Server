# AGENTS.md

## Project Snapshot

Magentic is a Docker-based, self-hosted MCP server for agentic AI workflows. It uses an npm workspace monorepo with two Node.js application packages and one PHP analyzer package:

- `packages/core`: Fastify backend, BullMQ worker, Redis queues, PostgreSQL storage, Neo4j graph writes, startup schema installation.
- `packages/site`: React, Vite, Tailwind frontend with routed views and React Force Graph 2D visualization.
- `packages/php-analyzer`: PHP analyzer microservice using `nikic/php-parser`.

## Documentation

`README.md` in the repository root covers setup, running the stack, and operational commands. Architecture and reference notes live in the `docs/` directory:

- `docs/architecture_project.md`: holistic project and service architecture.
- `docs/architecture_world_mapping.md`: source indexing and graph/world-mapping workflow, including the worker ingestion flow.
- `packages/mcp/resource/graph-schema.json`: slim, machine-readable graph schema (node kinds, relationship types, edge properties, type-mapping rules) served to agents by the MCP server's `get_graph_schema` tool. The worked example adjacency graph lives in `docs/architecture_world_mapping.md`.
- `docs/test_system_sanity.md`: runtime and integration sanity checks.
- `docs/README-performance.md`: PHP analyzer file-scanning performance notes.
- `docs/architecture_mcp.md`: the `packages/mcp` service — a thin MCP adapter exposing `get_status`, `graph_search`, and `get_graph_schema` over Streamable HTTP at `/mcp`.
- `docs/architecture_auth.md`: access-control design — a single static token (`MAGENTIC_API_TOKEN`, default `example-token`) checked in nginx (envsubst-rendered `map`) on every `/api` and `/mcp` request.

## Docker Services

The Compose project is named `magentic`. Main services:

- `magentic_frontend`: public entrypoint on `localhost:8080`; Nginx in both production and dev (dev rebuilds the SPA with `vite build --watch` instead of running the Vite dev server, so nginx — and its auth gate — is always in the path).
- `magentic_backend`: private Fastify API service; routes live in `packages/core/src/server.ts`.
- `magentic_worker`: private BullMQ worker; entrypoint is `packages/core/src/worker.ts`.
- `magentic_analyzer_php`: private PHP analyzer runtime.
- `magentic_watcher`: standalone file watcher (`packages/watcher`). Reads `config.json` (read-only `./data` mount) for `watcherEnabled`, `sourceSubpaths` (or whole mount), and `projectRoot`/`composer.lock`, watches `*.php` + the lock with chokidar (native events; `MAGENTIC_WATCH_POLLING=true` forces polling), re-scopes when the config file changes, and POSTs debounced change batches to the backend's `POST /api/graph/index/delta` (upserts vs. deletes split by event type). That route proxies the appropriate indexing requests (`/api/graph/index/source` for PHP, `/api/graph/index/packages` for `composer.lock`, then `/api/graph/index/links`). The watcher pauses while a full reindex holds the lock (handles the `409` and polls `/api/status`).
- `magentic_redis`: queue backend for BullMQ.
- `magentic_postgres`: persistent application storage and schema history.
- `magentic_graphdb`: Neo4j graph database, exposed for local browser/debug access.

Dev Compose overrides are in `docker-compose.dev.yml`. Backend/worker/site/PHP analyzer source mounts allow most source edits without rebuilding the image. The backend/worker run `tsx` watch; the site runs `vite build --watch` and is served by nginx (refresh the browser to pick up a rebuild — no HMR). Rebuild the image only when package metadata or Dockerfiles change. In dev mode, `magentic_analyzer_php` runs Composer install on startup so `packages/php-analyzer/vendor` is available locally but ignored by Git.

## Common Commands

Root scripts are in `package.json`:

```bash
npm run build
npm run lint
npm run typecheck
npm test
npm run docker:up
npm run docker:dev
npm run docker:dev:build
npm run dev:backend
npm run dev:worker
npm run dev:site
```

ESLint (`eslint.config.mjs`, flat config) covers the TypeScript packages and `e2e/`; `npm run typecheck` runs `tsc --noEmit` per workspace. Run both before committing.

Useful checks:

```bash
curl -s http://localhost:8080/api/health
curl -s -X POST http://localhost:8080/api/graph/index/packages
curl -s -X POST http://localhost:8080/api/graph/index/links
curl -s "http://localhost:8080/api/graph/index/status"
curl -s "http://localhost:8080/api/graph/index/status/<job-id>"
docker run --rm --network magentic_default curlimages/curl -X POST http://magentic_analyzer_php/analyze -H "Content-Type: application/json" -d '{"path": "vendor/magento/module-catalog"}'
```

## Core Layout

Important core paths:

- `src/server.ts`: Fastify server and API routes.
- `src/worker.ts`: worker process entrypoint and config wiring.
- `src/worker/index-source-worker.ts`: source indexing worker that consumes the PHP analyzer JSONL stream.
- `src/queue/index-packages.ts`: BullMQ queue contract.
- `src/modules/processing/source-php/`: JSONL stream consumption, fact accumulation, mapping, and Neo4j writes for source indexing. See `docs/architecture_world_mapping.md`.
- `src/modules/processing/composer-lock/`: Composer lock parsing and graph record building (writes a queryable `psr4Namespaces` list on each Package node).
- `src/modules/processing/magento-xml/`: `index-xml` pipeline that parses Magento XML config (`di.xml`, `events.xml`, `crontab.xml`/`cron_groups.xml`) into DI/observer/cron edges and `Event`/`CronGroup` nodes. One handler per file type (`registry.ts`), shared `record-builder.ts`, injectable IO (`file-system.ts`), discovery + area classification (`discovery.ts`). Entry point `src/worker/index-xml-worker.ts`.
- `src/modules/processing/package-linking/`: `index-links` pipeline that connects declared `:PHPClass` nodes to `:Package` nodes with `DECLARED_IN_PACKAGE` edges via PSR-4 longest-prefix matching, entirely in Cypher. Entry point `src/worker/index-links-worker.ts`; triggered by `POST /api/graph/index/links` (optional `{ "symbolId": "<FQN>" }` for a scoped relink).
- `src/modules/graph/`: generic graph write helpers (`upsert.ts` for the source path, `merge-sync.ts` for the composer path — merge nodes/edges then prune what is no longer present).
- `src/api/usage/`: `GET /api/status` (combined frontend status: indexing in-progress/locked + AI-agent connected) and `POST /api/usage/ping` (clients record recent activity). Backed by `src/modules/usage.ts`, a neutral `usage:last` Redis key with a 120s TTL (the TTL is the idle window; key present = connected).
- `src/api/config/`: `GET /api/config` and `PUT /api/config` for user-editable runtime settings, plus `GET /api/graph/stats` (Neo4j node/edge counts) under `src/api/graph/stats.ts`. Settings are file-backed by `src/modules/app-config.ts` (JSON at `MAGENTIC_CONFIG_PATH`, default `/app/data/config.json`, bind-mounted from `./data` so it survives rebuilds) — loaded into memory at backend startup and rewritten only on UI save; manual file edits need a backend restart. Settings: `phpVersion` (parser target, threaded into the index-source job and on to the PHP analyzer's `ParserFactory`), `projectRoot` (where `composer.lock` is read, joined onto the mount in `getComposerRoot`), and `sourceSubpaths` (a list of directories scanned for PHP, each in its own analyzer pass; empty = whole mount). The worker never reads the file — the backend snapshots these into job data at enqueue time. The single index-source job loops the directories (worker concurrency is 1, so per-directory queue jobs would not parallelize anyway) and reports per-directory progress.
- `src/config.ts`: environment-backed config, including `GRAPH_BATCH_SIZE` (source ingestion batch and transaction size, default 5000).
- `src/schema/install-schemas.ts`: startup schema installer.
- `schema/postgresql/`: PostgreSQL `.sql` schema scripts.
- `schema/neo4j/`: Neo4j `.cypher` schema scripts. Node id uniqueness is per label (`PHPClass.id`, `PHPMethod.id`, `Event.id`, `CronGroup.id`, `Package.id`, `Author.id`) — there is no shared `:Symbol` base. Plus edge identity constraints for EXTENDS, IMPLEMENTS, USES, HAS_METHOD, PARAM_TYPE, RETURNS_TYPE, DECLARED_IN_PACKAGE, PREFERENCE_FOR, PLUGIN_FOR, INJECTS, OBSERVES, and SCHEDULED_IN. See `docs/architecture_world_mapping.md` for the node/edge model.

Schema scripts are installed on backend/worker startup, not during Docker build and not from frontend requests. PostgreSQL stores executed schema scripts in `application_schema_history`.

## Frontend Layout

Important site paths:

- `src/app/App.tsx`: app shell, routing, fixed sidebar/top bar layout.
- `src/app/navigation.ts`: navigation IDs and route paths.
- `src/components/`: shared UI components.
- `src/features/graph/`: React Force Graph 2D graph visualization.
- `src/views/`: route views.

The frontend uses same-origin `/api/*` calls through a central `apiFetch` helper (`src/lib/api.ts`) that attaches the bearer token. Nginx proxies `/api` to `magentic_backend:3000` and `/mcp` to `magentic_mcp:3000` in both dev and prod.

## PHP Analyzer Layout

Important PHP analyzer paths:

- `packages/php-analyzer/composer.json`: PHP package manifest.
- `services/analyzer-php/Dockerfile`: PHP analyzer runtime image.

The analyzer package uses PSR-4 namespace `Magentic\PhpAnalyzer\`. The analyzed source mount is read-only at `/mnt/analyzed-source`; do not confuse it with the analyzer application source in `packages/php-analyzer`.

## Conventions

- Keep source-code comments out. ESLint enforces this: the only comment form allowed is a `/** */` doc block (no `//` line comments, no inline comments). Add a doc block only for type information a native type cannot express.
- Prefer dash-case filenames for consistency with the core package.
- Keep Docker service names as `magentic_*`.
- Keep Docker service Dockerfiles under matching `services/<service>/` directories when possible. `services/backend/Dockerfile` intentionally builds the shared backend image used by both `magentic_backend` and `magentic_worker`.
- Do not import from archive/reference folders.
- Do not add test files unless explicitly requested.
- Treat Redis as short-term process state; PostgreSQL is durable application state; Neo4j is graph storage.

### PHP Conventions

These apply to PHP code (`packages/php-analyzer`). Clean code comes first; treat the rest as defaults, not hard gates. It is fine to write a rough version first and refine it after.

- Do not mark a class `final` unless the design clearly calls for sealing it; `final` blocks extension and mocking.
- Prefer a `readonly` class. If it must hold mutable state, mark the unchanging properties `readonly`.
- Keep functions flat; favor early returns and small private helpers over nested blocks.
- When a function declares more than two parameters, put each parameter on its own line.
- Let the code describe itself instead of commenting. Add a docblock only for type information a native type cannot express (generics, array shapes); when a docblock is present, document every such parameter and the return so it is not partial.
- Replace an if/else chain of more than two branches with `match` (or `switch`).
- Model a fixed set of values as an enum rather than an array of constants or magic strings.
- Inject collaborators so they can be mocked in tests; instantiating a pure value object from local data is fine.
