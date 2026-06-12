CREATE CONSTRAINT magentic_symbol_param_type_identity IF NOT EXISTS FOR ()-[relationship:PARAM_TYPE]-() REQUIRE relationship.identity IS UNIQUE;
CREATE CONSTRAINT magentic_symbol_returns_type_identity IF NOT EXISTS FOR ()-[relationship:RETURNS_TYPE]-() REQUIRE relationship.identity IS UNIQUE;
