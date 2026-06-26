export type GraphSearchResultShape = {
  columns?: string[];
  rows?: Array<Record<string, unknown>>;
};

export type StructuredResultShape = {
  nodes?: unknown[];
  relationships?: unknown[];
};

export type TablePayload = {
  columns: string[];
  rows: Array<Record<string, unknown>>;
};

export type GraphPayload = {
  nodes: unknown[];
  relationships: unknown[];
  rows: Array<Record<string, unknown>>;
};

export function collapseEntityReferences(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(collapseEntityReferences);
  }

  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (typeof record.id === "string") {
      return record.id;
    }

    const collapsed: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(record)) {
      collapsed[key] = collapseEntityReferences(item);
    }

    return collapsed;
  }

  return value;
}

export function readResultShapes(source: { result?: unknown; structuredResult?: unknown }): {
  result: GraphSearchResultShape;
  structured: StructuredResultShape;
} {
  return {
    result: (source.result ?? {}) as GraphSearchResultShape,
    structured: (source.structuredResult ?? {}) as StructuredResultShape
  };
}

export function hasGraphEntities(structured: StructuredResultShape): boolean {
  return (structured.nodes?.length ?? 0) > 0 || (structured.relationships?.length ?? 0) > 0;
}

export function buildTablePayload(result: GraphSearchResultShape): TablePayload {
  return {
    columns: result.columns ?? [],
    rows: (result.rows ?? []).map(collapseRow)
  };
}

export function buildGraphPayload(
  result: GraphSearchResultShape,
  structured: StructuredResultShape
): GraphPayload {
  return {
    nodes: structured.nodes ?? [],
    relationships: structured.relationships ?? [],
    rows: (result.rows ?? []).map(collapseRow)
  };
}

export function estimateTokens(payload: unknown): number {
  return Math.ceil(JSON.stringify(payload).length / 4);
}

function collapseRow(row: Record<string, unknown>): Record<string, unknown> {
  const collapsed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    collapsed[key] = collapseEntityReferences(value);
  }

  return collapsed;
}
