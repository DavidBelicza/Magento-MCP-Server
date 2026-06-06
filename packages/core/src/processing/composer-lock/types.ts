import type { GraphFields, GraphFieldValue } from "../../graph/types.js";

export type ComposerLock = {
  packages?: ComposerPackage[];
  "packages-dev"?: ComposerPackage[];
};

export type ComposerPackage = {
  name: string;
  version?: string;
  type?: string;
  description?: string;
  license?: string[];
  authors?: ComposerAuthor[];
  autoload?: ComposerAutoload;
  require?: ComposerDependencyMap;
  "require-dev"?: ComposerDependencyMap;
  suggest?: Record<string, string>;
  replace?: ComposerDependencyMap;
  provide?: ComposerDependencyMap;
  conflict?: ComposerDependencyMap;
  source?: ComposerPackageSource;
  dist?: ComposerPackageDist;
};

export type ComposerAuthor = {
  name?: string;
  email?: string;
  homepage?: string;
  role?: string;
};

export type ComposerAutoload = {
  "psr-4"?: Record<string, string | string[]>;
  "psr-0"?: Record<string, string | string[]>;
  classmap?: string[];
  files?: string[];
};

export type ComposerDependencyMap = Record<string, string>;

export type ComposerPackageSource = {
  reference?: string;
};

export type ComposerPackageDist = {
  reference?: string;
  shasum?: string;
};

export type ComposerNodeRecord = {
  table: "Package" | "Author";
  id: string;
  fields: GraphFields;
  metadataHash: string;
};

export type ComposerEdgeRecord = {
  edgeTable: ComposerRelationshipType;
  edgeIdentity: string;
  fromNodeTable: "Package";
  fromNodeId: string;
  toNodeTable: "Package" | "Author";
  toNodeId: string;
  fields: GraphFields;
  metadataHash: string;
};

export type ComposerRelationshipType =
  | "PACKAGE_REQUIRES_PACKAGE"
  | "PACKAGE_REQUIRES_DEV_PACKAGE"
  | "PACKAGE_AUTHORED_BY"
  | "PACKAGE_SUGGESTS_PACKAGE"
  | "PACKAGE_REPLACES_PACKAGE"
  | "PACKAGE_PROVIDES_PACKAGE"
  | "PACKAGE_CONFLICTS_WITH_PACKAGE";

export type ComposerGraphRecords = {
  packageNodes: Map<string, ComposerNodeRecord>;
  authorNodes: Map<string, ComposerNodeRecord>;
  edges: Map<string, ComposerEdgeRecord>;
};

export type ComposerParsingResult = {
  composerLockPath: string;
  packageCount: number;
  authorCount: number;
  edgeCount: number;
  totalCount: number;
  records: ComposerGraphRecords;
};

export type ComposerProcessingProgressPhase =
  | "parsing"
  | "clearing-graph"
  | "writing-packages"
  | "writing-authors"
  | "writing-relationships"
  | "completed";

export type ComposerProcessingProgress = {
  phase: ComposerProcessingProgressPhase;
  processed: number;
  total: number;
  percent: number;
};

export type ComposerWriteSummary = {
  packageCount: number;
  authorCount: number;
  edgeCount: number;
  totalCount: number;
};
