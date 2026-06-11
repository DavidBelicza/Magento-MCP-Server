CREATE CONSTRAINT magentic_symbol_has_method_identity IF NOT EXISTS FOR ()-[relationship:HAS_METHOD]-() REQUIRE relationship.identity IS UNIQUE;
CREATE CONSTRAINT magentic_symbol_uses_identity IF NOT EXISTS FOR ()-[relationship:USES]-() REQUIRE relationship.identity IS UNIQUE;
