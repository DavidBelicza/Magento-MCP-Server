DROP CONSTRAINT magentic_symbol_id IF EXISTS;
CREATE CONSTRAINT magentic_php_class_id IF NOT EXISTS FOR (node:PHPClass) REQUIRE node.id IS UNIQUE;
CREATE CONSTRAINT magentic_php_method_id IF NOT EXISTS FOR (node:PHPMethod) REQUIRE node.id IS UNIQUE;
CREATE CONSTRAINT magentic_event_id IF NOT EXISTS FOR (node:Event) REQUIRE node.id IS UNIQUE;
CREATE CONSTRAINT magentic_cron_group_id IF NOT EXISTS FOR (node:CronGroup) REQUIRE node.id IS UNIQUE;
