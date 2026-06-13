import type { Driver } from "neo4j-driver";

const deleteTransactionRows = 20000;

export async function deleteGraph(driver: Driver): Promise<void> {
  const session = driver.session();

  try {
    await session.run(
      `MATCH (node)
       CALL { WITH node DETACH DELETE node } IN TRANSACTIONS OF ${deleteTransactionRows} ROWS`
    );
  } finally {
    await session.close();
  }
}
