import { XMLParser } from "fast-xml-parser";
import type { ParsedXml } from "./types.js";

const forcedArrayTags = new Set([
  "preference",
  "type",
  "plugin",
  "virtualType",
  "argument",
  "item",
  "event",
  "observer",
  "group",
  "job"
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (tagName) => forcedArrayTags.has(tagName)
});

export function parseXml(content: string): ParsedXml {
  return parser.parse(content) as ParsedXml;
}

export function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

export function normalizeFqn(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/^\\+/, "") : "";
}

export function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
