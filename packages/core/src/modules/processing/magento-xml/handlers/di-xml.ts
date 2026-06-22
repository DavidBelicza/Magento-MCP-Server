import { createHash } from "node:crypto";
import type { GraphFieldValue, GraphNodeRecord, GraphRelationshipRecord } from "../../../graph/types.js";
import { asArray, normalizeFqn } from "../parse-xml.js";
import type { MagentoArea } from "../discovery.js";
import type { ParsedXml, XmlHandler } from "../types.js";

const virtualTypeLabel = "Symbol:XML:VirtualType";
const anchorLabel = "Symbol:PHP";

type Collector = {
  nodesById: Map<string, GraphNodeRecord>;
  edgesByIdentity: Map<string, GraphRelationshipRecord>;
  area: MagentoArea;
  sourceFile: string;
};

type Injection = {
  toId: string;
  name: string;
  isArray: boolean;
  slot: string;
};

export const handleDiXml: XmlHandler = (relativePath, area, parsed) => {
  const config = (parsed.config ?? {}) as ParsedXml;
  const collector: Collector = {
    nodesById: new Map(),
    edgesByIdentity: new Map(),
    area,
    sourceFile: relativePath
  };

  for (const preference of asArray(config.preference as ParsedXml | ParsedXml[] | undefined)) {
    collectPreference(collector, preference);
  }

  for (const type of asArray(config.type as ParsedXml | ParsedXml[] | undefined)) {
    collectType(collector, type);
  }

  for (const virtualType of asArray(config.virtualType as ParsedXml | ParsedXml[] | undefined)) {
    collectVirtualType(collector, virtualType);
  }

  return {
    nodes: [...collector.nodesById.values()],
    relationships: [...collector.edgesByIdentity.values()]
  };
};

function collectPreference(collector: Collector, preference: ParsedXml): void {
  const fromId = normalizeFqn(preference["@_for"]);
  const toId = normalizeFqn(preference["@_type"]);

  if (fromId === "" || toId === "") {
    return;
  }

  anchor(collector, fromId);
  anchor(collector, toId);
  addEdge(collector, "PREFERENCE_FOR", fromId, toId, "");
}

function collectType(collector: Collector, type: ParsedXml): void {
  const typeName = normalizeFqn(type["@_name"]);

  if (typeName === "") {
    return;
  }

  collectPlugins(collector, type, typeName);
  collectInjections(collector, type, typeName);
}

function collectPlugins(collector: Collector, type: ParsedXml, targetId: string): void {
  for (const plugin of asArray(type.plugin as ParsedXml | ParsedXml[] | undefined)) {
    const pluginClass = normalizeFqn(plugin["@_type"]);

    if (pluginClass === "") {
      continue;
    }

    anchor(collector, pluginClass);
    anchor(collector, targetId);
    addEdge(collector, "PLUGIN_FOR", pluginClass, targetId, "");
  }
}

function collectVirtualType(collector: Collector, virtualType: ParsedXml): void {
  const id = normalizeFqn(virtualType["@_name"]);
  const base = normalizeFqn(virtualType["@_type"]);

  if (id === "") {
    return;
  }

  collector.nodesById.set(id, {
    label: virtualTypeLabel,
    id,
    fields: { name: id, kind: "virtualType", sourceFile: collector.sourceFile }
  });

  if (base !== "") {
    anchor(collector, base);
    addEdge(collector, "EXTENDS", id, base, "");
  }

  collectInjections(collector, virtualType, id);
}

function collectInjections(collector: Collector, owner: ParsedXml, fromId: string): void {
  const args = owner.arguments as ParsedXml | undefined;

  for (const injection of injectionsOf(args)) {
    anchor(collector, fromId);
    anchor(collector, injection.toId);
    addEdge(collector, "INJECTS", fromId, injection.toId, injection.slot, {
      name: injection.name,
      is_array: injection.isArray
    });
  }
}

function injectionsOf(args: ParsedXml | undefined): Injection[] {
  return asArray(args?.argument as ParsedXml | ParsedXml[] | undefined).flatMap(argumentInjections);
}

function argumentInjections(argument: ParsedXml): Injection[] {
  const name = stringValue(argument["@_name"]);

  return valueInjections(argument, name, name, false);
}

function valueInjections(node: ParsedXml, name: string, slot: string, isArray: boolean): Injection[] {
  const xsiType = stringValue(node["@_xsi:type"]);

  if (xsiType === "object") {
    const toId = normalizeFqn(node["#text"]);

    return toId === "" ? [] : [{ toId, name, isArray, slot }];
  }

  if (xsiType === "array") {
    return asArray(node.item as ParsedXml | ParsedXml[] | undefined).flatMap((item, index) =>
      valueInjections(item, name, `${slot}#${itemKey(item, index)}`, true)
    );
  }

  return [];
}

function itemKey(item: ParsedXml, index: number): string {
  const key = stringValue(item["@_name"]);

  return key === "" ? String(index) : key;
}

function anchor(collector: Collector, id: string): void {
  if (!collector.nodesById.has(id)) {
    collector.nodesById.set(id, { label: anchorLabel, id, fields: { fqcn: id } });
  }
}

function addEdge(
  collector: Collector,
  type: string,
  fromId: string,
  toId: string,
  discriminator: string,
  extraFields: Record<string, GraphFieldValue> = {}
): void {
  const identity = createHash("sha256")
    .update(`${fromId}:${type}:${toId}:${discriminator}:${collector.area}:${collector.sourceFile}`)
    .digest("hex");

  collector.edgesByIdentity.set(identity, {
    type,
    identity,
    fromLabel: "Symbol",
    fromId,
    toLabel: "Symbol",
    toId,
    fields: { area: collector.area, sourceFile: collector.sourceFile, ...extraFields }
  });
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
