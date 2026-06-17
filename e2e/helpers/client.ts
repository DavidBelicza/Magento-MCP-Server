export const baseUrl = process.env.MAGENTIC_E2E_BASE_URL ?? "http://localhost:8080";

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

// Wait until no indexing job is in progress across any queue. This is robust to
// the fact that BullMQ job ids are per-queue and collide across queues, which
// makes polling a single /status/:jobId ambiguous.
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

export async function pollJobUntilComplete(
  jobId: string,
  { timeoutMs = 60_000, intervalMs = 1_000 }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<string> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { status, body } = await apiRequest(`/api/graph/index/status/${jobId}`);
    const job = body.job as { state?: string } | undefined;
    const state = job?.state;

    if (status === 200 && state === "completed") {
      return state;
    }

    if (state === "failed") {
      throw new Error(`Job ${jobId} failed`);
    }

    await delay(intervalMs);
  }

  throw new Error(`Job ${jobId} did not complete within ${timeoutMs}ms`);
}

export type McpResult = {
  result?: JsonRecord;
  error?: { code: number; message: string };
};

export async function mcpCall(method: string, params?: JsonRecord): Promise<McpResult> {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params })
  });

  const text = await response.text();
  const payload = text.startsWith("data:") ? text.replace(/^data:\s*/, "") : text;

  return JSON.parse(payload) as McpResult;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
