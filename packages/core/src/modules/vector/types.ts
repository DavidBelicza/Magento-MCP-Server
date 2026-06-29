export type VectorTable = {
  name: string;
  idColumn: string;
  embeddingColumn: string;
  dataColumns: string[];
};

export type VectorRow = Record<string, unknown>;

export type VectorMatch = {
  row: Record<string, unknown>;
  score: number;
};

export type VectorStore = {
  reset: () => Promise<void>;
  upsert: (rows: VectorRow[]) => Promise<void>;
  search: (embedding: number[], limit: number) => Promise<VectorMatch[]>;
  list: () => Promise<VectorRow[]>;
  deleteByIds: (ids: string[]) => Promise<void>;
};
