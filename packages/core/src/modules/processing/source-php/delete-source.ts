import type { Driver, Session } from "neo4j-driver";

export type SourceDeletionSummary = {
  deletedCount: number;
};

const deleteTransactionRows = 10000;

export async function deleteSourceByPaths(driver: Driver, paths: string[]): Promise<SourceDeletionSummary> {
  const normalizedPaths = paths.map(normalizePath).filter((path) => path !== "");

  if (normalizedPaths.length === 0) {
    return { deletedCount: 0 };
  }

  const session = driver.session();

  try {
    const deletedCount = await countMatchingSymbols(session, normalizedPaths);
    await deleteMatchingSymbols(session, normalizedPaths);

    return { deletedCount };
  } finally {
    await session.close();
  }
}

function normalizePath(path: string): string {
  return path.trim().replace(/\/+$/, "");
}

async function countMatchingSymbols(session: Session, paths: string[]): Promise<number> {
  const result = await session.run(
    `UNWIND $paths AS path
     MATCH (symbol:PHPClass|PHPMethod)
     WHERE symbol.file = path OR symbol.file STARTS WITH path + '/'
     RETURN count(DISTINCT symbol) AS deletedCount`,
    { paths }
  );

  return result.records[0]?.get("deletedCount").toNumber() ?? 0;
}

async function deleteMatchingSymbols(session: Session, paths: string[]): Promise<void> {
  await session.run(
    `UNWIND $paths AS path
     MATCH (symbol:PHPClass|PHPMethod)
     WHERE symbol.file = path OR symbol.file STARTS WITH path + '/'
     WITH DISTINCT symbol
     CALL { WITH symbol DETACH DELETE symbol } IN TRANSACTIONS OF ${deleteTransactionRows} ROWS`,
    { paths }
  );
}
