import { createHash } from "node:crypto";
import type { GraphFieldValue, GraphNodeRecord, GraphRelationshipRecord } from "../../graph/types.js";
import type { MagentoArea } from "./discovery.js";
import type { MagentoXmlRecords } from "./types.js";

const anchorLabel = "Symbol:PHP";

export type RecordBuilder = {
  anchor: (id: string) => void;
  addNode: (node: GraphNodeRecord) => void;
  addEdge: (
    type: string,
    fromId: string,
    toId: string,
    discriminator: string,
    extraFields?: Record<string, GraphFieldValue>
  ) => void;
  build: () => MagentoXmlRecords;
};

export function createRecordBuilder(area: MagentoArea, sourceFile: string): RecordBuilder {
  const nodesById = new Map<string, GraphNodeRecord>();
  const edgesByIdentity = new Map<string, GraphRelationshipRecord>();

  return {
    anchor: (id) => {
      if (!nodesById.has(id)) {
        nodesById.set(id, { label: anchorLabel, id, fields: { fqcn: id } });
      }
    },
    addNode: (node) => {
      nodesById.set(node.id, node);
    },
    addEdge: (type, fromId, toId, discriminator, extraFields = {}) => {
      const identity = createHash("sha256")
        .update(`${fromId}:${type}:${toId}:${discriminator}:${area}:${sourceFile}`)
        .digest("hex");

      edgesByIdentity.set(identity, {
        type,
        identity,
        fromLabel: "Symbol",
        fromId,
        toLabel: "Symbol",
        toId,
        fields: { area, sourceFile, ...extraFields }
      });
    },
    build: () => ({
      nodes: [...nodesById.values()],
      relationships: [...edgesByIdentity.values()]
    })
  };
}
