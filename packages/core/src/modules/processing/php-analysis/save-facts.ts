import type { Driver } from "neo4j-driver";
import { createHash } from "node:crypto";
import { writeGraphUpsert } from "../../graph/upsert.js";
import type { GraphNodeRecord, GraphRelationshipRecord } from "../../graph/types.js";
import type { FileFacts, ReferenceFact, SymbolFact } from "./types.js";

export async function savePhpAnalysisFacts(driver: Driver, fileFacts: FileFacts, batchSize: number): Promise<void> {
  const symbols = fileFacts.facts.filter((f): f is SymbolFact => f.fact === "symbol");
  const references = fileFacts.facts.filter((f): f is ReferenceFact => f.fact === "reference");

  const nodes: GraphNodeRecord[] = symbols.map(mapSymbolNodeRecord).map(node => ({
    ...node,
    fields: { ...node.fields, file: fileFacts.file }
  }));

  const relationships: GraphRelationshipRecord[] = references.map(mapReferenceEdgeRecord);
  if (relationships.length > 0) {
    console.log(`Saving ${relationships.length} relationships of types ${[...new Set(relationships.map(r => r.type))]} for file ${fileFacts.file}`);
  }

  const clearOutboundFromNodeIds = symbols.map((s) => s.symbolId);
  const relationshipTypes = [...new Set(relationships.map((r) => r.type))];
  const labels = ["Symbol", ...new Set(symbols.map(s => `Symbol:PHP:${capitalize(s.kind)}`))];

  await writeGraphUpsert(driver, nodes, relationships, {
    labels,
    relationshipTypes,
    clearOutboundFromNodeIds,
    batchSize
  });
}

function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function mapSymbolNodeRecord(fact: SymbolFact): GraphNodeRecord {
  return {
    label: `Symbol:PHP:${capitalize(fact.kind)}`,
    id: fact.symbolId,
    fields: {
      fqcn: fact.fqcn,
      kind: fact.kind
    }
  };
}

function mapReferenceEdgeRecord(fact: ReferenceFact): GraphRelationshipRecord {
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
