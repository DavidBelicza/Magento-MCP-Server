import type { Driver } from "neo4j-driver";
import { savePhpAnalysisFacts } from "./save-facts.js";
import type { FileFacts } from "./types.js";

export async function processFact(driver: Driver, factString: string, batchSize: number): Promise<void> {
  try {
    const fileFacts = JSON.parse(factString) as FileFacts;
    await savePhpAnalysisFacts(driver, fileFacts, batchSize);
  } catch (err) {
    console.error("Failed to process fact:", factString.substring(0, 100), err);
  }
}
