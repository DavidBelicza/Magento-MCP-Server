import { readdir, readFile, stat } from "node:fs/promises";

export type DirEntry = {
  parentPath: string;
  name: string;
  isFile: () => boolean;
};

export type FileSystemPort = {
  readFile: (path: string) => Promise<string>;
  readDirRecursive: (path: string) => Promise<DirEntry[]>;
  statIsFile: (path: string) => Promise<boolean>;
};

export const nodeFileSystem: FileSystemPort = {
  readFile: (path) => readFile(path, "utf8"),
  readDirRecursive: (path) => readdir(path, { recursive: true, withFileTypes: true }),
  statIsFile: async (path) => (await stat(path)).isFile()
};
