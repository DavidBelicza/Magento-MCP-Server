import type { Pool } from "pg";
import type { VectorMatch, VectorStore, VectorTable } from "./types.js";

export function createVectorStore(pool: Pool, table: VectorTable): VectorStore {
  const insertColumns = [table.idColumn, ...table.dataColumns, table.embeddingColumn];
  const updateColumns = [...table.dataColumns, table.embeddingColumn];

  return {
    reset: async () => {
      await pool.query(`TRUNCATE ${ident(table.name)}`);
    },
    upsert: async (rows) => {
      for (const row of rows) {
        const values = insertColumns.map((column) => toValue(column, table.embeddingColumn, row[column]));
        const placeholders = insertColumns.map((_, index) => `$${index + 1}`);
        const updates = updateColumns.map((column) => `${ident(column)} = EXCLUDED.${ident(column)}`);

        await pool.query(
          `INSERT INTO ${ident(table.name)} (${insertColumns.map(ident).join(", ")})
           VALUES (${placeholders.join(", ")})
           ON CONFLICT (${ident(table.idColumn)}) DO UPDATE SET ${updates.join(", ")}`,
          values
        );
      }
    },
    search: async (embedding, limit) => {
      const selectColumns = [table.idColumn, ...table.dataColumns];
      const result = await pool.query<Record<string, unknown>>(
        `SELECT ${selectColumns.map(ident).join(", ")}, 1 - (${ident(table.embeddingColumn)} <=> $1::vector) AS score
         FROM ${ident(table.name)}
         ORDER BY ${ident(table.embeddingColumn)} <=> $1::vector
         LIMIT $2`,
        [JSON.stringify(embedding), limit]
      );

      return result.rows.map(toMatch);
    },
    list: async () => {
      const selectColumns = [table.idColumn, ...table.dataColumns];
      const result = await pool.query<Record<string, unknown>>(
        `SELECT ${selectColumns.map(ident).join(", ")} FROM ${ident(table.name)}`
      );

      return result.rows;
    },
    deleteByIds: async (ids) => {
      if (ids.length === 0) {
        return;
      }

      await pool.query(`DELETE FROM ${ident(table.name)} WHERE ${ident(table.idColumn)} = ANY($1)`, [ids]);
    }
  };
}

function toValue(column: string, embeddingColumn: string, value: unknown): unknown {
  return column === embeddingColumn ? JSON.stringify(value) : value;
}

function toMatch(row: Record<string, unknown>): VectorMatch {
  const { score, ...rest } = row;

  return { row: rest, score: Number(score) };
}

function ident(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Invalid SQL identifier: ${name}`);
  }

  return `"${name}"`;
}
