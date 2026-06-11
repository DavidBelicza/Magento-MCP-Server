import type { Driver } from "neo4j-driver";
import { createFactAccumulator, type FactAccumulator } from "./fact-accumulator.js";
import { savePhpAnalysisBatch } from "./save-facts.js";
import type { FileFacts } from "./types.js";

export async function consumeFactStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  driver: Driver,
  batchSize: number,
  onBatchSaved: () => Promise<void>
): Promise<void> {
  const session = driver.session();
  const decoder = new TextDecoder();
  const accumulator = createFactAccumulator(batchSize, async (batch) => {
    await savePhpAnalysisBatch(session, batch, batchSize);
    await onBatchSaved();
  });
  let buffer = "";

  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      buffer += decoder.decode(chunk.value, { stream: true });
      buffer = await addCompleteLines(buffer, accumulator);
    }

    await addLine(buffer, accumulator);
    await accumulator.flush();
  } finally {
    await session.close();
    reader.releaseLock();
  }
}

async function addCompleteLines(buffer: string, accumulator: FactAccumulator): Promise<string> {
  const lines = buffer.split("\n");
  const remainder = lines.pop() ?? "";

  for (const line of lines) {
    await addLine(line, accumulator);
  }

  return remainder;
}

async function addLine(line: string, accumulator: FactAccumulator): Promise<void> {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }

  const fileFacts = parseLine(trimmed);
  if (fileFacts) {
    await accumulator.add(fileFacts);
  }
}

function parseLine(line: string): FileFacts | null {
  try {
    return JSON.parse(line) as FileFacts;
  } catch (error) {
    console.error("Failed to parse fact line:", line.substring(0, 100), error);
    return null;
  }
}
