CREATE TABLE IF NOT EXISTS pending_intents (
  intent_id       TEXT PRIMARY KEY,
  nonce           TEXT NOT NULL UNIQUE,
  user_id         TEXT,
  line_user_id    TEXT,
  action          TEXT NOT NULL,
  resource_id     TEXT NOT NULL,
  return_path     TEXT NOT NULL,
  back_path       TEXT NOT NULL,
  action_name     TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  status          TEXT NOT NULL DEFAULT 'pending',
  result_payload  JSONB,
  expires_at      TIMESTAMPTZ NOT NULL,
  consumed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_intents_status_expires
  ON pending_intents(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_pending_intents_user_created
  ON pending_intents(user_id, created_at DESC);
