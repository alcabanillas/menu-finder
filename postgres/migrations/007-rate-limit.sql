-- MF-21 (openspec/changes/mf-21-rate-limit): durable rate limiting and usage quotas for failed sign-ins and global LLM cap.
-- Tracks atomic bucket counters (key, count, expires_at, updated_at).
-- An index on expires_at allows fast cleanup of stale records (older than 1 day).
-- Row-level security is enabled without policies: only the owner role reads and writes (safety-first §2.3).

CREATE TABLE rate_limit_bucket (
  key text NOT NULL PRIMARY KEY,
  count integer NOT NULL CHECK (count >= 0),
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX rate_limit_bucket_expires_at_idx ON rate_limit_bucket (expires_at);

ALTER TABLE rate_limit_bucket ENABLE ROW LEVEL SECURITY;
