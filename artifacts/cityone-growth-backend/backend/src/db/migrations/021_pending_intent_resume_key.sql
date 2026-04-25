ALTER TABLE pending_intents
  ADD COLUMN IF NOT EXISTS resume_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_intents_resume_key
  ON pending_intents(resume_key)
  WHERE resume_key IS NOT NULL;

