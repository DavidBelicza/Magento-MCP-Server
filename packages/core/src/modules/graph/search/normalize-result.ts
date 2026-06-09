import type { Node, Path, QueryResult, Relationship } from "neo4j-driver";
import neo4j from "neo4j-driver";
import type { GraphSearchNode, GraphSearchRelationship, GraphSearchResult, GraphSearchValue } from "../types.js";

type GraphAccumulator = {
  nodes: Map<string, GraphSearchNode>;
  relationships: Map<string, GraphSearchRelationship>;
};

export function normalizeGraphSearchResult(result: QueryResult): GraphSearchResult {
  const graph: GraphAccumulator = {
    nodes: new Map(),
    relationships: new Map()
  };
  const resultWithKeys = result as typeof result & { keys?: Array<string | number> };
  const columns = (resultWithKeys.keys ?? result.records[0]?.keys ?? []).map(String);
  const rows = result.records.map((record) => {
    const row: Record<string, GraphSearchValue> = {};

    for (const key of columns) {
      row[key] = normalizeGraphValue(record.get(key), graph);
    }

    return row;
  });

  return {
    columns,
    rows,
    graph: {
      nodes: [...graph.nodes.values()],
      relationships: [...graph.relationships.values()]
    }
  };
}

function normalizeGraphValue(value: unknown, graph: GraphAccumulator): GraphSearchValue {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (neo4j.isInt(value)) {
    return value.inSafeRange() ? value.toNumber() : value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeGraphValue(item, graph));
  }

  if (isNeo4jNode(value)) {
    const node = normalizeNode(value, graph);

    graph.nodes.set(node.id, node);

    return {
      id: node.id,
      labels: node.labels,
      kind: node.kind,
      properties: node.properties
    };
  }

  if (isNeo4jRelationship(value)) {
    const relationship = normalizeRelationship(value, graph);

    graph.relationships.set(relationship.id, relationship);

    return {
      id: relationship.id,
      type: relationship.type,
      kind: relationship.kind,
      startNodeId: relationship.startNodeId,
      endNodeId: relationship.endNodeId,
      properties: relationship.properties
    };
  }

  if (isNeo4jPath(value)) {
    return normalizePath(value, graph);
  }

  if (typeof value === "object") {
    const normalized: Record<string, GraphSearchValue> = {};

    for (const [key, item] of Object.entries(value)) {
      normalized[key] = normalizeGraphValue(item, graph);
    }

    return normalized;
  }

  return String(value);
}

function normalizePath(path: Path, graph: GraphAccumulator): GraphSearchValue {
  const start = normalizeNode(path.start, graph);
  const end = normalizeNode(path.end, graph);

  graph.nodes.set(start.id, start);
  graph.nodes.set(end.id, end);

  return {
    startNodeId: start.id,
    endNodeId: end.id,
    segments: path.segments.map((segment) => {
      const segmentStart = normalizeNode(segment.start, graph);
      const segmentEnd = normalizeNode(segment.end, graph);
      const relationship = normalizeRelationship(segment.relationship, graph);

      graph.nodes.set(segmentStart.id, segmentStart);
      graph.nodes.set(segmentEnd.id, segmentEnd);
      graph.relationships.set(relationship.id, relationship);

      return {
        startNodeId: segmentStart.id,
        relationshipId: relationship.id,
        endNodeId: segmentEnd.id
      };
    })
  };
}

function normalizeNode(node: Node, graph: GraphAccumulator): GraphSearchNode {
  const id = getEntityId(node);
  const existingNode = graph.nodes.get(id);

  if (existingNode) {
    return existingNode;
  }

  return {
    id,
    labels: node.labels,
    kind: node.labels[0] ?? "Unknown",
    properties: normalizeProperties(node.properties, graph)
  };
}

function normalizeRelationship(relationship: Relationship, graph: GraphAccumulator): GraphSearchRelationship {
  const id = getEntityId(relationship);
  const existingRelationship = graph.relationships.get(id);

  if (existingRelationship) {
    return existingRelationship;
  }

  return {
    id,
    type: relationship.type,
    kind: relationship.type,
    startNodeId: getRelationshipEndpointId(relationship, "start"),
    endNodeId: getRelationshipEndpointId(relationship, "end"),
    properties: normalizeProperties(relationship.properties, graph)
  };
}

function normalizeProperties(
  properties: Record<string, unknown>,
  graph: GraphAccumulator
): Record<string, GraphSearchValue> {
  const normalizedProperties: Record<string, GraphSearchValue> = {};

  for (const [key, value] of Object.entries(properties)) {
    normalizedProperties[key] = normalizeGraphValue(value, graph);
  }

  return normalizedProperties;
}

function getEntityId(entity: { elementId?: string; identity: unknown }): string {
  return entity.elementId ?? graphEntityId(entity.identity);
}

function graphEntityId(value: unknown): string {
  if (neo4j.isInt(value)) {
    return value.toString();
  }

  return String(value);
}

function getRelationshipEndpointId(relationship: Relationship, endpoint: "start" | "end"): string {
  const relationshipWithElementIds = relationship as Relationship & {
    startNodeElementId?: string;
    endNodeElementId?: string;
  };

  if (endpoint === "start" && relationshipWithElementIds.startNodeElementId) {
    return relationshipWithElementIds.startNodeElementId;
  }

  if (endpoint === "end" && relationshipWithElementIds.endNodeElementId) {
    return relationshipWithElementIds.endNodeElementId;
  }

  return graphEntityId(relationship[endpoint]);
}

function isNeo4jNode(value: unknown): value is Node {
  return (
    typeof value === "object" &&
    value !== null &&
    "labels" in value &&
    "properties" in value &&
    Array.isArray((value as { labels: unknown }).labels)
  );
}

function isNeo4jRelationship(value: unknown): value is Relationship {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "start" in value &&
    "end" in value &&
    "properties" in value
  );
}

function isNeo4jPath(value: unknown): value is Path {
  return (
    typeof value === "object" &&
    value !== null &&
    "start" in value &&
    "end" in value &&
    "segments" in value &&
    Array.isArray((value as { segments: unknown }).segments)
  );
}
