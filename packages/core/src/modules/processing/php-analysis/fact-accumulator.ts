import type { FileFacts } from "./types.js";

export type FactBatchFlush = (batch: FileFacts[]) => Promise<void>;

export type FactAccumulator = {
  add(fileFacts: FileFacts): Promise<void>;
  flush(): Promise<void>;
};

export function createFactAccumulator(recordThreshold: number, flush: FactBatchFlush): FactAccumulator {
  let buffer: FileFacts[] = [];
  let recordCount = 0;

  async function flushBuffer(): Promise<void> {
    if (buffer.length === 0) {
      return;
    }

    const batch = buffer;
    buffer = [];
    recordCount = 0;
    await flush(batch);
  }

  return {
    async add(fileFacts: FileFacts): Promise<void> {
      buffer.push(fileFacts);
      recordCount += fileFacts.facts.length;

      if (recordCount >= recordThreshold) {
        await flushBuffer();
      }
    },
    flush: flushBuffer
  };
}
