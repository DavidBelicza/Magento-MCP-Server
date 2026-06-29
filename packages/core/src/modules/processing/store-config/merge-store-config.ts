import { XMLParser } from "fast-xml-parser";
import type { ParsedXml, StoreConfig, StoreConfigNode, StoreConfigSource } from "./types.js";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_"
});

type MergeState = {
  tabs: Record<string, string>;
  sections: Record<string, StoreConfigNode>;
  includeFragments: Record<string, ParsedXml>;
};

export function mergeStoreConfig(sources: StoreConfigSource[]): StoreConfig {
  const state: MergeState = { tabs: {}, sections: {}, includeFragments: {} };

  const includeSources = sources.filter((source) => source.kind === "include");
  const systemSources = sources.filter((source) => source.kind === "system");
  const sectionFragments: Array<{ parsed: ParsedXml; sourceFile: string }> = [];

  for (const source of includeSources) {
    const parsed = parseStoreConfigXml(source.content);
    const include = asParsed(parsed.include);

    if (include && include.section !== undefined) {
      sectionFragments.push({ parsed, sourceFile: source.sourceFile });
      continue;
    }

    state.includeFragments[source.fileName] = parsed;
  }

  for (const fragment of sectionFragments) {
    const include = asParsed(fragment.parsed.include);

    if (!include) {
      continue;
    }

    buildTabMap(state, include.tab);
    buildNodes(state, state.sections, include.section, fragment.sourceFile);
  }

  for (const source of systemSources) {
    const parsed = parseStoreConfigXml(source.content);
    const system = asParsed(asParsed(parsed.config)?.system);

    if (!system) {
      continue;
    }

    buildTabMap(state, system.tab);
    buildNodes(state, state.sections, system.section, source.sourceFile);
  }

  return { tabs: state.tabs, sections: state.sections };
}

function buildTabMap(state: MergeState, items: unknown): void {
  for (const raw of asArray(items as ParsedXml | ParsedXml[] | undefined)) {
    const tab = asParsed(raw);
    const id = plainText(tab?.["@_id"]);
    const label = cleanUpText(tab?.label);

    if (!id || !label) {
      continue;
    }

    state.tabs[id] = label;
  }
}

function buildNodes(
  state: MergeState,
  target: Record<string, StoreConfigNode>,
  items: unknown,
  sourceFile: string
): void {
  for (const raw of asArray(items as ParsedXml | ParsedXml[] | undefined)) {
    const item = asParsed(raw);
    const id = plainText(item?.["@_id"]);

    if (!item || !id) {
      continue;
    }

    const node = ensureNode(target, id, sourceFile);

    applyText(node, "tab", cleanUpText(item.tab));
    applyText(node, "label", cleanUpText(item.label));
    applyText(node, "comment", cleanUpText(item.comment));
    applyText(node, "configPath", plainText(item.config_path));

    if (item.group !== undefined) {
      buildNodes(state, node.children, item.group, sourceFile);
    }

    if (item.field !== undefined) {
      buildNodes(state, node.children, item.field, sourceFile);
    }

    if (item.include !== undefined) {
      resolveIncludes(state, node.children, item.include, sourceFile);
    }
  }
}

function resolveIncludes(
  state: MergeState,
  target: Record<string, StoreConfigNode>,
  include: unknown,
  sourceFile: string
): void {
  for (const raw of asArray(include as ParsedXml | ParsedXml[] | undefined)) {
    const inclusion = asParsed(raw);
    const pathAttribute = plainText(inclusion?.["@_path"]);

    if (!pathAttribute) {
      continue;
    }

    const relativePath = pathAttribute.split("::")[1] ?? pathAttribute;
    const fragment = asParsed(state.includeFragments[baseName(relativePath)]);
    const fragmentInclude = asParsed(fragment?.include);

    if (fragmentInclude?.group !== undefined) {
      buildNodes(state, target, fragmentInclude.group, sourceFile);
    }
  }
}

function ensureNode(
  target: Record<string, StoreConfigNode>,
  id: string,
  sourceFile: string
): StoreConfigNode {
  const existing = target[id];

  if (existing) {
    return existing;
  }

  const node: StoreConfigNode = {
    tab: null,
    label: null,
    comment: null,
    configPath: null,
    sourceFile,
    children: {}
  };
  target[id] = node;

  return node;
}

function applyText(node: StoreConfigNode, key: "tab" | "label" | "comment" | "configPath", value: string | null): void {
  if (value !== null && node[key] === null) {
    node[key] = value;
  }
}

function asParsed(value: unknown): ParsedXml | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as ParsedXml) : undefined;
}

function parseStoreConfigXml(content: string): ParsedXml {
  return xmlParser.parse(content) as ParsedXml;
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function cleanUpText(rawText: unknown): string | null {
  if (typeof rawText !== "string") {
    return null;
  }

  const cleaned = rawText
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned === "" ? null : cleaned;
}

function plainText(rawText: unknown): string | null {
  return typeof rawText === "string" && rawText.trim() !== "" ? rawText.trim() : null;
}

function baseName(path: string): string {
  const segments = path.split("/").filter((segment) => segment !== "");

  return segments[segments.length - 1] ?? path;
}
