export type SymbolFact = {
  fact: "symbol";
  symbolId: string;
  fqcn: string;
  kind: string;
};

export type ReferenceFact = {
  fact: "reference";
  kind: string;
  fromSymbolId: string;
  toSymbolId: string;
};

export type FileFacts = {
  file: string;
  facts: (SymbolFact | ReferenceFact)[];
};
