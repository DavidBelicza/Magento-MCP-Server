import type { Driver } from "neo4j-driver";

const wipeTransactionRows = 20000;

export async function wipeGraph(driver: Driver): Promise<void> {
  const session = driver.session();

  try {
    await session.run(
      `MATCH (node)
       CALL { WITH node DETACH DELETE node } IN TRANSACTIONS OF ${wipeTransactionRows} ROWS`
    );
  } finally {
    await session.close();
  }
}
