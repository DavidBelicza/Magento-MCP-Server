import type { Session } from "neo4j-driver";
import { writeGraphUpsert } from "../../graph/upsert.js";
import { mapFactBatch } from "./map-records.js";
import type { FileFacts } from "./types.js";

export type SaveSourceBatchCounts = {
  nodes: number;
  relationships: number;
};

export async function saveSourceBatch(
  session: Session,
  batch: FileFacts[],
  batchSize: number
): Promise<SaveSourceBatchCounts> {
  const { nodes, relationships, clearOutboundFromNodeIds } = mapFactBatch(batch);

  if (nodes.length === 0 && relationships.length === 0) {
    return { nodes: 0, relationships: 0 };
  }

  const labels = [...new Set(nodes.map((node) => node.label))];
  const relationshipTypes = [...new Set(relationships.map((relationship) => relationship.type))];

  console.log(`Saving batch: ${batch.length} files, ${nodes.length} nodes, ${relationships.length} relationships`);

  await writeGraphUpsert(session, nodes, relationships, {
    labels,
    relationshipTypes,
    clearOutboundFromNodeIds,
    clearNodeLabel: "Symbol",
    batchSize
  });

  return { nodes: nodes.length, relationships: relationships.length };
}
