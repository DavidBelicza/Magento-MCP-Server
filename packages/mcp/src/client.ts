export type InProgressJob = {
  queue?: string;
  id?: string;
  name?: string;
  state?: string;
  progress?: unknown;
  timestamp?: number;
};

export type StatusResponse = {
  ok: boolean;
  inProgress: number;
  locked: boolean;
  items: InProgressJob[];
};

export type GraphSearchInput = {
  description: string;
  cypherQuery: string;
};

export type GraphSearchResponse = {
  ok: boolean;
  historyId?: string;
  description?: string;
  cypherQuery?: string;
  result?: unknown;
  structuredResult?: unknown;
};

export type QueryResultResponse = {
  ok: boolean;
  id?: string;
  description?: string;
  result?: unknown;
  structuredResult?: unknown;
};

export type StoreConfigSearchInput = {
  query: string;
  limit?: number;
};

export type StoreConfigSearchResponse = {
  ok: boolean;
  results?: Array<{ path: string; description: string; score: number }>;
};

export class BackendError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "BackendError";
    this.status = status;
  }
}

export type BackendClient = ReturnType<typeof createBackendClient>;

export function createBackendClient(baseUrl: string) {
  const root = baseUrl.replace(/\/+$/, "");

  async function request<T>(path: string, init: RequestInit): Promise<T> {
    let response: Response;

    try {
      response = await fetch(`${root}${path}`, init);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "network error";
      throw new BackendError(`Backend request to ${path} failed: ${reason}`, 502);
    }

    const data = (await response.json().catch(() => null)) as (T & { ok?: boolean; error?: string }) | null;

    if (!response.ok || !data || data.ok === false) {
      const message = data?.error ?? `Backend responded with ${response.status} for ${path}`;
      throw new BackendError(message, response.status);
    }

    return data;
  }

  return {
    ping(): Promise<{ ok: boolean }> {
      return request<{ ok: boolean }>("/api/usage/ping", { method: "POST" });
    },
    getStatus(): Promise<StatusResponse> {
      return request<StatusResponse>("/api/graph/index/status", { method: "GET" });
    },
    searchGraph(input: GraphSearchInput): Promise<GraphSearchResponse> {
      return request<GraphSearchResponse>("/api/graph/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
    },
    getGraphSearchResult(id: string): Promise<QueryResultResponse> {
      return request<QueryResultResponse>(`/api/graph/get-query-history/${encodeURIComponent(id)}`, {
        method: "GET"
      });
    },
    searchStoreConfig(input: StoreConfigSearchInput): Promise<StoreConfigSearchResponse> {
      return request<StoreConfigSearchResponse>("/api/vector/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
    }
  };
}
