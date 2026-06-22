CREATE CONSTRAINT magentic_observes_identity IF NOT EXISTS FOR ()-[relationship:OBSERVES]-() REQUIRE relationship.identity IS UNIQUE;
