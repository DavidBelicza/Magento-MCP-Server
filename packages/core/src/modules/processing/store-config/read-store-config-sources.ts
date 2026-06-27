import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { StoreConfigSource, StoreConfigSourceKind } from "./types.js";

const systemXmlPath = "etc/adminhtml/system.xml";
const systemDirPath = "etc/adminhtml/system/";

function classifyStoreConfigPath(relativePath: string): StoreConfigSourceKind | null {
  const normalized = relativePath.split("\\").join("/");

  if (normalized.endsWith(systemXmlPath)) {
    return "system";
  }

  if (normalized.includes(systemDirPath) && normalized.endsWith(".xml")) {
    return "include";
  }

  return null;
}

export async function readStoreConfigSources(rootPath: string): Promise<StoreConfigSource[]> {
  const entries = await readdir(rootPath, { recursive: true, withFileTypes: true });
  const sources: StoreConfigSource[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".xml")) {
      continue;
    }

    const fullPath = join(entry.parentPath, entry.name);
    const relativePath = relative(rootPath, fullPath);
    const kind = classifyStoreConfigPath(relativePath);

    if (!kind) {
      continue;
    }

    sources.push({
      kind,
      fileName: entry.name,
      sourceFile: relativePath,
      content: await readFile(fullPath, "utf8")
    });
  }

  return sources;
}
