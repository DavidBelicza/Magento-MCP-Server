import type { ConfigFieldDescription } from "./types.js";

export type StoredConfigRow = {
  description: unknown;
  model: unknown;
};

export type ConfigVectorDiff = {
  toUpsert: ConfigFieldDescription[];
  toDelete: string[];
};

export function computeConfigVectorDelta(
  descriptions: ConfigFieldDescription[],
  stored: Map<string, StoredConfigRow>,
  model: string
): ConfigVectorDiff {
  const nextPaths = new Set(descriptions.map((description) => description.path));

  const toUpsert = descriptions.filter((description) => {
    const current = stored.get(description.path);

    return !current || current.description !== description.description || current.model !== model;
  });

  const toDelete = [...stored.keys()].filter((path) => !nextPaths.has(path));

  return { toUpsert, toDelete };
}
