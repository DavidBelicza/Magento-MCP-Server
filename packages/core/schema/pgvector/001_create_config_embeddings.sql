CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS config_embeddings (
  path        TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  embedding   vector(768) NOT NULL,
  model       TEXT NOT NULL,
  source_file TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
