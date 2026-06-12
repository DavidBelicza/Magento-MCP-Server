CREATE CONSTRAINT magentic_symbol_declared_in_package_identity IF NOT EXISTS FOR ()-[relationship:DECLARED_IN_PACKAGE]-() REQUIRE relationship.identity IS UNIQUE;
