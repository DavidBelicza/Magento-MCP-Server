import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { GraphSearchResult } from "../graph/types.js";

export type SaveQueryHistoryInput = {
  description: string;
  cypherQuery: string;
  result: GraphSearchResult;
};

export type QueryHistoryItem = {
  id: string;
  createdAt: string;
  description: string;
  nodeCount: number;
  relationshipCount: number;
  rowCount: number;
};

export type QueryHistoryDetail = QueryHistoryItem & {
  result: GraphSearchResult;
};

export async function saveQueryHistory(postgres: Pool, input: SaveQueryHistoryInput): Promise<string> {
  const historyId = randomUUID();

  await postgres.query(
    `INSERT INTO query_history (id, description, cypher_query, result)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [historyId, input.description, input.cypherQuery, JSON.stringify(input.result)]
  );

  return historyId;
}

export async function listQueryHistory(postgres: Pool): Promise<QueryHistoryItem[]> {
  const result = await postgres.query<{
    id: string;
    created_at: Date;
    description: string;
    node_count: string;
    relationship_count: string;
    row_count: string;
  }>(
    `SELECT
       id,
       created_at,
       description,
       jsonb_array_length(COALESCE(result #> '{graph,nodes}', '[]'::jsonb)) AS node_count,
       jsonb_array_length(COALESCE(result #> '{graph,relationships}', '[]'::jsonb)) AS relationship_count,
       jsonb_array_length(COALESCE(result #> '{rows}', '[]'::jsonb)) AS row_count
     FROM query_history
     WHERE jsonb_array_length(COALESCE(result #> '{graph,nodes}', '[]'::jsonb)) > 0
        OR jsonb_array_length(COALESCE(result #> '{graph,relationships}', '[]'::jsonb)) > 0
        OR jsonb_array_length(COALESCE(result #> '{rows}', '[]'::jsonb)) > 0
     ORDER BY created_at DESC
     LIMIT 20`
  );

  return result.rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at.toISOString(),
    description: row.description,
    nodeCount: Number(row.node_count),
    relationshipCount: Number(row.relationship_count),
    rowCount: Number(row.row_count)
  }));
}

export async function getQueryHistory(postgres: Pool, id: string): Promise<QueryHistoryDetail | null> {
  const result = await postgres.query<{
    id: string;
    created_at: Date;
    description: string;
    result: GraphSearchResult;
  }>(
    `SELECT id, created_at, description, result
     FROM query_history
     WHERE id = $1`,
    [id]
  );
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    createdAt: row.created_at.toISOString(),
    description: row.description,
    nodeCount: row.result.graph.nodes.length,
    relationshipCount: row.result.graph.relationships.length,
    rowCount: row.result.rows.length,
    result: row.result
  };
}
