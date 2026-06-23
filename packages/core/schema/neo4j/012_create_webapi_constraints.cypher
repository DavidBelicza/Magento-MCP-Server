CREATE CONSTRAINT magentic_webapi_route_id IF NOT EXISTS FOR (node:WebapiRoute) REQUIRE node.id IS UNIQUE;
CREATE CONSTRAINT magentic_extension_attribute_id IF NOT EXISTS FOR (node:ExtensionAttribute) REQUIRE node.id IS UNIQUE;
CREATE CONSTRAINT magentic_served_by_identity IF NOT EXISTS FOR ()-[relationship:SERVED_BY]-() REQUIRE relationship.identity IS UNIQUE;
CREATE CONSTRAINT magentic_has_extension_attribute_identity IF NOT EXISTS FOR ()-[relationship:HAS_EXTENSION_ATTRIBUTE]-() REQUIRE relationship.identity IS UNIQUE;
CREATE CONSTRAINT magentic_of_type_identity IF NOT EXISTS FOR ()-[relationship:OF_TYPE]-() REQUIRE relationship.identity IS UNIQUE;
