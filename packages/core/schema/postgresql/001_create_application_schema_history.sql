CREATE TABLE IF NOT EXISTS application_schema_history (
  id TEXT PRIMARY KEY,
  database_type TEXT NOT NULL,
  script_name TEXT NOT NULL,
  script_checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
