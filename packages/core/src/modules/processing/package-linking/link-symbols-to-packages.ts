import type { Driver, Session } from "neo4j-driver";

export type SymbolLinkScope = { symbolId: string } | null;

export type SymbolLinkSummary = {
  linkedCount: number;
};

const declaredSymbolKinds = ["class", "interface", "trait", "enum"];
const linkTransactionRows = 10000;

export async function linkSymbolsToPackages(
  driver: Driver,
  scope: SymbolLinkScope = null
): Promise<SymbolLinkSummary> {
  const session = driver.session();

  try {
    await clearExistingLinks(session, scope);
    await buildLinks(session, scope);

    return { linkedCount: await countLinks(session, scope) };
  } finally {
    await session.close();
  }
}

async function clearExistingLinks(session: Session, scope: SymbolLinkScope): Promise<void> {
  if (scope) {
    await session.executeWrite((tx) =>
      tx.run(
        `MATCH (:PHPClass { id: $symbolId })-[link:DECLARED_IN_PACKAGE]->()
         DELETE link`,
        { symbolId: scope.symbolId }
      )
    );

    return;
  }

  await session.run(
    `MATCH ()-[link:DECLARED_IN_PACKAGE]->()
     CALL { WITH link DELETE link } IN TRANSACTIONS OF ${linkTransactionRows} ROWS`
  );
}

async function buildLinks(session: Session, scope: SymbolLinkScope): Promise<void> {
  await session.run(buildLinksQuery(scope), {
    kinds: declaredSymbolKinds,
    symbolId: scope?.symbolId ?? null
  });
}

function buildLinksQuery(scope: SymbolLinkScope): string {
  const symbolFilter = scope ? "AND symbol.id = $symbolId" : "";

  return `
    MATCH (packageNode:Package)
    WHERE size(coalesce(packageNode.psr4Namespaces, [])) > 0
    UNWIND packageNode.psr4Namespaces AS namespace
    MATCH (symbol:PHPClass)
    WHERE symbol.kind IN $kinds AND symbol.file IS NOT NULL AND symbol.id STARTS WITH namespace ${symbolFilter}
    WITH symbol, max(size(namespace)) AS longest, collect({ owner: packageNode, length: size(namespace) }) AS candidates
    UNWIND [candidate IN candidates WHERE candidate.length = longest] AS best
    WITH symbol, best.owner AS owner
    CALL { WITH symbol, owner
      MERGE (symbol)-[:DECLARED_IN_PACKAGE { identity: symbol.id + '|DECLARED_IN_PACKAGE|' + owner.id }]->(owner)
    } IN TRANSACTIONS OF ${linkTransactionRows} ROWS
  `;
}

async function countLinks(session: Session, scope: SymbolLinkScope): Promise<number> {
  const result = scope
    ? await session.run(
        `MATCH (:PHPClass { id: $symbolId })-[link:DECLARED_IN_PACKAGE]->()
         RETURN count(link) AS linkedCount`,
        { symbolId: scope.symbolId }
      )
    : await session.run(
        `MATCH ()-[link:DECLARED_IN_PACKAGE]->()
         RETURN count(link) AS linkedCount`
      );

  return result.records[0]?.get("linkedCount").toNumber() ?? 0;
}
