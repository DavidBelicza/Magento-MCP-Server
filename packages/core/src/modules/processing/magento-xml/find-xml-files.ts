import { posix } from "node:path";
import { classifyConfigXml } from "./discovery.js";
import { nodeFileSystem, type FileSystemPort } from "./file-system.js";

export async function findConfigXmlFiles(
  mountPath: string,
  entries: string[],
  fileSystem: FileSystemPort = nodeFileSystem
): Promise<string[]> {
  const found = new Set<string>();

  for (const entry of entries) {
    await collectEntry(fileSystem, mountPath, entry, found);
  }

  return [...found];
}

async function collectEntry(
  fileSystem: FileSystemPort,
  mountPath: string,
  entry: string,
  found: Set<string>
): Promise<void> {
  const relativeEntry = normalizeRelative(entry);
  const absoluteEntry = posix.join(mountPath, relativeEntry);

  if (await isFile(fileSystem, absoluteEntry)) {
    addIfConfigXml(found, relativeEntry);

    return;
  }

  await collectFromDirectory(fileSystem, mountPath, absoluteEntry, found);
}

async function collectFromDirectory(
  fileSystem: FileSystemPort,
  mountPath: string,
  directory: string,
  found: Set<string>
): Promise<void> {
  const matches = (await readDirectory(fileSystem, directory))
    .filter((dirent) => dirent.isFile())
    .map((dirent) => toRelative(mountPath, posix.join(dirent.parentPath, dirent.name)));

  for (const relativePath of matches) {
    addIfConfigXml(found, relativePath);
  }
}

function addIfConfigXml(found: Set<string>, relativePath: string): void {
  if (classifyConfigXml(relativePath)) {
    found.add(relativePath);
  }
}

async function readDirectory(fileSystem: FileSystemPort, directory: string): Promise<Awaited<ReturnType<FileSystemPort["readDirRecursive"]>>> {
  try {
    return await fileSystem.readDirRecursive(directory);
  } catch {
    return [];
  }
}

async function isFile(fileSystem: FileSystemPort, path: string): Promise<boolean> {
  try {
    return await fileSystem.statIsFile(path);
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
