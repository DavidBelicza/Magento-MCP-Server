import type { GraphFieldValue } from "../../graph/types.js";

export type SymbolFact = {
  fact: "symbol";
  symbolId: string;
  fqcn: string;
  kind: string;
  defined: boolean;
  properties?: Record<string, GraphFieldValue>;
};

export type ReferenceFact = {
  fact: "reference";
  kind: string;
  fromSymbolId: string;
  toSymbolId: string;
  fields?: Record<string, GraphFieldValue>;
  identityKey?: string;
};

export type ErrorFact = {
  fact: "error";
  path: string;
  message: string;
};

export type FileFact = SymbolFact | ReferenceFact | ErrorFact;

export type FileFacts = {
  file: string;
  facts: FileFact[];
};
