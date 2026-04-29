ALTER TABLE pending_intents
  ADD COLUMN IF NOT EXISTS target_type TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS attribution_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS terminal_source TEXT,
  ADD COLUMN IF NOT EXISTS consume_key TEXT,
  ADD COLUMN IF NOT EXISTS redirect_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS executing_at TIMESTAMPTZ;

UPDATE pending_intents
   SET target_type = COALESCE(NULLIF(target_type, ''), CASE
       WHEN action = 'claim_coupon' THEN 'coupon'
       WHEN action = 'participate_activity' THEN 'activity'
       WHEN action = 'redeem_product' THEN 'product'
       WHEN action = 'use_benefit' THEN 'benefit'
       ELSE 'unknown'
     END),
       source_url = COALESCE(NULLIF(source_url, ''), return_path),
       terminal_source = COALESCE(NULLIF(terminal_source, ''), terminal, 'unknown')
 WHERE target_type IS NULL
    OR target_type = ''
    OR source_url IS NULL
    OR source_url = ''
    OR terminal_source IS NULL
    OR terminal_source = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_intents_consume_key
  ON pending_intents(consume_key)
  WHERE consume_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pending_intents_line_status
  ON pending_intents(line_user_id, status, created_at DESC);
