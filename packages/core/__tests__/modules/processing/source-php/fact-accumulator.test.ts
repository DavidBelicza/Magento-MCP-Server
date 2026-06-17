import { describe, expect, it, vi } from "vitest";
import { createFactAccumulator } from "../../../../src/modules/processing/source-php/fact-accumulator";
import type { FileFacts } from "../../../../src/modules/processing/source-php/types";

function fileWithFacts(factCount: number, file = "file.php"): FileFacts {
  return { file, facts: Array.from({ length: factCount }, (_, i) => ({ index: i })) } as unknown as FileFacts;
}

describe("createFactAccumulator", () => {
  it("does not flush before the record threshold is reached", async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const accumulator = createFactAccumulator(5, flush);

    await accumulator.add(fileWithFacts(3));

    expect(flush).not.toHaveBeenCalled();
  });

  it("flushes once the accumulated record count reaches the threshold", async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const accumulator = createFactAccumulator(5, flush);

    await accumulator.add(fileWithFacts(3));
    await accumulator.add(fileWithFacts(2));

    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush.mock.calls[0][0]).toHaveLength(2);
  });

  it("counts records, not files, against the threshold", async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const accumulator = createFactAccumulator(4, flush);

    await accumulator.add(fileWithFacts(5));

    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("resets the buffer after a threshold flush", async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const accumulator = createFactAccumulator(2, flush);

    await accumulator.add(fileWithFacts(2));
    await accumulator.add(fileWithFacts(1));
    await accumulator.flush();

    expect(flush).toHaveBeenCalledTimes(2);
    expect(flush.mock.calls[1][0]).toHaveLength(1);
  });

  it("flushes the remaining buffer on an explicit flush", async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const accumulator = createFactAccumulator(100, flush);

    await accumulator.add(fileWithFacts(1));
    await accumulator.flush();

    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("does nothing when flushing an empty buffer", async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const accumulator = createFactAccumulator(10, flush);

    await accumulator.flush();

    expect(flush).not.toHaveBeenCalled();
  });
});
