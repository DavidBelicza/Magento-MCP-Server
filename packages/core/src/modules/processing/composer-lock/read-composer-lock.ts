import { readFile } from "node:fs/promises";
import type { ComposerLock, ComposerPackage } from "./types.js";

export async function readComposerLock(filePath: string): Promise<ComposerLock> {
  const fileContent = await readFile(filePath, "utf-8");
  const composerLock = JSON.parse(fileContent) as unknown;

  if (!isComposerLock(composerLock)) {
    throw new Error("composer.lock does not contain a valid Composer package list");
  }

  return composerLock;
}

function isComposerLock(input: unknown): input is ComposerLock {
  if (!isRecord(input)) {
    return false;
  }

  return isComposerPackageList(input.packages) && isComposerPackageList(input["packages-dev"]);
}

function isComposerPackageList(input: unknown): input is ComposerPackage[] | undefined {
  return input === undefined || (Array.isArray(input) && input.every(isComposerPackage));
}

function isComposerPackage(input: unknown): input is ComposerPackage {
  return isRecord(input) && typeof input.name === "string";
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === "object" && !Array.isArray(input);
}
