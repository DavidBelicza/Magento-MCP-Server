CREATE CONSTRAINT magentic_injects_identity IF NOT EXISTS FOR ()-[relationship:INJECTS]-() REQUIRE relationship.identity IS UNIQUE;
