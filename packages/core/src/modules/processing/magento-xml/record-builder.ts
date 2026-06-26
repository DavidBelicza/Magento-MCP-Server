import { createHash } from "node:crypto";
import type { GraphFieldValue, GraphNodeRecord, GraphRelationshipRecord } from "../../graph/types.js";
import type { MagentoArea } from "./discovery.js";
import type { MagentoXmlRecords } from "./types.js";

export type RecordBuilder = {
  anchor: (id: string, label: string) => void;
  addNode: (node: GraphNodeRecord) => void;
  addEdge: (
    type: string,
    fromId: string,
    fromLabel: string,
    toId: string,
    toLabel: string,
    discriminator: string,
    extraFields?: Record<string, GraphFieldValue>
  ) => void;
  build: () => MagentoXmlRecords;
};

export function createRecordBuilder(area: MagentoArea | null, sourceFile: string): RecordBuilder {
  const nodesById = new Map<string, GraphNodeRecord>();
  const edgesByIdentity = new Map<string, GraphRelationshipRecord>();

  return {
    anchor: (id, label) => {
      if (!nodesById.has(id)) {
        nodesById.set(id, { label, id, fields: { fqcn: id } });
      }
    },
    addNode: (node) => {
      nodesById.set(node.id, node);
    },
    addEdge: (type, fromId, fromLabel, toId, toLabel, discriminator, extraFields = {}) => {
      const identity = createHash("sha256")
        .update(`${fromId}:${type}:${toId}:${discriminator}:${area ?? ""}:${sourceFile}`)
        .digest("hex");

      edgesByIdentity.set(identity, {
        type,
        identity,
        fromLabel,
        fromId,
        toLabel,
        toId,
        fields: { ...(area ? { area } : {}), sourceFile, ...extraFields }
      });
    },
    build: () => ({
      nodes: [...nodesById.values()],
      relationships: [...edgesByIdentity.values()]
    })
  };
}
