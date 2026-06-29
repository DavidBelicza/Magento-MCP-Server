export type StoreConfigNode = {
  tab: string | null;
  label: string | null;
  comment: string | null;
  configPath: string | null;
  sourceFile: string;
  children: Record<string, StoreConfigNode>;
};

export type StoreConfig = {
  tabs: Record<string, string>;
  sections: Record<string, StoreConfigNode>;
};

export type StoreConfigSourceKind = "system" | "include";

export type StoreConfigSource = {
  kind: StoreConfigSourceKind;
  fileName: string;
  sourceFile: string;
  content: string;
};

export type ConfigFieldDescription = {
  path: string;
  description: string;
  configPath: string | null;
  comment: string | null;
  sourceFile: string;
};

export type ConfigVectorMatch = {
  path: string;
  description: string;
  score: number;
};

export type ParsedXml = Record<string, unknown>;
