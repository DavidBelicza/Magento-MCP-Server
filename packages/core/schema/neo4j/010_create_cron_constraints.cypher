CREATE CONSTRAINT magentic_scheduled_in_identity IF NOT EXISTS FOR ()-[relationship:SCHEDULED_IN]-() REQUIRE relationship.identity IS UNIQUE;
