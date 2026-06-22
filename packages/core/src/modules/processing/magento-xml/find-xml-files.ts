import { readdir, stat } from "node:fs/promises";
import { posix } from "node:path";
import { classifyConfigXml } from "./discovery.js";

export async function findConfigXmlFiles(mountPath: string, entries: string[]): Promise<string[]> {
  const found = new Set<string>();

  for (const entry of entries) {
    const relativeEntry = normalizeRelative(entry);
    const absoluteEntry = posix.join(mountPath, relativeEntry);

    if (await isFile(absoluteEntry)) {
      if (classifyConfigXml(relativeEntry)) {
        found.add(relativeEntry);
      }

      continue;
    }

    await collectFromDirectory(mountPath, absoluteEntry, found);
  }

  return [...found];
}

async function collectFromDirectory(mountPath: string, directory: string, found: Set<string>): Promise<void> {
  let dirents;

  try {
    dirents = await readdir(directory, { recursive: true, withFileTypes: true });
  } catch {
    return;
  }

  for (const dirent of dirents) {
    if (!dirent.isFile()) {
      continue;
    }

    const absolutePath = posix.join(dirent.parentPath, dirent.name);
    const relativePath = toRelative(mountPath, absolutePath);

    if (classifyConfigXml(relativePath)) {
      found.add(relativePath);
    }
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function normalizeRelative(entry: string): string {
  return entry.replace(/^\.\/?/, "").replace(/^\/+/, "").replace(/\/+$/, "");
}

function toRelative(mountPath: string, absolutePath: string): string {
  return absolutePath.startsWith(mountPath)
    ? absolutePath.slice(mountPath.length).replace(/^\/+/, "")
    : absolutePath;
}
