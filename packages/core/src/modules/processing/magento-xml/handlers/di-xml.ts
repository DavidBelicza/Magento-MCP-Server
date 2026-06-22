import { createHash } from "node:crypto";
import type { GraphNodeRecord, GraphRelationshipRecord } from "../../../graph/types.js";
import { asArray, normalizeFqn } from "../parse-xml.js";
import type { MagentoArea } from "../discovery.js";
import type { MagentoXmlRecords, ParsedXml, XmlHandler } from "../types.js";

type EdgeSpec = {
  type: string;
  fromId: string;
  toId: string;
};

export const handleDiXml: XmlHandler = (relativePath, area, parsed) => {
  const config = (parsed.config ?? {}) as ParsedXml;
  const specs = [...preferenceSpecs(config), ...pluginSpecs(config)];

  return buildRecords(specs, area, relativePath);
};

function preferenceSpecs(config: ParsedXml): EdgeSpec[] {
  return asArray(config.preference as ParsedXml | ParsedXml[] | undefined)
    .map(toPreferenceSpec)
    .filter(isEdgeSpec);
}

function toPreferenceSpec(preference: ParsedXml): EdgeSpec | null {
  const fromId = normalizeFqn(preference["@_for"]);
  const toId = normalizeFqn(preference["@_type"]);

  if (fromId === "" || toId === "") {
    return null;
  }

  return { type: "PREFERENCE_FOR", fromId, toId };
}

function pluginSpecs(config: ParsedXml): EdgeSpec[] {
  return asArray(config.type as ParsedXml | ParsedXml[] | undefined)
    .flatMap(typePluginSpecs)
    .filter(isEdgeSpec);
}

function typePluginSpecs(type: ParsedXml): (EdgeSpec | null)[] {
  const toId = normalizeFqn(type["@_name"]);

  if (toId === "") {
    return [];
  }

  return asArray(type.plugin as ParsedXml | ParsedXml[] | undefined).map((plugin) => toPluginSpec(plugin, toId));
}

function toPluginSpec(plugin: ParsedXml, toId: string): EdgeSpec | null {
  const fromId = normalizeFqn(plugin["@_type"]);

  if (fromId === "") {
    return null;
  }

  return { type: "PLUGIN_FOR", fromId, toId };
}

function isEdgeSpec(spec: EdgeSpec | null): spec is EdgeSpec {
  return spec !== null;
}

function buildRecords(specs: EdgeSpec[], area: MagentoArea, sourceFile: string): MagentoXmlRecords {
  const nodesById = new Map<string, GraphNodeRecord>();
  const relationshipsByIdentity = new Map<string, GraphRelationshipRecord>();

  for (const spec of specs) {
    addAnchor(nodesById, spec.fromId);
    addAnchor(nodesById, spec.toId);
    const edge = toEdge(spec, area, sourceFile);
    relationshipsByIdentity.set(edge.identity, edge);
  }

  return {
    nodes: [...nodesById.values()],
    relationships: [...relationshipsByIdentity.values()]
  };
}

function addAnchor(nodesById: Map<string, GraphNodeRecord>, id: string): void {
  if (!nodesById.has(id)) {
    nodesById.set(id, { label: "Symbol:PHP", id, fields: { fqcn: id } });
  }
}

function toEdge(spec: EdgeSpec, area: MagentoArea, sourceFile: string): GraphRelationshipRecord {
  const identity = createHash("sha256")
    .update(`${spec.fromId}:${spec.type}:${spec.toId}:${area}:${sourceFile}`)
    .digest("hex");

  return {
    type: spec.type,
    identity,
    fromLabel: "Symbol",
    fromId: spec.fromId,
    toLabel: "Symbol",
    toId: spec.toId,
    fields: { area, sourceFile }
  };
}
