import { describe, expect, it } from "vitest";
import {
  createEdgeHash,
  createNodeHash
} from "../../../../src/modules/processing/composer-lock/create-record-hash";

describe("create-record-hash", () => {
  it("is deterministic for identical input", () => {
    expect(createNodeHash({ id: "pkg/a", version: "1.0" })).toBe(createNodeHash({ id: "pkg/a", version: "1.0" }));
  });

  it("is independent of object key order", () => {
    expect(createNodeHash({ a: 1, b: 2 })).toBe(createNodeHash({ b: 2, a: 1 }));
  });

  it("ignores undefined-valued keys", () => {
    expect(createNodeHash({ a: 1, b: undefined })).toBe(createNodeHash({ a: 1 }));
  });

  it("distinguishes different values", () => {
    expect(createNodeHash({ id: "pkg/a" })).not.toBe(createNodeHash({ id: "pkg/b" }));
  });

  it("namespaces node and edge hashes separately", () => {
    expect(createNodeHash({ id: "x" })).not.toBe(createEdgeHash({ id: "x" }));
  });

  it("normalizes bigint to its string form", () => {
    expect(createNodeHash({ n: 10n })).toBe(createNodeHash({ n: "10" }));
  });

  it("normalizes Date to its ISO string", () => {
    const date = new Date("2026-01-01T00:00:00.000Z");
    expect(createNodeHash({ at: date })).toBe(createNodeHash({ at: "2026-01-01T00:00:00.000Z" }));
  });

  it("normalizes nested objects recursively", () => {
    expect(createNodeHash({ outer: { a: 1, b: 2 } })).toBe(createNodeHash({ outer: { b: 2, a: 1 } }));
  });

  it("preserves array order", () => {
    expect(createNodeHash({ list: [1, 2] })).not.toBe(createNodeHash({ list: [2, 1] }));
  });

  it("returns a 64-character hex sha256 digest", () => {
    expect(createNodeHash({ id: "pkg/a" })).toMatch(/^[0-9a-f]{64}$/);
  });
});
