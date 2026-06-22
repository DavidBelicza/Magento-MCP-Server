import type { GraphNodeRecord, GraphRelationshipRecord } from "../../graph/types.js";
import type { MagentoArea } from "./discovery.js";

export type MagentoXmlRecords = {
  nodes: GraphNodeRecord[];
  relationships: GraphRelationshipRecord[];
};

export type XmlHandler = (
  relativePath: string,
  area: MagentoArea,
  parsed: ParsedXml
) => MagentoXmlRecords;

export type ParsedXml = Record<string, unknown>;

export const magentoXmlRelationshipTypes = ["PREFERENCE_FOR", "PLUGIN_FOR", "INJECTS", "EXTENDS"];
