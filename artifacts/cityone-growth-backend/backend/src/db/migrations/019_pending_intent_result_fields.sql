ALTER TABLE pending_intents
  ADD COLUMN IF NOT EXISTS result_json JSONB,
  ADD COLUMN IF NOT EXISTS error_json JSONB;

UPDATE pending_intents
   SET result_json = COALESCE(result_json, result_payload)
 WHERE result_payload IS NOT NULL
   AND result_json IS NULL;
