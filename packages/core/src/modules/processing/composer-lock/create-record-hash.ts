import { createHash } from "node:crypto";

export function createNodeHash(input: unknown): string {
  return createGraphRecordHash("node", input);
}

export function createEdgeHash(input: unknown): string {
  return createGraphRecordHash("edge", input);
}

function createGraphRecordHash(recordType: string, input: unknown): string {
  return createHash("sha256")
    .update(stableStringify({ recordType, input }))
    .digest("hex");
}

function stableStringify(input: unknown): string {
  return JSON.stringify(normalizeValue(input));
}

function normalizeValue(input: unknown): unknown {
  if (typeof input === "bigint") {
    return input.toString();
  }

  if (input === null || typeof input !== "object") {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map(normalizeValue);
  }

  if (input instanceof Date) {
    return input.toISOString();
  }

  const normalizedEntries = Object.entries(input)
    .filter(([, value]) => value !== undefined)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => [key, normalizeValue(value)]);

  return Object.fromEntries(normalizedEntries);
}
