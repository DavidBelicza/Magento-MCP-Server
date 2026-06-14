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

## Docker Services

The Compose project is named `magentic`. Main services:

- `magentic_frontend`: public entrypoint on `localhost:8080`; Nginx in production, Vite in dev override.
- `magentic_backend`: private Fastify API service; routes live in `packages/core/src/server.ts`.
- `magentic_worker`: private BullMQ worker; entrypoint is `packages/core/src/worker.ts`.
- `magentic_analyzer_php`: private PHP analyzer runtime.
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
- `src/modules/processing/package-linking/`: `index-links` pipeline that connects declared `:Symbol` nodes to `:Package` nodes with `DECLARED_IN_PACKAGE` edges via PSR-4 longest-prefix matching, entirely in Cypher. Entry point `src/worker/index-links-worker.ts`; triggered by `POST /api/graph/index/links` (optional `{ "symbolId": "<FQN>" }` for a scoped relink).
- `src/modules/graph/`: generic graph write helpers (`upsert.ts` for the source path, `merge-sync.ts` for the composer path — merge nodes/edges then prune what is no longer present).
- `src/config.ts`: environment-backed config, including `GRAPH_BATCH_SIZE` (source ingestion batch and transaction size, default 5000).
- `src/schema/install-schemas.ts`: startup schema installer.
- `schema/postgresql/`: PostgreSQL `.sql` schema scripts.
- `schema/neo4j/`: Neo4j `.cypher` schema scripts (Symbol id uniqueness; edge identity constraints for EXTENDS, IMPLEMENTS, USES, HAS_METHOD, PARAM_TYPE, RETURNS_TYPE, and DECLARED_IN_PACKAGE).

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
