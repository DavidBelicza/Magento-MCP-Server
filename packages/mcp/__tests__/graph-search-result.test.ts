import { describe, expect, it } from "vitest";
import {
  buildGraphPayload,
  buildTablePayload,
  collapseEntityReferences,
  estimateTokens,
  hasGraphEntities,
  readResultShapes
} from "../src/graph-search-result";

const node = (id: string) => ({ id, labels: ["PHPClass"], kind: "class", properties: { fqcn: id } });

describe("collapseEntityReferences", () => {
  it("replaces an entity object with its id", () => {
    expect(collapseEntityReferences(node("Acme\\A"))).toBe("Acme\\A");
  });

  it("leaves scalars untouched", () => {
    expect(collapseEntityReferences("plain")).toBe("plain");
    expect(collapseEntityReferences(42)).toBe(42);
    expect(collapseEntityReferences(null)).toBeNull();
  });

  it("collapses entities inside arrays", () => {
    expect(collapseEntityReferences([node("A"), node("B")])).toEqual(["A", "B"]);
  });

  it("recurses into plain objects that are not entities", () => {
    expect(collapseEntityReferences({ count: 3, owner: node("A") })).toEqual({ count: 3, owner: "A" });
  });
});

describe("buildTablePayload", () => {
  it("defaults missing columns and rows to empty arrays", () => {
    expect(buildTablePayload({})).toEqual({ columns: [], rows: [] });
  });

  it("collapses entity cells in rows to their ids", () => {
    const payload = buildTablePayload({
      columns: ["a", "label"],
      rows: [{ a: node("Acme\\A"), label: "x" }]
    });

    expect(payload).toEqual({ columns: ["a", "label"], rows: [{ a: "Acme\\A", label: "x" }] });
  });
});

describe("buildGraphPayload", () => {
  it("keeps de-duplicated nodes and relationships while collapsing rows to ids", () => {
    const nodes = [node("A"), node("B"), node("C")];
    const relationships = [
      { id: "r1", type: "HAS_METHOD", startNodeId: "A", endNodeId: "B", properties: {} },
      { id: "r2", type: "EXTENDS", startNodeId: "C", endNodeId: "A", properties: {} }
    ];
    const result = {
      columns: ["a", "b"],
      rows: [
        { a: node("A"), b: node("B") },
        { a: node("C"), b: node("A") }
      ]
    };

    const payload = buildGraphPayload(result, { nodes, relationships });

    expect(payload.nodes).toHaveLength(3);
    expect(payload.relationships).toEqual(relationships);
    expect(payload.rows).toEqual([
      { a: "A", b: "B" },
      { a: "C", b: "A" }
    ]);
  });
});

describe("hasGraphEntities", () => {
  it("is true when nodes or relationships are present", () => {
    expect(hasGraphEntities({ nodes: [node("A")], relationships: [] })).toBe(true);
    expect(hasGraphEntities({ nodes: [], relationships: [{ id: "r" }] })).toBe(true);
  });

  it("is false when both are empty or absent", () => {
    expect(hasGraphEntities({ nodes: [], relationships: [] })).toBe(false);
    expect(hasGraphEntities({})).toBe(false);
  });
});

describe("readResultShapes", () => {
  it("extracts result and structured, defaulting absent fields to empty objects", () => {
    expect(readResultShapes({})).toEqual({ result: {}, structured: {} });

    const source = { result: { columns: ["a"], rows: [] }, structuredResult: { nodes: [], relationships: [] } };
    expect(readResultShapes(source)).toEqual({
      result: { columns: ["a"], rows: [] },
      structured: { nodes: [], relationships: [] }
    });
  });
});

describe("estimateTokens", () => {
  it("grows with payload size", () => {
    const small = estimateTokens({ a: 1 });
    const large = estimateTokens({ rows: Array.from({ length: 50 }, () => node("Acme\\Long\\Name")) });

    expect(small).toBeGreaterThan(0);
    expect(large).toBeGreaterThan(small);
  });
});
