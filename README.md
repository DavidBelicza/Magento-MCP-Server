# Magentic

## MCP Server for Agentic AI

## Documentation

- `docs/architecture_project.md`: holistic project and service architecture.
- `docs/architecture_world_mapping.md`: source-code indexing and graph/world-mapping architecture.
- `packages/mcp/resource/graph-schema.json`: slim graph schema served to agents by the MCP server (node kinds, relationships, edge properties, type-mapping rules). The worked example adjacency graph lives in `docs/architecture_world_mapping.md`.
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

## Connecting an MCP Client

The stack exposes an MCP server over Streamable HTTP through the frontend proxy:

```text
http://localhost:8080/mcp
```

Replace `8080` with your `FRONTEND_HTTP_PORT` if you changed it. It exposes three tools: `get_status`, `graph_search`, and `get_graph_schema`. All three clients below connect to this URL directly — no `mcp-remote` or stdio bridge is needed.

CLI and desktop agents send no `Origin` header and connect out of the box. Browser-based clients must use an origin in `MCP_ALLOWED_ORIGINS` (defaults to localhost/127.0.0.1 on `FRONTEND_HTTP_PORT`).

### Claude Code

Command line:

```bash
claude mcp add --transport http magentic http://localhost:8080/mcp
```

Config file (`.mcp.json` in the project root, or user scope in `~/.claude.json`):

```json
{
  "mcpServers": {
    "magentic": {
      "type": "http",
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

Run `/mcp` inside Claude Code to check the connection and list the tools.

### Codex

Command line:

```bash
codex mcp add magentic --url http://localhost:8080/mcp
```

User interface: in the Codex IDE extension, open the gear menu, choose **MCP settings → Open config.toml**, and add:

```toml
[mcp_servers.magentic]
url = "http://localhost:8080/mcp"
```

The CLI and IDE extension share the same `~/.codex/config.toml`, so either method registers the server once.

### Google Antigravity

Antigravity is configured through its UI (no MCP CLI). Open **Settings → Customizations → Open MCP Config** to edit `mcp_config.json`, then add the server. Antigravity uses `serverUrl` (not `url`) for HTTP servers:

```json
{
  "mcpServers": {
    "magentic": {
      "serverUrl": "http://localhost:8080/mcp"
    }
  }
}
```

### Telemetry / Logging (Optional)

Magentic includes a pre-configured PLG (Promtail, Loki, Grafana) stack for centralized logging and telemetry. By default, these services are completely disabled to save local resources.

To boot the environment with the logger stack enabled:
```bash
docker compose --profile telemetry up -d
```

Once running, access the Grafana UI:
```text
http://localhost:3001
username: admin
password: admin
```

#### How to view logs manually in Grafana

Grafana 11 includes a new "Logs" app, but to query raw LogQL streams without extra configuration, you should use the standard **Explore** tab:

1. Look at the left sidebar and click the **Explore** icon (it looks like a small **compass** 🧭).
2. At the top left of the Explore page, ensure **Loki** is selected from the data source dropdown.
3. Switch to the **Code** view (if it is currently in Builder mode).
4. Enter a LogQL query to fetch logs. For example, to see worker logs:
   `{compose_service="magentic_worker"}`
5. Click the blue **Run query** button in the top right corner.

You can entirely mute log generation in the PHP and Node.js applications by setting `ENABLE_TELEMETRY=false` in the `.env` file.

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


Build the whole graph from scratch — deletes everything, then runs composer, source, and linking in order (the "reset and reindex" action). It returns immediately and runs in the background:

```bash
curl -X POST http://localhost:8080/api/graph/index/reset-and-reindex -d '{}'
```

Rebuild without deleting first:

```bash
curl -X POST http://localhost:8080/api/graph/index/reindex -d '{}'
```

Watch what is currently running (and whether a full operation holds the lock):

```bash
curl -s http://localhost:8080/api/graph/index/status
```

Run a single pipeline directly. Source indexing accepts an optional list of directories (whole source when omitted); the matching `DELETE` removes indexed source under those paths:

```bash
curl -X POST http://localhost:8080/api/graph/index/source \
  -H "Content-Type: application/json" \
  -d '{"directories": ["vendor/magento/module-catalog"]}'

curl -X POST http://localhost:8080/api/graph/index/packages -d '{}'
curl -X POST http://localhost:8080/api/graph/index/links -d '{}'
```

Apply an incremental change for a set of paths (the file-watcher entry point), which routes each path to the right pipeline:

```bash
curl -X POST http://localhost:8080/api/graph/index/delta \
  -H "Content-Type: application/json" \
  -d '{"operation": "upsert", "paths": ["vendor/magento/module-catalog"]}'
```

See `docs/architecture_project.md` (Graph Indexing API) for the full endpoint reference and orchestration rules.

To manually test the internal PHP Analyzer HTTP endpoint (`/analyze`) directly via the Docker network:

```bash
docker run --rm --network magentic_default curlimages/curl \
  -X POST http://magentic_analyzer_php/analyze \
  -H "Content-Type: application/json" \
  -d '{"path": "vendor/magento/module-catalog"}'
```

Stop the Docker environment:

```bash
docker compose down
```
