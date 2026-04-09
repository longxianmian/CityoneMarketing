-- 002_auth_accounts.sql
-- 第二批第1份：认证与账户体系正式落库
-- 创建管理员表、扩展 points_accounts 为完整会员表、新增 member_config 和 role_templates 表

-- ── 1. 管理员/操作员账号表（替代 admins.json）────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id              SERIAL PRIMARY KEY,
  username        VARCHAR(100) UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  display_name    VARCHAR(200) NOT NULL DEFAULT '',
  role            VARCHAR(50)  NOT NULL DEFAULT 'operator',
  permissions     JSONB        NOT NULL DEFAULT '[]',
  department      VARCHAR(200)          DEFAULT '',
  status          VARCHAR(20)  NOT NULL DEFAULT 'active',  -- active | disabled
  note            TEXT                  DEFAULT '',
  created_by      INTEGER,              -- 指向创建者 admin.id（不设 FK，避免自引用复杂性）
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ,
  last_login_at   TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS admins_username_idx ON admins (username);
CREATE INDEX IF NOT EXISTS admins_role_idx     ON admins (role);
CREATE INDEX IF NOT EXISTS admins_status_idx   ON admins (status);

-- ── 2. 扩展 points_accounts 表（补充会员身份字段）────────────────────────────
-- points_accounts 已在 001 中创建，本次补充会员专属列
ALTER TABLE points_accounts
  ADD COLUMN IF NOT EXISTS line_display_name  TEXT,
  ADD COLUMN IF NOT EXISTS deposit_paid       BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_amount     NUMERIC(10,2)        DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_used_charging  BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source             TEXT,
  ADD COLUMN IF NOT EXISTS source_hint        TEXT,
  ADD COLUMN IF NOT EXISTS source_channel_id  TEXT,
  ADD COLUMN IF NOT EXISTS source_entry_id    TEXT,
  ADD COLUMN IF NOT EXISTS member_level       INTEGER              DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tags               JSONB                DEFAULT '[]';

-- ── 3. 会员配置表（单行键值，替代 member-config.json）───────────────────────
CREATE TABLE IF NOT EXISTS member_config (
  id                INTEGER PRIMARY KEY DEFAULT 1,
  charging_discount JSONB          DEFAULT '{}',
  deposit           JSONB          DEFAULT '{}',
  extra_benefits    JSONB          DEFAULT '[]',
  updated_at        TIMESTAMPTZ,
  updated_by        TEXT
);

-- 保证始终有且仅有一行
INSERT INTO member_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── 4. 角色模板表（替代 role_templates.json）────────────────────────────────
CREATE TABLE IF NOT EXISTS role_templates (
  key                 VARCHAR(50) PRIMARY KEY,
  label               TEXT NOT NULL,
  label_th            TEXT,
  label_en            TEXT,
  description         TEXT,
  group_name          VARCHAR(50),
  default_permissions JSONB DEFAULT '[]',
  can_be_created_by   JSONB DEFAULT '[]',
  sort_order          INTEGER DEFAULT 0
);
