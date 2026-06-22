import { posix } from "node:path";
import type { GraphNodeRecord, GraphRelationshipRecord } from "../../graph/types.js";
import { classifyConfigXml } from "./discovery.js";
import { nodeFileSystem, type FileSystemPort } from "./file-system.js";
import { parseXml } from "./parse-xml.js";
import { getXmlHandler } from "./registry.js";
import type { MagentoXmlRecords } from "./types.js";

export type ProcessedXml = {
  nodes: GraphNodeRecord[];
  relationships: GraphRelationshipRecord[];
  files: string[];
};

type ProcessedFile = {
  file: string;
  records: MagentoXmlRecords;
};

export async function processXmlFiles(
  mountPath: string,
  relativePaths: string[],
  fileSystem: FileSystemPort = nodeFileSystem
): Promise<ProcessedXml> {
  const nodesById = new Map<string, GraphNodeRecord>();
  const relationshipsByIdentity = new Map<string, GraphRelationshipRecord>();
  const files: string[] = [];

  for (const relativePath of relativePaths) {
    const processed = await processFile(fileSystem, mountPath, relativePath);

    if (!processed) {
      continue;
    }

    files.push(processed.file);
    mergeNodes(nodesById, processed.records.nodes);
    mergeRelationships(relationshipsByIdentity, processed.records.relationships);
  }

  return {
    nodes: [...nodesById.values()],
    relationships: [...relationshipsByIdentity.values()],
    files
  };
}

async function processFile(
  fileSystem: FileSystemPort,
  mountPath: string,
  relativePath: string
): Promise<ProcessedFile | null> {
  const classification = classifyConfigXml(relativePath);

  if (!classification) {
    return null;
  }

  const content = await readContent(fileSystem, posix.join(mountPath, relativePath));

  if (content === null) {
    return null;
  }

  const handler = getXmlHandler(classification.basename);

  return {
    file: relativePath,
    records: handler(relativePath, classification.area, parseXml(content))
  };
}

function mergeNodes(nodesById: Map<string, GraphNodeRecord>, nodes: GraphNodeRecord[]): void {
  for (const node of nodes) {
    const existing = nodesById.get(node.id);

    if (!existing || isAnchorNode(existing)) {
      nodesById.set(node.id, node);
    }
  }
}

function isAnchorNode(node: GraphNodeRecord): boolean {
  return node.label === "Symbol:PHP";
}

function mergeRelationships(
  relationshipsByIdentity: Map<string, GraphRelationshipRecord>,
  relationships: GraphRelationshipRecord[]
): void {
  for (const relationship of relationships) {
    relationshipsByIdentity.set(relationship.identity, relationship);
  }
}

async function readContent(fileSystem: FileSystemPort, path: string): Promise<string | null> {
  try {
    return await fileSystem.readFile(path);
  } catch {
    return null;
  }
}
