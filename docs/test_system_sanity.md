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
- `packages/php-analyzer/composer.lock` is present and matches `packages/php-analyzer/composer.json`.

## Docker Compose Config

Validate the Compose file:

```bash
docker compose config
```

Expected result:

- Compose project name is `magentic`.
- Services are named `magentic_frontend`, `magentic_backend`, `magentic_worker`, `magentic_analyzer_php`, `magentic_redis`, `magentic_postgres`, and `magentic_graphdb`.
- No service is named `core`.
- `magentic_backend` and `magentic_worker` both use `magentic_backend:latest`.
- `magentic_analyzer_php` uses `magentic_analyzer_php:latest`.
- `magentic_frontend` uses `magentic_frontend:latest`.
- `magentic_backend` and `magentic_worker` both mount `${MAGENTIC_ANALYZED_SOURCE_HOST_PATH}` as read-only.
- `magentic_analyzer_php` mounts `${MAGENTIC_ANALYZED_SOURCE_HOST_PATH}` as read-only.

Validate the development override:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml config
```

Expected result:

- `magentic_backend` runs `npm run dev:backend`.
- `magentic_worker` runs `npm run dev:worker`.
- `magentic_backend` builds the `dev` target from `services/backend/Dockerfile`.
- `magentic_backend` and `magentic_worker` use `magentic_backend_dev:latest` in dev mode.
- Both services mount `./packages/core/src:/app/src`.
- Both services keep image-built `node_modules` available inside `/app`.
- Both services keep the analyzed source mount read-only.
- `magentic_analyzer_php` builds from `services/analyzer-php/Dockerfile`.
- `magentic_analyzer_php` mounts `./packages/php-analyzer:/app`.
- `magentic_analyzer_php` runs Composer install on startup in dev mode.
- `magentic_analyzer_php` keeps the analyzed source mount read-only.

## Docker Build

Build images:

```bash
docker compose build
```

Expected result:

- `magentic_backend:latest` builds successfully.
- `magentic_frontend:latest` builds successfully.
- `magentic_analyzer_php:latest` builds successfully.
- npm install runs during image builds, not manually inside containers.
- Composer install runs during the PHP analyzer image build.

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
- `magentic_analyzer_php` is healthy.
- `magentic_redis` is healthy.
- `magentic_postgres` is healthy.
- `magentic_graphdb` is healthy.
- `magentic_frontend` publishes `8080->80`.
- `magentic_graphdb` publishes `7474->7474` and `7687->7687`.
- `magentic_backend` does not publish a host port.
- `magentic_worker` does not publish a host port.
- `magentic_analyzer_php` does not publish a host port.

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

## Graph Search Endpoint Checks

Check a basic read-only graph search:

```bash
curl -s -X POST http://localhost:8080/api/graph/search \
  -H 'Content-Type: application/json' \
  -d '{"description":"Return a constant from Neo4j to verify graph search","cypherQuery":"RETURN 1 AS answer"}'
```

Expected response:

- `ok` is `true`.
- `historyId` is present.
- `result.columns` is `["answer"]`.
- `result.rows` contains `{"answer":1}`.
- `structuredResult.nodes` and `structuredResult.relationships` are present.

Check graph path extraction when graph data is available:

```bash
curl -s -X POST http://localhost:8080/api/graph/search \
  -H 'Content-Type: application/json' \
  -d '{"description":"Return one graph path to verify node and relationship extraction","cypherQuery":"MATCH path = (fromNode)-[relationship]->(toNode) RETURN path LIMIT 1"}'
```

Expected result when indexed graph data exists:

- `ok` is `true`.
- `result.graph.nodes` contains normalized graph nodes.
- `result.graph.relationships` contains normalized graph relationships.
- `structuredResult` contains domain-aware node and relationship types for known graph entities.

Check read-only validation:

```bash
curl -s -o /tmp/magentic_graph_search_unsafe.out -w '%{http_code}' \
  -X POST http://localhost:8080/api/graph/search \
  -H 'Content-Type: application/json' \
  -d '{"description":"Attempt an unsafe write query","cypherQuery":"CREATE (n:UnsafeTest) RETURN n"}'
```

Expected result:

- HTTP status is `400`.
- The response body reports that the query is not allowed.

Check required description validation:

```bash
curl -s -o /tmp/magentic_graph_search_missing_description.out -w '%{http_code}' \
  -X POST http://localhost:8080/api/graph/search \
  -H 'Content-Type: application/json' \
  -d '{"cypherQuery":"RETURN 1 AS answer"}'
```

Expected result:

- HTTP status is `400`.
- The response body reports that `description` is required.

Check query history persistence using the `historyId` returned from a successful graph search:

```bash
docker compose exec -T magentic_postgres psql -U magentic -d magentic \
  -c "SELECT id, description, cypher_query, result FROM query_history WHERE id = '<history-id>';"
```

Expected result:

- The row exists.
- `description` and `cypher_query` match the request.
- `result` stores the raw normalized graph search response as JSONB.

Check the query history list endpoint:

```bash
curl -s http://localhost:8080/api/graph/get-query-history
```

Expected response:

- `ok` is `true`.
- `items` contains at most 20 records.
- Records are ordered newest-first.
- Each item contains `id`, `createdAt`, `description`, `nodeCount`, and `relationshipCount`.
- Items do not include `cypherQuery` or `result`.

Check a saved query history detail using an `id` returned from the list endpoint:

```bash
curl -s http://localhost:8080/api/graph/get-query-history/<history-id>
```

Expected response:

- `ok` is `true`.
- `id`, `createdAt`, and `description` describe the saved query.
- `result` contains the stored raw normalized graph search result.
- `structuredResult` is rebuilt from the stored raw result.
- The response does not include `cypherQuery`.

Check the Query History frontend tab:

```text
http://localhost:8080/history
```

Expected result:

- The page lists recent query history records from PostgreSQL.
- The page does not show a duplicated inner `Query History` or `Sessions` heading.
- Rows use a table-like layout with Query, Graph, Created, and Action columns.
- Each row shows a title derived from the first 10 words of the description.
- The description is one line while collapsed.
- The full description is shown after using the `More` control without rendering a duplicate description.
- The `More` control is hidden when there is no additional description text to reveal.
- Each row shows either graph node/edge counts or `No graph data`.
- Query history UUIDs are not displayed in the row.
- Each history item links to `/graph?queryHistoryId=<history-id>`.
- The selected query preview panel is not shown.

Check a saved query graph page using an `id` returned from the list endpoint:

```text
http://localhost:8080/graph?queryHistoryId=<history-id>
```

Expected result:

- The Graph page loads the saved query history detail.
- The header shows a shortened title derived from the saved query description.
- The node and edge counts reflect the saved `structuredResult`.
- React Force Graph 2D renders the saved graph when the stored result contains graph nodes and relationships.
- Saved results without graph nodes or relationships show an empty-state message instead of a blank canvas.

Check the Graph page without an explicit query history ID:

```text
http://localhost:8080/graph
```

Expected result:

- The page automatically loads the latest query history item.
- The URL is updated to `/graph?queryHistoryId=<latest-history-id>`.
- The graph panel fills the available page height while preserving page padding.

Check the Graph page with a missing query history ID:

```text
http://localhost:8080/graph?queryHistoryId=00000000-0000-0000-0000-000000000000
```

Expected result:

- The graph canvas is not rendered.
- The page shows a query-history-not-found message.
- The page includes a link back to Query History.

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

## PHP Analyzer Checks

Check PHP and Composer inside the analyzer container:

```bash
docker compose exec -T magentic_analyzer_php php -v
docker compose exec -T magentic_analyzer_php composer --version
```

Check PHP CLI limits inside the analyzer container:

```bash
docker compose exec -T magentic_analyzer_php php -r 'echo ini_get("memory_limit"), PHP_EOL, ini_get("max_execution_time"), PHP_EOL;'
```

Expected result:

- PHP reports version 8.5.
- Composer prints a version.
- The memory limit is `1G`.
- The max execution time is `0`.

Check the analyzer command against a single class file:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm --no-deps magentic_analyzer_php php /app/bin/php-analyzer magentic:parse vendor/magento/composer/src/ConsoleArrayInputFactory.php
```

Expected JSONL output:

```jsonl
{"fact":"symbol","symbolId":"php-class:Magento\\Composer\\ConsoleArrayInputFactory","fqcn":"Magento\\Composer\\ConsoleArrayInputFactory","kind":"class"}
```

Check an inherited class:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm --no-deps magentic_analyzer_php php /app/bin/php-analyzer magentic:parse vendor/magento/module-inventory-configuration/Model/StockItemConfiguration.php
```

Expected result:

- The output is JSONL only.
- One line describes `Magento\InventoryConfiguration\Model\StockItemConfiguration`.
- One line describes `Magento\Framework\Model\AbstractExtensibleModel`.
- One line describes an `extends` reference from the child class to the parent class.

Check a larger directory stream:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm --no-deps magentic_analyzer_php sh -lc 'php /app/bin/php-analyzer magentic:parse vendor/magento/module-catalog | php -r '"'"'$count = 0; while (($line = fgets(STDIN)) !== false) { json_decode($line, true, 512, JSON_THROW_ON_ERROR); $count++; } echo "json lines: ", $count, PHP_EOL;'"'"''
```

Expected result:

- Every analyzer output line is valid JSON.
- The command prints a positive JSON line count.

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

Check the PHP analyzer mount:

```bash
docker compose exec -T magentic_analyzer_php sh -lc 'test -d "$MAGENTIC_ANALYZED_SOURCE_PATH" && echo mounted'
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

Check that host-side changes are visible inside the PHP analyzer:

```bash
docker compose exec -T magentic_analyzer_php sh -lc 'test -f "$MAGENTIC_ANALYZED_SOURCE_PATH/.magentic-host-sync-test" && echo synced'
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
