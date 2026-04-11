-- 012_users.sql
-- 统一用户身份表：作为全系统身份锚点
-- user_id = LINE User ID（LINE 用户）或 device UUID（纯设备用户）
-- 所有权益身份（粉丝 / 用户 / 会员）均基于此 user_id 派生

CREATE TABLE IF NOT EXISTS users (
  user_id          VARCHAR(128)  PRIMARY KEY,     -- 规范 ID（LINE 用户 = line_user_id；设备用户 = device UUID）
  line_user_id     VARCHAR(128)  UNIQUE,           -- LINE LIFF User ID（Uxxxxxxxx...）
  device_id        VARCHAR(128),                   -- 设备 UUID（最后一次使用的设备）
  display_name     TEXT,                           -- LINE 昵称或展示名
  picture_url      TEXT,                           -- 头像 URL
  language         VARCHAR(8)    DEFAULT 'zh',     -- 偏好语言 zh / th / en
  is_fan           BOOLEAN       DEFAULT FALSE,    -- 是否关注 OA
  created_at       TIMESTAMPTZ   DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_line_user_id ON users(line_user_id);
CREATE INDEX IF NOT EXISTS idx_users_device_id    ON users(device_id);
CREATE INDEX IF NOT EXISTS idx_users_is_fan       ON users(is_fan);

-- 注：
-- is_fan 由以下两个流程维护：
--   1. LINE Webhook follow/unfollow 事件
--   2. POST /api/user/set-fan（用户点击关注按钮时预写）
--
-- 所有业务表（user_coupons / points_accounts / mall_redeems / 等）
-- 的 user_id 字段均与 users.user_id 保持一致，
-- 但暂不添加外键约束以保持向后兼容性。
