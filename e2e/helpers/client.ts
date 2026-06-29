export const baseUrl = process.env.MAGENTIC_E2E_BASE_URL ?? "http://localhost:8080";

export const apiToken = process.env.MAGENTIC_E2E_TOKEN ?? "example-token";

type JsonRecord = Record<string, unknown>;

export type ApiResponse = {
  status: number;
  body: JsonRecord;
};

export async function apiRequest(path: string, init?: RequestInit): Promise<ApiResponse> {
  const headers: Record<string, string> = { ...((init?.headers as Record<string, string>) ?? {}) };

  if (init?.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (apiToken && headers.Authorization === undefined) {
    headers.Authorization = `Bearer ${apiToken}`;
  }

  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });

  const text = await response.text();
  const body = text ? (JSON.parse(text) as JsonRecord) : {};

  return { status: response.status, body };
}

export function searchGraph(cypherQuery: string, description = "e2e query"): Promise<ApiResponse> {
  return apiRequest("/api/graph/search", {
    method: "POST",
    body: JSON.stringify({ description, cypherQuery })
  });
}

export async function searchScalar(cypherQuery: string): Promise<number> {
  const { body } = await searchGraph(cypherQuery);
  const result = body.result as { rows?: Array<Record<string, number>>; columns?: string[] } | undefined;
  const firstColumn = result?.columns?.[0];
  const firstRow = result?.rows?.[0];

  if (!firstColumn || !firstRow) {
    throw new Error(`Query did not return a scalar: ${cypherQuery}`);
  }

  return Number(firstRow[firstColumn]);
}

export async function triggerPackageIndex(): Promise<string> {
  const { status, body } = await apiRequest("/api/graph/index/packages", { method: "POST" });

  if (status !== 202 || typeof body.jobId !== "string") {
    throw new Error(`Unexpected index/packages response: ${status} ${JSON.stringify(body)}`);
  }

  return body.jobId;
}

export async function triggerSourceIndex(directories: string[]): Promise<string> {
  const { status, body } = await apiRequest("/api/graph/index/source", {
    method: "POST",
    body: JSON.stringify({ directories })
  });

  const job = body.job as { id?: string } | undefined;

  if (status !== 202 || typeof job?.id !== "string") {
    throw new Error(`Unexpected index/source response: ${status} ${JSON.stringify(body)}`);
  }

  return job.id;
}

export async function triggerXmlIndex(directories: string[]): Promise<string> {
  const { status, body } = await apiRequest("/api/graph/index/xml", {
    method: "POST",
    body: JSON.stringify({ directories })
  });

  const job = body.job as { id?: string } | undefined;

  if (status !== 202 || typeof job?.id !== "string") {
    throw new Error(`Unexpected index/xml response: ${status} ${JSON.stringify(body)}`);
  }

  return job.id;
}

export async function triggerLinks(symbolId: string | null = null): Promise<string> {
  const { status, body } = await apiRequest("/api/graph/index/links", {
    method: "POST",
    body: JSON.stringify({ symbolId })
  });

  if (status !== 202 || typeof body.jobId !== "string") {
    throw new Error(`Unexpected index/links response: ${status} ${JSON.stringify(body)}`);
  }

  return body.jobId;
}

export async function triggerVectorReindex(): Promise<string> {
  return acceptVectorJob("/api/vector/index/reindex");
}

export async function triggerVectorResetAndReindex(): Promise<string> {
  return acceptVectorJob("/api/vector/index/reset-and-reindex");
}

export async function triggerVectorDelta(paths: string[]): Promise<ApiResponse> {
  return apiRequest("/api/vector/index/delta", {
    method: "POST",
    body: JSON.stringify({ paths })
  });
}

export type VectorMatch = {
  path: string;
  description: string;
  score: number;
};

export async function searchVector(query: string, limit?: number): Promise<VectorMatch[]> {
  const { status, body } = await apiRequest("/api/vector/search", {
    method: "POST",
    body: JSON.stringify(limit === undefined ? { query } : { query, limit })
  });

  if (status !== 200 || body.ok !== true) {
    throw new Error(`Unexpected vector search response: ${status} ${JSON.stringify(body)}`);
  }

  return body.results as VectorMatch[];
}

async function acceptVectorJob(path: string): Promise<string> {
  const { status, body } = await apiRequest(path, { method: "POST" });
  const job = body.job as { id?: string } | undefined;

  if (status !== 202 || typeof job?.id !== "string") {
    throw new Error(`Unexpected ${path} response: ${status} ${JSON.stringify(body)}`);
  }

  return job.id;
}

export async function waitForVectorIdle({
  timeoutMs = 180_000,
  intervalMs = 1_000
}: { timeoutMs?: number; intervalMs?: number } = {}): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { status, body } = await apiRequest("/api/status");
    const vector = body.vector as { inProgress?: number; locked?: boolean } | undefined;

    if (status === 200 && vector?.inProgress === 0 && vector?.locked === false) {
      return;
    }

    await delay(intervalMs);
  }

  throw new Error(`Vector indexing did not become idle within ${timeoutMs}ms`);
}

export async function waitForIdle({
  timeoutMs = 180_000,
  intervalMs = 1_000
}: { timeoutMs?: number; intervalMs?: number } = {}): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { status, body } = await apiRequest("/api/graph/index/status");

    if (status === 200 && body.inProgress === 0 && body.locked === false) {
      return;
    }

    await delay(intervalMs);
  }

  throw new Error(`Indexing did not become idle within ${timeoutMs}ms`);
}

export type McpResult = {
  result?: JsonRecord;
  error?: { code: number; message: string };
};

export async function mcpCall(method: string, params?: JsonRecord): Promise<McpResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream"
  };

  if (apiToken) {
    headers.Authorization = `Bearer ${apiToken}`;
  }

  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params })
  });

  const text = await response.text();
  const payload = text.startsWith("data:") ? text.replace(/^data:\s*/, "") : text;

  return JSON.parse(payload) as McpResult;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
