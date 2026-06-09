export class GraphSearchValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphSearchValidationError";
  }
}

const maxCypherLength = 50_000;
const readOnlyStarters = /^(MATCH|OPTIONAL\s+MATCH|WITH|RETURN|UNWIND|CALL)\b/i;
const forbiddenCypherKeywords =
  /\b(CREATE|MERGE|SET|DELETE|DETACH\s+DELETE|REMOVE|DROP|ALTER|RENAME|GRANT|DENY|REVOKE|LOAD\s+CSV|FOREACH|USE|START\s+DATABASE|STOP\s+DATABASE)\b/i;
const forbiddenProcedures = /\bCALL\s+(dbms|apoc|gds)\b/i;

export function validateReadOnlyCypher(cypherQuery: string): void {
  const trimmedQuery = cypherQuery.trim();

  if (!trimmedQuery) {
    throw new GraphSearchValidationError("cypherQuery is required");
  }

  if (trimmedQuery.length > maxCypherLength) {
    throw new GraphSearchValidationError(`cypherQuery must be ${maxCypherLength} characters or fewer`);
  }

  const comparableQuery = removeCypherComments(removeQuotedStrings(trimmedQuery)).trim();

  if (comparableQuery.includes(";")) {
    throw new GraphSearchValidationError("Only one Cypher statement is allowed");
  }

  if (!readOnlyStarters.test(comparableQuery)) {
    throw new GraphSearchValidationError("Cypher query must start with a read-only clause");
  }

  if (forbiddenCypherKeywords.test(comparableQuery) || forbiddenProcedures.test(comparableQuery)) {
    throw new GraphSearchValidationError("Cypher query contains a write, admin, or unsafe procedure clause");
  }
}

function removeQuotedStrings(value: string): string {
  return value.replace(/'([^'\\]|\\.)*'|"([^"\\]|\\.)*"/g, "''");
}

function removeCypherComments(value: string): string {
  return value.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}
