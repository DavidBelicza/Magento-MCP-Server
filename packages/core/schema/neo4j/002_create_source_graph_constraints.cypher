CREATE CONSTRAINT magentic_symbol_id IF NOT EXISTS FOR (node:Symbol) REQUIRE node.id IS UNIQUE;
CREATE CONSTRAINT magentic_symbol_extends_identity IF NOT EXISTS FOR ()-[relationship:EXTENDS]-() REQUIRE relationship.identity IS UNIQUE;
