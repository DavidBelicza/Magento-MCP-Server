import { describe, expect, it } from "vitest";
import {
  computeConfigVectorDelta,
  type StoredConfigRow
} from "../../../../src/modules/processing/store-config/compute-config-vector-delta";
import type { ConfigFieldDescription } from "../../../../src/modules/processing/store-config/types";

const model = "embeddinggemma-300m-qat";

function field(path: string, description: string): ConfigFieldDescription {
  return { path, description, configPath: null, comment: null, sourceFile: "system.xml" };
}

function stored(rows: Array<[string, string]>, rowModel = model): Map<string, StoredConfigRow> {
  return new Map(rows.map(([path, description]) => [path, { description, model: rowModel }]));
}

describe("computeConfigVectorDelta", () => {
  it("upserts a new path that is not stored", () => {
    const result = computeConfigVectorDelta([field("a/b/c", "desc")], stored([]), model);

    expect(result.toUpsert.map((d) => d.path)).toEqual(["a/b/c"]);
    expect(result.toDelete).toEqual([]);
  });

  it("upserts a path whose description changed", () => {
    const result = computeConfigVectorDelta([field("a/b/c", "new")], stored([["a/b/c", "old"]]), model);

    expect(result.toUpsert.map((d) => d.path)).toEqual(["a/b/c"]);
    expect(result.toDelete).toEqual([]);
  });

  it("upserts everything when the model changed, even if descriptions match", () => {
    const result = computeConfigVectorDelta(
      [field("a/b/c", "same")],
      stored([["a/b/c", "same"]], "old-model"),
      model
    );

    expect(result.toUpsert.map((d) => d.path)).toEqual(["a/b/c"]);
  });

  it("skips an unchanged path (same description and model)", () => {
    const result = computeConfigVectorDelta([field("a/b/c", "same")], stored([["a/b/c", "same"]]), model);

    expect(result.toUpsert).toEqual([]);
    expect(result.toDelete).toEqual([]);
  });

  it("deletes a stored path that is no longer present", () => {
    const result = computeConfigVectorDelta([field("a/b/c", "same")], stored([["a/b/c", "same"], ["x/y/z", "gone"]]), model);

    expect(result.toUpsert).toEqual([]);
    expect(result.toDelete).toEqual(["x/y/z"]);
  });

  it("handles a mixed batch of new, changed, unchanged, and removed", () => {
    const descriptions = [field("keep", "same"), field("change", "v2"), field("add", "fresh")];
    const result = computeConfigVectorDelta(
      descriptions,
      stored([["keep", "same"], ["change", "v1"], ["remove", "old"]]),
      model
    );

    expect(result.toUpsert.map((d) => d.path).sort()).toEqual(["add", "change"]);
    expect(result.toDelete).toEqual(["remove"]);
  });
});
