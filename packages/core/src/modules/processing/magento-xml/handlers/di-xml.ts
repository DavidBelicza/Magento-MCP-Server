import { asArray, normalizeFqn, stringValue } from "../parse-xml.js";
import { createRecordBuilder, type RecordBuilder } from "../record-builder.js";
import type { ParsedXml, XmlHandler } from "../types.js";

const virtualTypeLabel = "Symbol:XML:VirtualType";

type Injection = {
  toId: string;
  name: string;
  isArray: boolean;
  slot: string;
};

export const handleDiXml: XmlHandler = (relativePath, area, parsed) => {
  const config = (parsed.config ?? {}) as ParsedXml;
  const builder = createRecordBuilder(area, relativePath);

  for (const preference of asArray(config.preference as ParsedXml | ParsedXml[] | undefined)) {
    collectPreference(builder, preference);
  }

  for (const type of asArray(config.type as ParsedXml | ParsedXml[] | undefined)) {
    collectType(builder, type);
  }

  for (const virtualType of asArray(config.virtualType as ParsedXml | ParsedXml[] | undefined)) {
    collectVirtualType(builder, virtualType, relativePath);
  }

  return builder.build();
};

function collectPreference(builder: RecordBuilder, preference: ParsedXml): void {
  const fromId = normalizeFqn(preference["@_for"]);
  const toId = normalizeFqn(preference["@_type"]);

  if (fromId === "" || toId === "") {
    return;
  }

  builder.anchor(fromId);
  builder.anchor(toId);
  builder.addEdge("PREFERENCE_FOR", fromId, toId, "");
}

function collectType(builder: RecordBuilder, type: ParsedXml): void {
  const typeName = normalizeFqn(type["@_name"]);

  if (typeName === "") {
    return;
  }

  collectPlugins(builder, type, typeName);
  collectInjections(builder, type, typeName);
}

function collectPlugins(builder: RecordBuilder, type: ParsedXml, targetId: string): void {
  for (const plugin of asArray(type.plugin as ParsedXml | ParsedXml[] | undefined)) {
    const pluginClass = normalizeFqn(plugin["@_type"]);

    if (pluginClass === "") {
      continue;
    }

    builder.anchor(pluginClass);
    builder.anchor(targetId);
    builder.addEdge("PLUGIN_FOR", pluginClass, targetId, "");
  }
}

function collectVirtualType(builder: RecordBuilder, virtualType: ParsedXml, sourceFile: string): void {
  const id = normalizeFqn(virtualType["@_name"]);
  const base = normalizeFqn(virtualType["@_type"]);

  if (id === "") {
    return;
  }

  builder.addNode({
    label: virtualTypeLabel,
    id,
    fields: { name: id, kind: "virtualType", sourceFile }
  });

  if (base !== "") {
    builder.anchor(base);
    builder.addEdge("EXTENDS", id, base, "");
  }

  collectInjections(builder, virtualType, id);
}

function collectInjections(builder: RecordBuilder, owner: ParsedXml, fromId: string): void {
  const args = owner.arguments as ParsedXml | undefined;

  for (const injection of injectionsOf(args)) {
    builder.anchor(fromId);
    builder.anchor(injection.toId);
    builder.addEdge("INJECTS", fromId, injection.toId, injection.slot, {
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
