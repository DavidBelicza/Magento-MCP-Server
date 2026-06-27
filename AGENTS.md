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
- `docs/architecture_mcp.md`: the `packages/mcp` service — a thin MCP adapter exposing `get_status`, `graph_search`, `get_graph_search_result`, `store_config_search`, and `get_graph_schema` over Streamable HTTP at `/mcp`. `graph_search` returns a handle (format, `webViewUrl`, `queryId`, and a per-form token estimate) rather than inline data; `get_graph_search_result` fetches the stored result on demand; `store_config_search` is plain-English semantic search over Magento admin configuration.
- `docs/plan_vector_config_search.md`: the semantic config search feature — a second, independent **vector** index pipeline (separate from the graph) that parses `system.xml` into descriptions, embeds them via an external model, and stores them in `magentic_pgvector` for `store_config_search`.
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
- `magentic_pgvector`: dedicated PostgreSQL + `pgvector` instance (image `pgvector/pgvector:pg17`, database `magentic_vectors`) holding the `config_embeddings` semantic-search vectors. Separate from `magentic_postgres` so the vector store stays swappable; schema history is still tracked in `magentic_postgres`.
- `magentic_graphdb`: Neo4j graph database, exposed for local browser/debug access.

Dev Compose overrides are in `docker-compose.dev.yml`. Backend/worker/site/PHP analyzer source mounts allow most source edits without rebuilding the image; the backend/worker also mount `packages/core/schema` so new Neo4j/PostgreSQL schema scripts are installed on restart without an image rebuild. The backend/worker run `tsx` watch; the site runs `vite build --watch` and is served by nginx (refresh the browser to pick up a rebuild — no HMR). Rebuild the image only when package metadata or Dockerfiles change. In dev mode, `magentic_analyzer_php` runs Composer install on startup so `packages/php-analyzer/vendor` is available locally but ignored by Git.

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
- `src/modules/processing/magento-xml/`: `index-xml` pipeline that parses Magento XML config (`di.xml`, `events.xml`, `crontab.xml`/`cron_groups.xml`, `webapi.xml`, `extension_attributes.xml`) into DI/observer/cron/webapi/extension-attribute edges and `Event`/`CronGroup`/`WebapiRoute`/`ExtensionAttribute` nodes. One handler per file type (`registry.ts`), shared `record-builder.ts`, injectable IO (`file-system.ts`), discovery + area classification (`discovery.ts`). Entry point `src/worker/index-xml-worker.ts`.
- `src/modules/processing/package-linking/`: `index-links` pipeline that connects declared `:PHPClass` nodes to `:Package` nodes with `DECLARED_IN_PACKAGE` edges via PSR-4 longest-prefix matching, entirely in Cypher. Entry point `src/worker/index-links-worker.ts`; triggered by `POST /api/graph/index/links` (optional `{ "symbolId": "<FQN>" }` for a scoped relink).
- `src/modules/processing/store-config/`: the **vector** (semantic config search) pipeline's parser. Reads `system.xml` + its `etc/adminhtml/system/*.xml` fragments (`read-store-config-sources.ts`), merges them across files and modules resolving `<include>`s (`merge-store-config.ts` — the genuinely complex part), and builds one natural-language description per config field (`build-config-descriptions.ts`). The structural `section/group/field` path is the id; the explicit `config_path` (when a field declares one) is kept as nullable extra data. `save-config-vector.ts`/`reset-config-vector.ts`/`search-config-vector.ts` map descriptions onto the `config_embeddings` table (`config-embeddings-table.ts`) and call the embedding + vector-store layer. This pipeline writes to `magentic_pgvector`, **not** the graph; it is independent of `index-source`/`index-xml`/etc.
- `src/modules/vector/`: provider-agnostic embedding + storage layer used by the vector pipeline. `embedding.ts` (`embedding()`) calls an OpenAI-format embeddings endpoint via `embedding/request-embeddings.ts` with a configurable URL/model and a nullable bearer token (works with LM Studio, OpenAI, and any compatible server), guarded by an in-house token estimator (`embedding/estimate-tokens.ts`); `vector-store.ts` (`createVectorStore`) is an abstract pgvector store whose table/columns come from a `VectorTable` parameter (upsert/search/reset). `embedding/read-embedding-config.ts` builds the `EmbeddingConfig` from `src/config.ts` for both server and worker.
- `src/queue/index-vector.ts` + `src/worker/index-vector-worker.ts`: the `index-vector` BullMQ pipeline (`operation: "index" | "reset-and-index"`), wired into the single `magentic_worker`. Triggered by `POST /api/vector/index/reindex` (reindex — upsert) and `POST /api/vector/index/reset-and-reindex` (clear then re-embed), mirroring the graph's `reindex`/`reset-and-reindex` pair; both guarded by `magentic:vector-index:lock` (independent of the graph's `magentic:graph-index:lock`). `POST /api/vector/search` embeds a query and returns the top matches.
- `src/modules/graph/`: generic graph write helpers (`upsert.ts` for the source path, `merge-sync.ts` for the composer path — merge nodes/edges then prune what is no longer present).
- `src/api/status.ts` + `src/api/usage/ping.ts`: `GET /api/status` (combined frontend status: graph + vector indexing in-progress/locked + AI-agent connected) and `POST /api/usage/ping` (clients record recent activity). Backed by `src/modules/usage.ts`, a neutral `usage:last` Redis key with a 120s TTL (the TTL is the idle window; key present = connected). The shared snapshot shape is built once by `src/modules/stream/build-status-snapshot.ts` and reused by both the polled route and the stream. Route files mirror their URL segment: `/api/status` → `api/status.ts`, `/api/usage/ping` → `api/usage/ping.ts`, `/api/stream/status` → `api/stream/status.ts`.
- `src/api/stream/status.ts` (route `GET /api/stream/status`) + `src/modules/stream/streamer.ts` + `src/modules/stream/status-events.ts`: a push channel for status. Producers publish a tiny typed flag to one Redis pub/sub channel `magentic:status-events`: indexing changes (the worker on job `active`/`progress`/`completed`/`failed` via `src/modules/stream/forward-index-events.ts`, and the enqueue routes) publish `{ "type": "index" }`; the MCP usage ping publishes `{ "type": "agent_ping" }` only on the idle→connected transition (so a newly connected agent lights up instantly — repeat pings stay silent, and idle resolves via the 59s poll once the `usage:active` TTL expires). The `type` is a publish-side **trigger** label; both triggers re-read the one combined status snapshot. The backend keeps a **single** subscriber that, on any message, debounces, rebuilds the snapshot, and broadcasts it as a single Server-Sent Event `event: status` over `GET /api/stream/status` (including one initial `status` frame on connect — note: never an `agent_ping` frame on connect, so a fresh page load does not look like agent activity). Constant 2 extra Redis connections regardless of queue count (1 publisher in the worker, 1 subscriber in the backend). Final-state correctness: the worker publishes **after** releasing its lock, so the broadcast never reports a stale `locked`. The frontend (`StatusContext`) consumes the stream via a `fetch`-reader (so the bearer header applies — native `EventSource` cannot set it), replaces status on each `event: status`, auto-reconnects with backoff, and keeps a slow 59s safety poll for agent freshness + resync.
- `src/api/config/`: `GET /api/config` and `PUT /api/config` for user-editable runtime settings, plus `GET /api/graph/stats` (Neo4j node/edge counts) under `src/api/graph/stats.ts`. Settings are file-backed by `src/modules/app-config.ts` (JSON at `MAGENTIC_CONFIG_PATH`, default `/app/data/config.json`, bind-mounted from `./data` so it survives rebuilds) — loaded into memory at backend startup and rewritten only on UI save; manual file edits need a backend restart. Settings: `phpVersion` (parser target, threaded into the index-source job and on to the PHP analyzer's `ParserFactory`), `projectRoot` (where `composer.lock` is read, joined onto the mount in `getComposerRoot`), and `sourceSubpaths` (a list of directories scanned for PHP, each in its own analyzer pass; empty = whole mount). The worker never reads the file — the backend snapshots these into job data at enqueue time. The single index-source job loops the directories (worker concurrency is 1, so per-directory queue jobs would not parallelize anyway) and reports per-directory progress.
- `src/config.ts`: environment-backed config, including `GRAPH_BATCH_SIZE` (source ingestion batch and transaction size, default 5000), `POSTGRES_VECTOR_URL` (the `magentic_pgvector` connection), and the embedder settings `EMBEDDER_URL` (full OpenAI-format embeddings endpoint, default `host.docker.internal:1234/v1/embeddings`), `EMBEDDER_MODEL`, and `EMBEDDER_BEARER_TOKEN` (nullable).
- `src/modules/index-lock.ts`: two independent Redis locks — `magentic:graph-index:lock` (graph reindex/reset) and `magentic:vector-index:lock` (vector reindex/reset). Each pipeline acquires/checks only its own.
- `src/schema/install-schemas.ts`: startup schema installer, applying scripts to three databases (`postgresql`, `neo4j`, `pgvector`) and recording history in `magentic_postgres`.
- `schema/postgresql/`: PostgreSQL `.sql` schema scripts.
- `schema/pgvector/`: `magentic_pgvector` `.sql` scripts (the `vector` extension + the `config_embeddings` table, `embedding vector(768)`, keyed by the config `path`).
- `schema/neo4j/`: Neo4j `.cypher` schema scripts. Node id uniqueness is per label (`PHPClass.id`, `PHPMethod.id`, `Event.id`, `CronGroup.id`, `WebapiRoute.id`, `ExtensionAttribute.id`, `Package.id`, `Author.id`) — there is no shared `:Symbol` base. Plus edge identity constraints for EXTENDS, IMPLEMENTS, USES, HAS_METHOD, PARAM_TYPE, RETURNS_TYPE, DECLARED_IN_PACKAGE, PREFERENCE_FOR, PLUGIN_FOR, INJECTS, OBSERVES, SCHEDULED_IN, SERVED_BY, HAS_EXTENSION_ATTRIBUTE, and OF_TYPE. See `docs/architecture_world_mapping.md` for the node/edge model.

Schema scripts are installed on backend/worker startup, not during Docker build and not from frontend requests. PostgreSQL stores executed schema scripts in `application_schema_history`.

## Frontend Layout

Important site paths:

- `src/app/App.tsx`: app shell, routing, fixed sidebar/top bar layout.
- `src/app/navigation.ts`: navigation IDs and route paths.
- `src/components/`: shared UI components.
- `src/features/graph/`: React Force Graph 2D graph visualization.
- `src/views/`: route views.

The frontend uses same-origin `/api/*` calls through a central `apiFetch` helper (`src/lib/api.ts`) that attaches the bearer token. Nginx proxies `/api` to `magentic_backend:3000` (with a dedicated buffering-off `/api/stream` location for the Server-Sent Events status stream) and `/mcp` to `magentic_mcp:3000` in both dev and prod. The nginx template is baked into the `magentic_frontend` image, so changing it (e.g. a new location) needs a frontend image rebuild, not just a restart.

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
