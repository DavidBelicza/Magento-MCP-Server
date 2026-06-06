CREATE TABLE IF NOT EXISTS query_history (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  description TEXT NOT NULL,
  cypher_query TEXT NOT NULL,
  result JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS query_history_created_at_idx
ON query_history (created_at DESC);
