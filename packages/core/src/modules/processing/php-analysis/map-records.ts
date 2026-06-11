import { createHash } from "node:crypto";
import type { GraphNodeRecord, GraphRelationshipRecord } from "../../graph/types.js";
import type { FileFact, FileFacts, ReferenceFact, SymbolFact } from "./types.js";

export type MappedBatch = {
  nodes: GraphNodeRecord[];
  relationships: GraphRelationshipRecord[];
  clearOutboundFromNodeIds: string[];
};

type BatchCollector = {
  nodesById: Map<string, GraphNodeRecord>;
  relationshipsByIdentity: Map<string, GraphRelationshipRecord>;
  definedIds: Set<string>;
};

export function mapFactBatch(batch: FileFacts[]): MappedBatch {
  const collector: BatchCollector = {
    nodesById: new Map(),
    relationshipsByIdentity: new Map(),
    definedIds: new Set()
  };

  for (const fileFacts of batch) {
    for (const fact of fileFacts.facts) {
      collectFact(fact, fileFacts.file, collector);
    }
  }

  return {
    nodes: [...collector.nodesById.values()],
    relationships: [...collector.relationshipsByIdentity.values()],
    clearOutboundFromNodeIds: [...collector.definedIds]
  };
}

function collectFact(fact: FileFact, file: string, collector: BatchCollector): void {
  if (fact.fact === "symbol") {
    collectSymbol(fact, file, collector);
  } else if (fact.fact === "reference") {
    collectReference(fact, collector);
  }
}

function collectSymbol(fact: SymbolFact, file: string, collector: BatchCollector): void {
  if (fact.defined) {
    collector.definedIds.add(fact.symbolId);
  }

  if (fact.defined || !collector.nodesById.has(fact.symbolId)) {
    collector.nodesById.set(fact.symbolId, mapSymbolNode(fact, file));
  }
}

function collectReference(fact: ReferenceFact, collector: BatchCollector): void {
  const relationship = mapReferenceEdge(fact);
  collector.relationshipsByIdentity.set(relationship.identity, relationship);
}

function capitalize(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function mapSymbolNode(fact: SymbolFact, file: string): GraphNodeRecord {
  return {
    label: `Symbol:PHP:${capitalize(fact.kind)}`,
    id: fact.symbolId,
    fields: {
      fqcn: fact.fqcn,
      kind: fact.kind,
      file
    }
  };
}

function mapReferenceEdge(fact: ReferenceFact): GraphRelationshipRecord {
  const type = fact.kind.toUpperCase();
  const identity = createHash("sha256")
    .update(`${fact.fromSymbolId}:${type}:${fact.toSymbolId}`)
    .digest("hex");

  return {
    type,
    identity,
    fromLabel: "Symbol",
    fromId: fact.fromSymbolId,
    toLabel: "Symbol",
    toId: fact.toSymbolId,
    fields: {}
  };
}
