import type { Driver } from "neo4j-driver";
import type { Pool } from "pg";

export type IndexRunState = {
  finishedAt: string;
  nodeCount: number;
  edgeCount: number;
};

export async function recordIndexRun(postgres: Pool, driver: Driver): Promise<void> {
  const { nodeCount, edgeCount } = await countGraph(driver);

  await postgres.query(
    `INSERT INTO index_run_state (id, finished_at, node_count, edge_count)
     VALUES (true, now(), $1, $2)
     ON CONFLICT (id) DO UPDATE SET finished_at = now(), node_count = $1, edge_count = $2`,
    [nodeCount, edgeCount]
  );
}

export async function getIndexRunState(postgres: Pool): Promise<IndexRunState | null> {
  const result = await postgres.query<{ finished_at: Date; node_count: string; edge_count: string }>(
    "SELECT finished_at, node_count, edge_count FROM index_run_state WHERE id = true"
  );
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    finishedAt: row.finished_at.toISOString(),
    nodeCount: Number(row.node_count),
    edgeCount: Number(row.edge_count)
  };
}

async function countGraph(driver: Driver): Promise<{ nodeCount: number; edgeCount: number }> {
  const session = driver.session();

  try {
    const nodes = await session.run("MATCH (n) RETURN count(n) AS count");
    const edges = await session.run("MATCH ()-[r]->() RETURN count(r) AS count");

    return {
      nodeCount: toNumber(nodes.records[0]?.get("count")),
      edgeCount: toNumber(edges.records[0]?.get("count"))
    };
  } finally {
    await session.close();
  }
}

function toNumber(value: unknown): number {
  if (value && typeof (value as { toNumber?: () => number }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber();
  }

  return Number(value ?? 0);
}
