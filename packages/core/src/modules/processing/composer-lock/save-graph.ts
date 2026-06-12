import type { Driver } from "neo4j-driver";
import { writeGraphMergeSync } from "../../graph/merge-sync.js";
import type { GraphNodeRecord, GraphRelationshipRecord } from "../../graph/types.js";
import type {
  ComposerEdgeRecord,
  ComposerGraphRecords,
  ComposerNodeRecord,
  ComposerProcessingProgress,
  ComposerRelationshipType,
  ComposerWriteSummary
} from "./types.js";

type WriteComposerGraphOptions = {
  onProgress?: (progress: ComposerProcessingProgress) => Promise<void>;
};

const composerNodeLabels = ["Package", "Author"];

const composerRelationshipTypes: ComposerRelationshipType[] = [
  "PACKAGE_REQUIRES_PACKAGE",
  "PACKAGE_REQUIRES_DEV_PACKAGE",
  "PACKAGE_AUTHORED_BY",
  "PACKAGE_SUGGESTS_PACKAGE",
  "PACKAGE_REPLACES_PACKAGE",
  "PACKAGE_PROVIDES_PACKAGE",
  "PACKAGE_CONFLICTS_WITH_PACKAGE"
];

export async function saveComposerLockGraph(
  driver: Driver,
  records: ComposerGraphRecords,
  options: WriteComposerGraphOptions = {}
): Promise<ComposerWriteSummary> {
  const nodes = [
    ...[...records.packageNodes.values()].map(mapComposerNodeRecord),
    ...[...records.authorNodes.values()].map(mapComposerNodeRecord)
  ];
  const relationships = [...records.edges.values()].map(mapComposerEdgeRecord);
  const summary = await writeGraphMergeSync(driver, nodes, relationships, {
    labels: composerNodeLabels,
    relationshipTypes: composerRelationshipTypes,
    onProgress: options.onProgress
      ? (progress) =>
        options.onProgress?.({
          ...progress,
          phase: progress.phase as ComposerProcessingProgress["phase"]
        }) ?? Promise.resolve()
      : undefined,
    getNodeWritingPhase: (label) => (label === "Package" ? "writing-packages" : "writing-authors"),
    getRelationshipWritingPhase: () => "writing-relationships",
    getPruningPhase: () => "clearing-graph",
    getCompletedPhase: () => "completed"
  });

  return {
    packageCount: records.packageNodes.size,
    authorCount: records.authorNodes.size,
    edgeCount: summary.relationshipCount,
    totalCount: summary.totalCount
  };
}

function mapComposerNodeRecord(node: ComposerNodeRecord): GraphNodeRecord {
  return {
    label: node.table,
    id: node.id,
    fields: node.fields
  };
}

function mapComposerEdgeRecord(edge: ComposerEdgeRecord): GraphRelationshipRecord {
  return {
    type: edge.edgeTable,
    identity: edge.edgeIdentity,
    fromLabel: edge.fromNodeTable,
    fromId: edge.fromNodeId,
    toLabel: edge.toNodeTable,
    toId: edge.toNodeId,
    fields: edge.fields
  };
}
