import { createHash } from "node:crypto";
import type { GraphNodeRecord, GraphRelationshipRecord } from "../../../graph/types.js";
import { asArray, normalizeFqn } from "../parse-xml.js";
import type { MagentoArea } from "../discovery.js";
import type { MagentoXmlRecords, ParsedXml, XmlHandler } from "../types.js";

type Collector = {
  nodesById: Map<string, GraphNodeRecord>;
  relationshipsByIdentity: Map<string, GraphRelationshipRecord>;
};

export const handleDiXml: XmlHandler = (relativePath, area, parsed) => {
  const collector: Collector = {
    nodesById: new Map(),
    relationshipsByIdentity: new Map()
  };

  const config = (parsed.config ?? {}) as ParsedXml;

  collectPreferences(config, area, relativePath, collector);
  collectPlugins(config, area, relativePath, collector);

  return toRecords(collector);
};

function collectPreferences(
  config: ParsedXml,
  area: MagentoArea,
  sourceFile: string,
  collector: Collector
): void {
  for (const preference of asArray(config.preference as ParsedXml | ParsedXml[] | undefined)) {
    const from = normalizeFqn(preference["@_for"]);
    const to = normalizeFqn(preference["@_type"]);

    if (from === "" || to === "") {
      continue;
    }

    addAnchor(collector, from);
    addAnchor(collector, to);
    addEdge(collector, "PREFERENCE_FOR", from, to, area, sourceFile);
  }
}

function collectPlugins(
  config: ParsedXml,
  area: MagentoArea,
  sourceFile: string,
  collector: Collector
): void {
  for (const type of asArray(config.type as ParsedXml | ParsedXml[] | undefined)) {
    const target = normalizeFqn(type["@_name"]);

    if (target === "") {
      continue;
    }

    for (const plugin of asArray(type.plugin as ParsedXml | ParsedXml[] | undefined)) {
      const pluginClass = normalizeFqn(plugin["@_type"]);

      if (pluginClass === "") {
        continue;
      }

      addAnchor(collector, pluginClass);
      addAnchor(collector, target);
      addEdge(collector, "PLUGIN_FOR", pluginClass, target, area, sourceFile);
    }
  }
}

function addAnchor(collector: Collector, id: string): void {
  if (!collector.nodesById.has(id)) {
    collector.nodesById.set(id, {
      label: "Symbol:PHP",
      id,
      fields: { fqcn: id }
    });
  }
}

function addEdge(
  collector: Collector,
  type: string,
  fromId: string,
  toId: string,
  area: MagentoArea,
  sourceFile: string
): void {
  const identity = createHash("sha256")
    .update(`${fromId}:${type}:${toId}:${area}:${sourceFile}`)
    .digest("hex");

  collector.relationshipsByIdentity.set(identity, {
    type,
    identity,
    fromLabel: "Symbol",
    fromId,
    toLabel: "Symbol",
    toId,
    fields: { area, sourceFile }
  });
}

function toRecords(collector: Collector): MagentoXmlRecords {
  return {
    nodes: [...collector.nodesById.values()],
    relationships: [...collector.relationshipsByIdentity.values()]
  };
}
