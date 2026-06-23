import type {
  GraphSearchNode,
  GraphSearchRelationship,
  GraphSearchResult,
  GraphSearchValue
} from "../graph/types.js";

export type StructuredGraphSearchNode = {
  id: string;
  type: string;
  labels: string[];
  properties: Record<string, GraphSearchValue>;
};

export type StructuredGraphSearchRelationship = {
  id: string;
  type: string;
  startNodeId: string;
  endNodeId: string;
  properties: Record<string, GraphSearchValue>;
};

export type StructuredGraphSearchResult = {
  nodes: StructuredGraphSearchNode[];
  relationships: StructuredGraphSearchRelationship[];
};

type NodeBuilder = {
  canBuild: (node: GraphSearchNode) => boolean;
  build: (node: GraphSearchNode) => StructuredGraphSearchNode;
};

type RelationshipBuilder = {
  canBuild: (relationship: GraphSearchRelationship) => boolean;
  build: (relationship: GraphSearchRelationship) => StructuredGraphSearchRelationship;
};

const composerRelationshipTypes = new Set([
  "PACKAGE_REQUIRES_PACKAGE",
  "PACKAGE_REQUIRES_DEV_PACKAGE",
  "PACKAGE_AUTHORED_BY",
  "PACKAGE_SUGGESTS_PACKAGE",
  "PACKAGE_REPLACES_PACKAGE",
  "PACKAGE_PROVIDES_PACKAGE",
  "PACKAGE_CONFLICTS_WITH_PACKAGE"
]);

const nodeBuilders: NodeBuilder[] = [
  {
    canBuild: (node) => node.labels.includes("Package"),
    build: (node) => ({
      id: node.id,
      type: "composer-package",
      labels: node.labels,
      properties: node.properties
    })
  },
  {
    canBuild: (node) => node.labels.includes("Author"),
    build: (node) => ({
      id: node.id,
      type: "composer-author",
      labels: node.labels,
      properties: node.properties
    })
  },
  {
    canBuild: (node) => node.labels.includes("PHPMethod"),
    build: (node) => ({
      id: node.id,
      type: "method",
      labels: node.labels,
      properties: node.properties
    })
  },
  {
    canBuild: (node) => node.labels.includes("Event"),
    build: (node) => ({
      id: node.id,
      type: "event",
      labels: node.labels,
      properties: node.properties
    })
  },
  {
    canBuild: (node) => node.labels.includes("CronGroup"),
    build: (node) => ({
      id: node.id,
      type: "cron-group",
      labels: node.labels,
      properties: node.properties
    })
  },
  {
    canBuild: (node) => node.labels.includes("PHPClass"),
    build: (node) => ({
      id: node.id,
      type: "type",
      labels: node.labels,
      properties: node.properties
    })
  }
];

const relationshipBuilders: RelationshipBuilder[] = [
  {
    canBuild: (relationship) => composerRelationshipTypes.has(relationship.type),
    build: (relationship) => ({
      id: relationship.id,
      type: `composer-${relationship.type.toLowerCase().replaceAll("_", "-")}`,
      startNodeId: relationship.startNodeId,
      endNodeId: relationship.endNodeId,
      properties: relationship.properties
    })
  }
];

export function buildGraphSearchResult(result: GraphSearchResult): StructuredGraphSearchResult {
  return {
    nodes: result.graph.nodes.map(buildNode),
    relationships: result.graph.relationships.map(buildRelationship)
  };
}

function buildNode(node: GraphSearchNode): StructuredGraphSearchNode {
  const builder = nodeBuilders.find((candidate) => candidate.canBuild(node));

  return builder?.build(node) ?? {
    id: node.id,
    type: "unknown-node",
    labels: node.labels,
    properties: node.properties
  };
}

function buildRelationship(relationship: GraphSearchRelationship): StructuredGraphSearchRelationship {
  const builder = relationshipBuilders.find((candidate) => candidate.canBuild(relationship));

  return builder?.build(relationship) ?? {
    id: relationship.id,
    type: relationship.type,
    startNodeId: relationship.startNodeId,
    endNodeId: relationship.endNodeId,
    properties: relationship.properties
  };
}
