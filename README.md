
<p align="center">
  <img src=".github/logo.jpg" alt="Magentic logo" width="140" height="140">
</p>

<h1 align="center">Magentic - Magento MCP Server</h1>

<p align="center">
  <a href="https://github.com/DavidBelicza/Magento-MCP-Server/actions/workflows/ci.yml"><img src="https://github.com/DavidBelicza/Magento-MCP-Server/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
  <a href="https://github.com/DavidBelicza/Magento-MCP-Server/actions/workflows/release.yml"><img src="https://github.com/DavidBelicza/Magento-MCP-Server/actions/workflows/release.yml/badge.svg" alt="Release"></a>
  <a href="https://github.com/DavidBelicza/Magento-MCP-Server/releases"><img src="https://img.shields.io/github/v/release/DavidBelicza/Magento-MCP-Server" alt="Latest release"></a>
  <a href="https://github.com/DavidBelicza?tab=packages&amp;repo_name=Magento-MCP-Server"><img src="https://img.shields.io/badge/ghcr.io-images-2496ED?logo=docker&amp;logoColor=white" alt="Container images"></a>
</p>

<p align="center">
Magentic is a self-hosted <strong>standard MCP (Model Context Protocol) server</strong>.<br/>
Magentic maps the Magento codebase into a graph and a vector database that any <strong>AI agent can explore for grounded symbolic reasoning and semantic understanding</strong>.
</p>

## Features

| Name | Description |
| --- | --- |
| 🤖 **MCP for AI Agents** | Any MCP-compatible AI agent can use Magentic by triggering it directly, just type "*use Magentic to do...*". |
| 🕸️ **Symbolic Search** | Search across Composer packages, PHP, and XML config (DI, plugins, events, REST APIs) using a knowledge graph. |
| 🧠 **Semantic Search** | AI-powered semantic search in store configurations using embedding AI models and a vector database. |

## How it works

```mermaid
flowchart TD
    Source[Magento source]
    Magentic[Magentic MCP]
    Graph[(Graph Database)]
    Embedder[AI Embedder]
    Vector[(Vector Database)]
    Agent[AI Agent]

    Source -->|watches changes, reads PHP AST, XML| Magentic
    Magentic -->|writes nodes and edges| Graph
    Magentic <-->|sends text, gets embeddings| Embedder
    Magentic -->|stores embeddings| Vector
    Agent <-->|asks and receives| Magentic
    Magentic -->|searches code| Graph
    Magentic -->|semantic search| Vector

    classDef brand fill:#fd8504,stroke:#d97004,color:#ffffff;
    class Source,Magentic,Graph,Embedder,Vector,Agent brand;
```

Magentic uses **symbolic reasoning and semantic understanding to prevent the model from hallucinating**.
There are six components in the algorithm: the AI Agent, the Magentic MCP, the Magentic Graph Database, the AI Embedder, the Magentic Vector Database, and the Magento source. It works with any standard AI agent solution that implements MCP, such as *Anthropic Claude, OpenAI Codex, Google Antigravity*, and others.

- Magentic watches your source for file changes and runs a partial update or a full reindex.
- It understands the PHP abstract syntax tree and pushes it into the graph database.
- It understands the Magento configurations and pushes them into the vector database.
- Your AI agent talks to the Magentic MCP, and Magentic searches the graph, and the vector database for it.

## Setup

### 1. Prerequisites

- **MacOS**: [OrbStack](https://orbstack.dev/) (recommended) or [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- **Windows**: [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine installed in WSL2 with the Compose plugin
- **Linux**: [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine with the Compose plugin

**Minimum system requirements:**

| Resource | Minimum | Recommended |
| --- | --- | --- |
| CPU | 4 cores (x86-64 or Apple Silicon / arm64) | 8 cores |
| RAM | 8 GB | 16 GB |
| GPU | Not required; the bundled embedder runs on CPU | Optional — an external GPU-backed embedder (e.g. LM Studio) speeds up indexing |
| Free storage | 10 GB | 20 GB or more for large codebases |

Indexing a full Magento install is memory- and CPU-intensive (Neo4j alone reserves about 2 GB of heap, and embedding runs on the CPU by default), so more RAM and cores directly shorten indexing time.

### 2. Download

Clone it with git:

```bash
cd to-your-project-directory
git clone https://github.com/DavidBelicza/Magento-MCP-Server.git .
```

Or download it as a zip from the [releases page](https://github.com/DavidBelicza/Magento-MCP-Server/releases), unzip it, and open the folder in a terminal.

### 3. Install

Copy the content of `.env.example` into a new `.env` file:

```bash
cp .env.example .env
```

Open the `.env` file and set `MAGENTIC_ANALYZED_SOURCE_HOST_PATH` to the absolute path of the codebase you want to analyze.

If port `8081` is already in use on your machine, change `FRONTEND_HTTP_PORT`.

The first run downloads the prebuilt images and starts everything, which can take a few minutes (run this command again later if you change the `.env` file):

```bash
docker compose up -d --pull always
```

### 4. Configure

The graph is empty until you index your source.

1. Open `http://localhost:8081`.
2. Go to **Settings**.
3. Under **Indexing Pipeline**, click **Reset & reindex all**.

Indexing time depends on your machine and the size of the codebase. It can take from about a minute on a capable machine to around half an hour on a slow one. You can keep using the app while it runs, and the status updates when it finishes.

### 5. Connect your AI agent

The MCP endpoint is `http://localhost:8081/mcp` (replace `8081` if you changed the port). The examples use the default token `example-token`. If you set your own `MAGENTIC_API_TOKEN`, use that value instead.

#### Anthropic Claude Code

From your Magento project folder, run:

```bash
claude mcp add --scope project --transport http magentic http://localhost:8081/mcp \
  --header "Authorization: Bearer example-token"
```

This creates a `.mcp.json` in your Magento project. Run `/mcp` to confirm it is connected.

*Alternatively, you can ask your AI agent to set it up for you, then restart the AI agent.*

#### OpenAI Codex

Create `.codex/config.toml` in your Magento project:

```toml
[mcp_servers.magentic]
url = "http://localhost:8081/mcp"
bearer_token_env_var = "MAGENTIC_API_TOKEN"
```

Codex reads the token from an environment variable. Set it, then restart Codex:

```bash
export MAGENTIC_API_TOKEN=example-token
```

*Alternatively, you can ask your AI agent to set it up for you, then restart the AI agent.*

#### Google Antigravity

Open **Settings → MCP Config** and add:

```json
{
  "mcpServers": {
    "magentic": {
      "serverUrl": "http://localhost:8081/mcp",
      "headers": {
        "Authorization": "Bearer example-token"
      }
    }
  }
}
```

*Alternatively, you can ask your AI agent to set it up for you, then restart the AI agent.*

### Troubleshooting

#### Replacing the AI model

Magentic comes with the Embedding Gemma AI model that transforms text into vectors inside a Docker container. You can replace it with your own AI, for example by running the LM Studio desktop app on your local machine. Once your embedding model is running, you can switch to it from the Settings menu in Magentic. A model in LM Studio is expected to be faster than one in a container, because it can also access the GPU.

#### Update Magentic

Pull the latest project files and images, then recreate the containers from the project folder:

```bash
git pull
docker compose up -d --pull always
```

This downloads the newest images and restarts the stack. Your indexed graph and other data remain untouched.

#### Remove Magentic

Run this **from the project folder** to stop everything and delete the containers, the graph data, and the images:

```bash
docker compose down -v --rmi all
```

## For developers

These steps are only needed if you want to modify the source code of Magentic; they are not needed to use this project.

The default setup pulls prebuilt images from the GitHub Container Registry. If you want to change the code, build the images from source or run the stack in development mode with live reload.

Build the images locally instead of pulling them:

```bash
docker compose up -d --build
```

Run the development stack with source mounts and live rebuilds (the backend and worker watch with `tsx`; the site rebuilds with `vite build --watch` and is served by nginx, so refresh the browser to pick up changes):

```bash
npm run docker:dev
```

Use `npm run docker:dev:build` instead when a Dockerfile or package metadata changes.

Install the workspace dependencies to run the checks locally:

```bash
npm install
npm run lint
npm run typecheck
npm test
```

See [`AGENTS.md`](AGENTS.md) for the full architecture and contributor guide.

## Documentation

- [`docs/architecture_project.md`](docs/architecture_project.md) covers the overall project and service architecture.
- [`docs/architecture_world_mapping.md`](docs/architecture_world_mapping.md) covers how source is indexed into the graph.
- [`docs/architecture_mcp.md`](docs/architecture_mcp.md) covers the MCP service and its tools.
- [`docs/architecture_auth.md`](docs/architecture_auth.md) covers the access-control design.
- [`docs/plan_magento_xml_indexing.md`](docs/plan_magento_xml_indexing.md) covers the Magento XML config indexing pipeline.
- [`docs/plan_vector_config_search.md`](docs/plan_vector_config_search.md) covers the semantic store-config search pipeline.
- [`docs/test_system_sanity.md`](docs/test_system_sanity.md) covers runtime and integration checks.
- [`docs/README-performance.md`](docs/README-performance.md) covers analyzer performance notes.
- [`research/2026-06-26-semantic-config-search-feasibility.md`](research/2026-06-26-semantic-config-search-feasibility.md) is a feasibility snapshot on semantic search over Magento `system.xml` configuration.
- [`research/2026-06-28-semantic-code-search-feasibility.md`](research/2026-06-28-semantic-code-search-feasibility.md) is a feasibility snapshot on semantic search over Magento code (class and interface descriptions).
- [`AGENTS.md`](AGENTS.md) is the contributor and development guide.
