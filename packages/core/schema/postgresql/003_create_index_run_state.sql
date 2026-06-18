CREATE TABLE IF NOT EXISTS index_run_state (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  finished_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  node_count BIGINT NOT NULL DEFAULT 0,
  edge_count BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT index_run_state_singleton CHECK (id)
);
