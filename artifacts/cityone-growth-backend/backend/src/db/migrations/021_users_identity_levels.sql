-- 021_users_identity_levels.sql
-- 为 users 表补齐唯一身份与业务身份分层字段

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS has_charge_order       BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deposit_paid           BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS identity_level         VARCHAR(32) NOT NULL DEFAULT 'visitor',
  ADD COLUMN IF NOT EXISTS last_identified_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_follow_checked_at TIMESTAMPTZ;

-- 从 points_accounts 同步当前已知的押金/充电使用事实
UPDATE users u
SET
  deposit_paid = COALESCE((
    SELECT pa.deposit_paid
    FROM points_accounts pa
    WHERE pa.user_id = u.user_id
       OR pa.line_user_id = u.user_id
       OR (u.line_user_id IS NOT NULL AND (pa.user_id = u.line_user_id OR pa.line_user_id = u.line_user_id))
    ORDER BY pa.updated_at DESC NULLS LAST
    LIMIT 1
  ), u.deposit_paid),
  has_charge_order = COALESCE((
    SELECT pa.has_used_charging
    FROM points_accounts pa
    WHERE pa.user_id = u.user_id
       OR pa.line_user_id = u.user_id
       OR (u.line_user_id IS NOT NULL AND (pa.user_id = u.line_user_id OR pa.line_user_id = u.line_user_id))
    ORDER BY pa.updated_at DESC NULLS LAST
    LIMIT 1
  ), u.has_charge_order),
  updated_at = NOW();

UPDATE users
SET identity_level = CASE
  WHEN COALESCE(line_user_id, '') = '' THEN 'visitor'
  WHEN is_fan = TRUE AND deposit_paid = TRUE THEN 'member'
  WHEN is_fan = TRUE AND has_charge_order = TRUE THEN 'customer'
  WHEN is_fan = TRUE THEN 'fan'
  ELSE 'visitor'
END;

CREATE INDEX IF NOT EXISTS idx_users_identity_level    ON users(identity_level);
CREATE INDEX IF NOT EXISTS idx_users_last_identified   ON users(last_identified_at);
CREATE INDEX IF NOT EXISTS idx_users_last_follow_check ON users(last_follow_checked_at);
