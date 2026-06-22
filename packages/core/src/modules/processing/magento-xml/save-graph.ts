import type { Driver, Session } from "neo4j-driver";
import { writeGraphUpsert } from "../../graph/upsert.js";
import type { GraphNodeRecord, GraphRelationshipRecord } from "../../graph/types.js";
import { magentoXmlRelationshipTypes } from "./types.js";

export type MagentoXmlWriteSummary = {
  nodeCount: number;
  relationshipCount: number;
};

export async function saveMagentoXmlGraph(
  driver: Driver,
  nodes: GraphNodeRecord[],
  relationships: GraphRelationshipRecord[],
  clearPaths: string[],
  batchSize: number
): Promise<MagentoXmlWriteSummary> {
  const session = driver.session();

  try {
    await clearEdgesByPaths(session, clearPaths);

    if (nodes.length === 0 && relationships.length === 0) {
      return { nodeCount: 0, relationshipCount: 0 };
    }

    const labels = [...new Set(nodes.map((node) => node.label))];
    const relationshipTypes = [...new Set(relationships.map((relationship) => relationship.type))];

    await writeGraphUpsert(session, nodes, relationships, {
      labels,
      relationshipTypes,
      batchSize
    });

    return { nodeCount: nodes.length, relationshipCount: relationships.length };
  } finally {
    await session.close();
  }
}

export async function deleteMagentoXmlByPaths(driver: Driver, paths: string[]): Promise<void> {
  const session = driver.session();

  try {
    await clearEdgesByPaths(session, paths);
  } finally {
    await session.close();
  }
}

async function clearEdgesByPaths(session: Session, paths: string[]): Promise<void> {
  const normalizedPaths = paths.map((path) => path.trim().replace(/\/+$/, "")).filter((path) => path !== "");

  if (normalizedPaths.length === 0) {
    return;
  }

  for (const relationshipType of magentoXmlRelationshipTypes) {
    await session.executeWrite(async (tx) => {
      await tx.run(
        `UNWIND $paths AS path
         MATCH ()-[relationship:${relationshipType}]->()
         WHERE relationship.sourceFile = path OR relationship.sourceFile STARTS WITH path + '/'
         DELETE relationship`,
        { paths: normalizedPaths }
      );
    });
  }
}
