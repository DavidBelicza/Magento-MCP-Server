export type GraphFieldValue =
  | string
  | number
  | boolean
  | null
  | GraphFieldValue[]
  | { [key: string]: GraphFieldValue };

export type GraphFields = Record<string, GraphFieldValue>;

export type GraphNodeRecord = {
  label: string;
  id: string;
  fields: GraphFields;
};

export type GraphRelationshipRecord = {
  type: string;
  identity: string;
  fromLabel: string;
  fromId: string;
  toLabel: string;
  toId: string;
  fields: GraphFields;
};

export type GraphWriteProgress = {
  phase: string;
  processed: number;
  total: number;
  percent: number;
};

export type GraphWriteSummary = {
  nodeCount: number;
  relationshipCount: number;
  totalCount: number;
};

export type GraphSearchScalar = string | number | boolean | null;

export type GraphSearchValue =
  | GraphSearchScalar
  | GraphSearchValue[]
  | { [key: string]: GraphSearchValue };

export type GraphSearchNode = {
  id: string;
  labels: string[];
  kind: string;
  properties: Record<string, GraphSearchValue>;
};

export type GraphSearchRelationship = {
  id: string;
  type: string;
  kind: string;
  startNodeId: string;
  endNodeId: string;
  properties: Record<string, GraphSearchValue>;
};

export type GraphSearchGraph = {
  nodes: GraphSearchNode[];
  relationships: GraphSearchRelationship[];
};

export type GraphSearchResult = {
  columns: string[];
  rows: Record<string, GraphSearchValue>[];
  graph: GraphSearchGraph;
};

export type GraphSearchOptions = {
  timeoutMs?: number;
};
