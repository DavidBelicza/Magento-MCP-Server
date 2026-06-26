CREATE CONSTRAINT magentic_preference_for_identity IF NOT EXISTS FOR ()-[relationship:PREFERENCE_FOR]-() REQUIRE relationship.identity IS UNIQUE;
CREATE CONSTRAINT magentic_plugin_for_identity IF NOT EXISTS FOR ()-[relationship:PLUGIN_FOR]-() REQUIRE relationship.identity IS UNIQUE;
