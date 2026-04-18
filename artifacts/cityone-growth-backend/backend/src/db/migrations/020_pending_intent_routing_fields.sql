ALTER TABLE pending_intents
  ADD COLUMN IF NOT EXISTS success_path TEXT,
  ADD COLUMN IF NOT EXISTS fail_path TEXT,
  ADD COLUMN IF NOT EXISTS terminal TEXT;

UPDATE pending_intents
SET success_path = COALESCE(NULLIF(success_path, ''), return_path),
    fail_path = COALESCE(NULLIF(fail_path, ''), return_path),
    terminal = COALESCE(NULLIF(terminal, ''), 'unknown')
WHERE success_path IS NULL
   OR success_path = ''
   OR fail_path IS NULL
   OR fail_path = ''
   OR terminal IS NULL
   OR terminal = '';
