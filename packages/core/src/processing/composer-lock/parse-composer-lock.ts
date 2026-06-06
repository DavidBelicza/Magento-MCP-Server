import { join } from "node:path";
import { buildComposerLockRecords } from "./build-records.js";
import { readComposerLock } from "./read-composer-lock.js";
import type { ComposerParsingResult } from "./types.js";

export type {
  ComposerEdgeRecord,
  ComposerGraphRecords,
  ComposerNodeRecord,
  ComposerParsingResult,
  ComposerProcessingProgress,
  ComposerProcessingProgressPhase,
  ComposerRelationshipType,
  ComposerWriteSummary
} from "./types.js";

export async function parseComposerLock(analyzedSourcePath: string): Promise<ComposerParsingResult> {
  const composerLockPath = join(analyzedSourcePath, "composer.lock");
  const composerLock = await readComposerLock(composerLockPath);
  const records = buildComposerLockRecords(composerLock);
  const packageCount = records.packageNodes.size;
  const authorCount = records.authorNodes.size;
  const edgeCount = records.edges.size;

  return {
    composerLockPath,
    packageCount,
    authorCount,
    edgeCount,
    totalCount: packageCount + authorCount + edgeCount,
    records
  };
}
