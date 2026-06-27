import { describe, expect, it } from "vitest";
import { estimateTokens } from "../../../../src/modules/vector/embedding/estimate-tokens";

describe("estimateTokens", () => {
  it("returns zero for empty text", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("grows with the size of the text", () => {
    const short = estimateTokens("one two three");
    const long = estimateTokens("one two three four five six seven eight nine ten eleven twelve");

    expect(short).toBeGreaterThan(0);
    expect(long).toBeGreaterThan(short);
  });

  it("takes the larger of the character and word estimates", () => {
    const text = "antidisestablishmentarianism";

    expect(estimateTokens(text)).toBe(Math.ceil(text.length / 4));
  });
});
