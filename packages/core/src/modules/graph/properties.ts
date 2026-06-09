import type { GraphFields, GraphFieldValue } from "./types.js";

export type StoredGraphPropertyValue = string | number | boolean | null | string[];

export type StoredGraphProperties = Record<string, StoredGraphPropertyValue>;

export function mapGraphFieldsToStoredProperties(fields: GraphFields): StoredGraphProperties {
  const properties: StoredGraphProperties = {};

  for (const [key, value] of Object.entries(fields)) {
    const mappedValue = mapGraphFieldValue(key, value);

    if (mappedValue !== undefined) {
      properties[mappedValue.key] = mappedValue.value;
    }
  }

  return properties;
}

function mapGraphFieldValue(
  key: string,
  value: GraphFieldValue
): { key: string; value: StoredGraphPropertyValue } | undefined {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return { key, value };
  }

  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return { key, value };
  }

  return {
    key: `${key}Json`,
    value: JSON.stringify(value)
  };
}
