# MCP Server

`packages/mcp` (`@magentic/mcp`, service `magentic_mcp`) exposes Magentic's code graph to MCP clients. It is a thin adapter: it speaks the MCP protocol and calls the existing backend HTTP API. It holds no graph-domain logic and opens no Redis/PostgreSQL/Neo4j connections of its own.

## Transport

MCP Streamable HTTP at a single endpoint, `POST /mcp`. Stateless JSON mode (no sessions): the SDK transport runs with `sessionIdGenerator: undefined` and `enableJsonResponse: true`. `GET`/`DELETE /mcp` return `405`. The `Origin` header is validated — a present, unrecognized origin gets `403`; a missing origin is allowed so CLI clients work.

Public path: client → `http://localhost:8080/mcp` → nginx (`magentic_frontend`) → `magentic_mcp:3000`.

## Tools

- `get_status` — proxies `GET /api/graph/index/status`. Reports `locked` / `inProgress` plus a plain-language `verdict` so an agent knows whether the graph is mid-rebuild.
- `graph_search` — proxies `POST /api/graph/search` with `{ description, cypherQuery }`. Read-only Cypher is validated by the backend; a backend `400` is returned as a repairable tool error. The tool description carries a compact schema cheat sheet.
- `get_graph_schema` — returns `resource/graph-schema.json` directly (no backend call, since the schema is static). The slim schema lists node kinds, relationship types, edge properties, and type-mapping rules; the worked example lives in `docs/architecture_world_mapping.md`.

## Layout

```text
packages/mcp/
  package.json
  tsconfig.json
  resource/graph-schema.json   # slim schema, served by get_graph_schema (copied into the image)
  src/
    config.ts                  # MCP_PORT, MAGENTIC_BACKEND_URL, MCP_ALLOWED_ORIGINS (env-backed)
    client.ts                  # createBackendClient: fetch wrapper used to call the backend (status + search); maps errors to BackendError(status)
    server.ts                  # Fastify host: /mcp transport, Origin check, /health, builds the McpServer
    tools/
      get-status.ts            # calls backend GET /api/graph/index/status
      graph-search.ts          # calls backend POST /api/graph/search
      get-graph-schema.ts      # reads resource/graph-schema.json directly (no backend call)
```

## Configuration

All env-backed with local defaults (see `src/config.ts`):

- `MCP_PORT` — default `3000`
- `MAGENTIC_BACKEND_URL` — default `http://magentic_backend:3000`
- `MCP_ALLOWED_ORIGINS` — comma-separated, default `http://localhost:8080,http://127.0.0.1:8080`

## Docker and proxying

`magentic_mcp` is built from `services/mcp/Dockerfile` (mirrors the backend image; production stage also copies `resource/`). It has a `/health` healthcheck, and `magentic_frontend` depends on it `service_healthy` because nginx resolves the `/mcp` upstream at startup. nginx proxies `/mcp`; Vite proxies `/mcp` to `magentic_mcp:3000` in dev.

## Smoke checks

```bash
# initialize
curl -s http://localhost:8080/mcp -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"curl","version":"0.0.1"}}}'

# tools/list
curl -s http://localhost:8080/mcp -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

# rejected origin -> 403
curl -i http://localhost:8080/mcp -H "Origin: http://evil.example" \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

## Not in scope

Auth beyond Origin validation, write tools (reindex/reset/delta), MCP prompts, MCP resources, streaming job progress, and result pagination. The schema is exposed only as a tool; a `magentic://graph/schema` MCP resource is a possible later addition.
