import type { ManagedTransaction, Session } from "neo4j-driver";
import { mapGraphFieldsToStoredProperties } from "./properties.js";
import type { GraphNodeRecord, GraphRelationshipRecord, GraphWriteProgress, GraphWriteSummary } from "./types.js";

export type WriteGraphUpsertOptions = {
  labels: string[];
  relationshipTypes: string[];
  clearOutboundFromNodeIds?: string[];
  clearNodeLabel?: string;
  batchSize?: number;
  onProgress?: (progress: GraphWriteProgress) => Promise<void>;
  getClearingPhase?: () => string;
  getNodeWritingPhase?: (label: string) => string;
  getRelationshipWritingPhase?: (type: string) => string;
  getCompletedPhase?: () => string;
};

type ProgressState = {
  processed: number;
  total: number;
  onProgress?: (progress: GraphWriteProgress) => Promise<void>;
};

const defaultBatchSize = 200;

export async function writeGraphUpsert(
  session: Session,
  nodes: GraphNodeRecord[],
  relationships: GraphRelationshipRecord[],
  options: WriteGraphUpsertOptions
): Promise<GraphWriteSummary> {
  const labels = unique(options.labels);
  const relationshipTypes = unique(options.relationshipTypes);
  const batchSize = options.batchSize ?? defaultBatchSize;
  const progress: ProgressState = {
    processed: 0,
    total: nodes.length + relationships.length,
    onProgress: options.onProgress
  };

  validateGraphTokens([...labels, ...relationshipTypes, ...(options.clearNodeLabel ? [options.clearNodeLabel] : [])]);

  if (options.clearOutboundFromNodeIds && options.clearOutboundFromNodeIds.length > 0) {
    await reportProgress(progress, options.getClearingPhase?.() ?? "clearing-graph");
    await session.executeWrite(async (tx) => {
      await clearOutboundRelationships(tx, options.clearOutboundFromNodeIds!, options.clearNodeLabel);
    });
  }

  for (const label of labels) {
    const labelNodes = nodes.filter((node) => node.label === label);
    await writeNodes(session, label, labelNodes, batchSize, progress, options);
  }

  for (const relationshipType of relationshipTypes) {
    const typeRelationships = relationships.filter((relationship) => relationship.type === relationshipType);
    await writeRelationships(session, relationshipType, typeRelationships, batchSize, progress, options);
  }

  await reportProgress(progress, options.getCompletedPhase?.() ?? "completed");

  return {
    nodeCount: nodes.length,
    relationshipCount: relationships.length,
    totalCount: progress.total
  };
}

async function clearOutboundRelationships(tx: ManagedTransaction, nodeIds: string[], nodeLabel?: string): Promise<void> {
  const nodePattern = nodeLabel ? `(node:${nodeLabel} {id: id})` : "(node {id: id})";

  for (const batch of chunk(nodeIds, 200)) {
    await tx.run(
      `UNWIND $nodeIds AS id
       MATCH ${nodePattern}-[relationship]->()
       DELETE relationship`,
      { nodeIds: batch }
    );
  }
}

async function writeNodes(
  session: Session,
  label: string,
  nodes: GraphNodeRecord[],
  batchSize: number,
  progress: ProgressState,
  options: WriteGraphUpsertOptions
): Promise<void> {
  for (const batch of chunk(nodes, batchSize)) {
    const rows = batch.map((node) => ({
      id: node.id,
      properties: mapGraphFieldsToStoredProperties(node.fields)
    }));

    await session.executeWrite(async (tx) => {
      await tx.run(
        `UNWIND $rows AS row
         ${mergeNodeClause(label)}
         SET node += row.properties`,
        { rows }
      );
    });

    progress.processed += batch.length;
    await reportProgress(progress, options.getNodeWritingPhase?.(label) ?? "writing-nodes");
  }
}

async function writeRelationships(
  session: Session,
  relationshipType: string,
  relationships: GraphRelationshipRecord[],
  batchSize: number,
  progress: ProgressState,
  options: WriteGraphUpsertOptions
): Promise<void> {
  for (const batch of chunk(relationships, batchSize)) {
    const rows = batch.map((relationship) => ({
      identity: relationship.identity,
      fromLabel: relationship.fromLabel,
      fromId: relationship.fromId,
      toLabel: relationship.toLabel,
      toId: relationship.toId,
      properties: mapGraphFieldsToStoredProperties({
        ...relationship.fields,
        identity: relationship.identity
      })
    }));

    await session.executeWrite(async (tx) => {
      for (const groupedRows of groupRelationshipRows(rows)) {
        await tx.run(createRelationshipQuery(relationshipType, groupedRows.fromLabel, groupedRows.toLabel), {
          rows: groupedRows.rows
        });
      }
    });

    progress.processed += batch.length;
    await reportProgress(progress, options.getRelationshipWritingPhase?.(relationshipType) ?? "writing-relationships");
  }
}

function mergeNodeClause(label: string): string {
  const [baseLabel, ...extraLabels] = label.split(":");
  const merge = `MERGE (node:${baseLabel} {id: row.id})`;

  return extraLabels.length > 0 ? `${merge}\n         SET node:${extraLabels.join(":")}` : merge;
}

function createRelationshipQuery(relationshipType: string, fromLabel: string, toLabel: string): string {
  return `UNWIND $rows AS row
    MATCH (fromNode:${fromLabel} {id: row.fromId})
    MATCH (toNode:${toLabel} {id: row.toId})
    MERGE (fromNode)-[relationship:${relationshipType} {identity: row.identity}]->(toNode)
    SET relationship += row.properties`;
}

function groupRelationshipRows<T extends { fromLabel: string; toLabel: string }>(
  rows: T[]
): Array<{ fromLabel: string; toLabel: string; rows: T[] }> {
  const groupedRows = new Map<string, { fromLabel: string; toLabel: string; rows: T[] }>();

  for (const row of rows) {
    const key = `${row.fromLabel}->${row.toLabel}`;
    const group = groupedRows.get(key);

    if (group) {
      group.rows.push(row);
    } else {
      groupedRows.set(key, {
        fromLabel: row.fromLabel,
        toLabel: row.toLabel,
        rows: [row]
      });
    }
  }

  return [...groupedRows.values()];
}

async function reportProgress(progress: ProgressState, phase: string): Promise<void> {
  await progress.onProgress?.({
    phase,
    processed: progress.processed,
    total: progress.total,
    percent: progress.total === 0 ? 100 : Math.round((progress.processed / progress.total) * 100)
  });
}

function validateGraphTokens(tokens: string[]): void {
  for (const token of tokens) {
    if (!/^[A-Za-z_][A-Za-z0-9_:]*$/.test(token)) {
      throw new Error(`Invalid graph token: ${token}`);
    }
  }
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}
