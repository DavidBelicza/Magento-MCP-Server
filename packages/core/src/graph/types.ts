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
