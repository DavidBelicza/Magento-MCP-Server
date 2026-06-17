import { describe, expect, it } from "vitest";
import {
  GraphSearchValidationError,
  validateReadOnlyCypher
} from "../../../../src/modules/graph/search/validate-cypher";

describe("validateReadOnlyCypher", () => {
  it("accepts a simple read-only MATCH/RETURN query", () => {
    expect(() => validateReadOnlyCypher("MATCH (n:Symbol) RETURN n LIMIT 10")).not.toThrow();
  });

  it.each(["OPTIONAL MATCH (n) RETURN n", "WITH 1 AS x RETURN x", "UNWIND [1,2] AS n RETURN n", "CALL db.labels()"])(
    "accepts read-only starter: %s",
    (query) => {
      expect(() => validateReadOnlyCypher(query)).not.toThrow();
    }
  );

  it("rejects an empty query", () => {
    expect(() => validateReadOnlyCypher("   ")).toThrow(GraphSearchValidationError);
  });

  it("rejects a query that does not start with a read-only clause", () => {
    expect(() => validateReadOnlyCypher("RETURNX 1")).toThrow(/read-only clause/);
  });

  it.each(["CREATE", "MERGE", "SET", "DELETE", "DETACH DELETE", "REMOVE", "DROP", "LOAD CSV", "FOREACH"])(
    "rejects write/admin keyword: %s",
    (keyword) => {
      expect(() => validateReadOnlyCypher(`MATCH (n) ${keyword} n RETURN n`)).toThrow(
        /write, admin, or unsafe procedure/
      );
    }
  );

  it.each(["CALL apoc.create.node([], {})", "CALL dbms.components()", "CALL gds.graph.list()"])(
    "rejects forbidden procedure namespace: %s",
    (query) => {
      expect(() => validateReadOnlyCypher(query)).toThrow(/write, admin, or unsafe procedure/);
    }
  );

  it("rejects multiple statements separated by a semicolon", () => {
    expect(() => validateReadOnlyCypher("MATCH (n) RETURN n; MATCH (m) RETURN m")).toThrow(
      /Only one Cypher statement/
    );
  });

  it("rejects a query exceeding the maximum length", () => {
    const longQuery = `MATCH (n) WHERE n.name = "${"a".repeat(50_001)}" RETURN n`;
    expect(() => validateReadOnlyCypher(longQuery)).toThrow(/50000 characters or fewer/);
  });

  it("allows forbidden keywords that appear only inside string literals", () => {
    expect(() => validateReadOnlyCypher('MATCH (n) WHERE n.name = "DELETE" RETURN n')).not.toThrow();
  });

  it("allows forbidden keywords that appear only inside comments", () => {
    expect(() => validateReadOnlyCypher("MATCH (n) RETURN n // CREATE is fine here")).not.toThrow();
  });
});
