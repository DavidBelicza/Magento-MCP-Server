import { createHash } from "node:crypto";
import type { GraphNodeRecord, GraphRelationshipRecord } from "../../graph/types.js";
import type { FileFact, FileFacts, ReferenceFact, SymbolFact } from "./types.js";

export type ClearOutboundGroup = {
  label: string;
  ids: string[];
};

export type MappedBatch = {
  nodes: GraphNodeRecord[];
  relationships: GraphRelationshipRecord[];
  clearOutbound: ClearOutboundGroup[];
};

type BatchCollector = {
  nodesById: Map<string, GraphNodeRecord>;
  relationshipsByIdentity: Map<string, GraphRelationshipRecord>;
  definedClassIds: Set<string>;
  definedMethodIds: Set<string>;
};

export function mapFactBatch(batch: FileFacts[]): MappedBatch {
  const collector: BatchCollector = {
    nodesById: new Map(),
    relationshipsByIdentity: new Map(),
    definedClassIds: new Set(),
    definedMethodIds: new Set()
  };

  for (const fileFacts of batch) {
    for (const fact of fileFacts.facts) {
      collectFact(fact, fileFacts.file, collector);
    }
  }

  return {
    nodes: [...collector.nodesById.values()],
    relationships: [...collector.relationshipsByIdentity.values()],
    clearOutbound: [
      { label: "PHPClass", ids: [...collector.definedClassIds] },
      { label: "PHPMethod", ids: [...collector.definedMethodIds] }
    ]
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
    const definedIds = fact.kind === "method" ? collector.definedMethodIds : collector.definedClassIds;
    definedIds.add(fact.symbolId);
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

function symbolLabel(kind: string): string {
  if (kind === "method") {
    return "PHPMethod";
  }

  return kind ? `PHPClass:${capitalize(kind)}` : "PHPClass";
}

function mapSymbolNode(fact: SymbolFact, file: string): GraphNodeRecord {
  return {
    label: symbolLabel(fact.kind),
    id: fact.symbolId,
    fields: {
      fqcn: fact.fqcn,
      ...(fact.defined ? { file } : {}),
      ...(fact.kind ? { kind: fact.kind } : {}),
      ...fact.properties
    }
  };
}

function referenceEndpointLabels(kind: string): { fromLabel: string; toLabel: string } {
  if (kind === "has_method") {
    return { fromLabel: "PHPClass", toLabel: "PHPMethod" };
  }

  if (kind === "param_type" || kind === "returns_type") {
    return { fromLabel: "PHPMethod", toLabel: "PHPClass" };
  }

  return { fromLabel: "PHPClass", toLabel: "PHPClass" };
}

function mapReferenceEdge(fact: ReferenceFact): GraphRelationshipRecord {
  const type = fact.kind.toUpperCase();
  const discriminator = fact.identityKey === undefined ? "" : `:${fact.identityKey}`;
  const identity = createHash("sha256")
    .update(`${fact.fromSymbolId}:${type}:${fact.toSymbolId}${discriminator}`)
    .digest("hex");
  const { fromLabel, toLabel } = referenceEndpointLabels(fact.kind);

  return {
    type,
    identity,
    fromLabel,
    fromId: fact.fromSymbolId,
    toLabel,
    toId: fact.toSymbolId,
    fields: fact.fields ?? {}
  };
}
