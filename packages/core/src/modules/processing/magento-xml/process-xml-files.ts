import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import type { GraphNodeRecord, GraphRelationshipRecord } from "../../graph/types.js";
import { classifyConfigXml } from "./discovery.js";
import { parseXml } from "./parse-xml.js";
import { getXmlHandler } from "./registry.js";

export type ProcessedXml = {
  nodes: GraphNodeRecord[];
  relationships: GraphRelationshipRecord[];
  files: string[];
};

export async function processXmlFiles(mountPath: string, relativePaths: string[]): Promise<ProcessedXml> {
  const nodesById = new Map<string, GraphNodeRecord>();
  const relationshipsByIdentity = new Map<string, GraphRelationshipRecord>();
  const files: string[] = [];

  for (const relativePath of relativePaths) {
    const classification = classifyConfigXml(relativePath);

    if (!classification) {
      continue;
    }

    const content = await readContent(posix.join(mountPath, relativePath));

    if (content === null) {
      continue;
    }

    files.push(relativePath);
    const handler = getXmlHandler(classification.basename);
    const records = handler(relativePath, classification.area, parseXml(content));

    for (const node of records.nodes) {
      if (!nodesById.has(node.id)) {
        nodesById.set(node.id, node);
      }
    }

    for (const relationship of records.relationships) {
      relationshipsByIdentity.set(relationship.identity, relationship);
    }
  }

  return {
    nodes: [...nodesById.values()],
    relationships: [...relationshipsByIdentity.values()],
    files
  };
}

async function readContent(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}
