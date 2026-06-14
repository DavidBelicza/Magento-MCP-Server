import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import Fastify from "fastify";
import { createBackendClient } from "./client.js";
import { readConfig } from "./config.js";
import { registerGetGraphSchema } from "./tools/get-graph-schema.js";
import { registerGetStatus } from "./tools/get-status.js";
import { registerGraphSearch } from "./tools/graph-search.js";

const config = readConfig();
const backend = createBackendClient(config.backendUrl);
const app = Fastify({ logger: true, ignoreTrailingSlash: true });

function buildMcpServer(): McpServer {
  const server = new McpServer({ name: "magentic", version: "0.1.0" });

  registerGetStatus(server, backend);
  registerGraphSearch(server, backend);
  registerGetGraphSchema(server);

  return server;
}

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }

  return config.allowedOrigins.includes(origin);
}

function methodNotAllowed(id: number): Record<string, unknown> {
  return {
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed; this MVP serves MCP over POST only." },
    id
  };
}

app.get("/health", async () => ({ ok: true, service: "mcp" }));

app.post("/mcp", async (request, reply) => {
  const origin = typeof request.headers.origin === "string" ? request.headers.origin : undefined;

  if (!isOriginAllowed(origin)) {
    return reply.status(403).send({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Origin not allowed." },
      id: null
    });
  }

  const server = buildMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  reply.raw.on("close", () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    reply.hijack();
    await transport.handleRequest(request.raw, reply.raw, request.body);
  } catch (error) {
    app.log.error(error);

    if (!reply.raw.headersSent) {
      reply.raw.writeHead(500, { "Content-Type": "application/json" });
      reply.raw.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal MCP server error." },
          id: null
        })
      );
    }
  }
});

app.get("/mcp", async (_request, reply) => reply.status(405).send(methodNotAllowed(0)));
app.delete("/mcp", async (_request, reply) => reply.status(405).send(methodNotAllowed(0)));

async function start(): Promise<void> {
  try {
    await app.listen({ host: "0.0.0.0", port: config.port });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

process.on("SIGTERM", async () => {
  await app.close();
});

await start();
