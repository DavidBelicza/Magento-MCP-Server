CREATE CONSTRAINT magentic_symbol_implements_identity IF NOT EXISTS FOR ()-[relationship:IMPLEMENTS]-() REQUIRE relationship.identity IS UNIQUE;
