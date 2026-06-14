export type McpConfig = {
  port: number;
  backendUrl: string;
  allowedOrigins: string[];
};

function readNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readConfig(): McpConfig {
  const allowedOrigins = (process.env.MCP_ALLOWED_ORIGINS ?? "http://localhost:8080,http://127.0.0.1:8080")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    port: readNumber(process.env.MCP_PORT, 3000),
    backendUrl: process.env.MAGENTIC_BACKEND_URL ?? "http://magentic_backend:3000",
    allowedOrigins
  };
}
