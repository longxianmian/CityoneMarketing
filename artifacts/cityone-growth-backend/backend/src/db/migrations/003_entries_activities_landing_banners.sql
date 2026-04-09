-- 第二批第2份：入口与活动归因主链路 PostgreSQL 迁移
-- activities / activity_participations 在 001 已建，只 ALTER 补列
-- 其余 7 张表全新建

-- ─── ALTER: activities 补充业务字段 ─────────────────────────────────────────
ALTER TABLE activities ADD COLUMN IF NOT EXISTS activity_title       VARCHAR(256)  NOT NULL DEFAULT '';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS activity_subtitle    VARCHAR(256)  NOT NULL DEFAULT '';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS activity_desc        TEXT          NOT NULL DEFAULT '';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS template_code        VARCHAR(64)   NOT NULL DEFAULT '';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS usage_mode           VARCHAR(32)   NOT NULL DEFAULT 'public';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS start_time           VARCHAR(32)   NOT NULL DEFAULT '';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS end_time             VARCHAR(32)   NOT NULL DEFAULT '';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS require_oa_follow    BOOLEAN       NOT NULL DEFAULT FALSE;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS auto_join_after_follow BOOLEAN     NOT NULL DEFAULT FALSE;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS entry_scope_json     JSONB;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS site_scope_json      JSONB;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS channel_scope_json   JSONB;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS share_enabled        BOOLEAN       NOT NULL DEFAULT FALSE;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS share_title          VARCHAR(256)  NOT NULL DEFAULT '';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS share_desc           VARCHAR(512)  NOT NULL DEFAULT '';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS share_cover          VARCHAR(512)  NOT NULL DEFAULT '';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS share_status         VARCHAR(32)   NOT NULL DEFAULT 'disabled';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS department           VARCHAR(64)   NOT NULL DEFAULT '';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS owner_dept           VARCHAR(64)   NOT NULL DEFAULT '';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS partner_dept         VARCHAR(64)   NOT NULL DEFAULT '';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS coupon_name          VARCHAR(128)  NOT NULL DEFAULT '';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS highlights           TEXT          NOT NULL DEFAULT '';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS participation_guide  TEXT          NOT NULL DEFAULT '';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS reward_guide         TEXT          NOT NULL DEFAULT '';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS notice_text          TEXT          NOT NULL DEFAULT '';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS reward_points        INTEGER       NOT NULL DEFAULT 0;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS landing_code         VARCHAR(64)   NOT NULL DEFAULT '';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS entry_ref_code       VARCHAR(64)   NOT NULL DEFAULT '';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS banner_code          VARCHAR(64)   NOT NULL DEFAULT '';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS sort_order           INTEGER       NOT NULL DEFAULT 0;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS is_featured          BOOLEAN       NOT NULL DEFAULT FALSE;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS source_banner_id     VARCHAR(64)   NOT NULL DEFAULT '';

-- ─── ALTER: activity_participations 补充归因字段 ─────────────────────────────
ALTER TABLE activity_participations ADD COLUMN IF NOT EXISTS device_code          VARCHAR(64) NOT NULL DEFAULT '';
ALTER TABLE activity_participations ADD COLUMN IF NOT EXISTS a_system_device_id   VARCHAR(64) NOT NULL DEFAULT '';
ALTER TABLE activity_participations ADD COLUMN IF NOT EXISTS source_banner_id     VARCHAR(64) NOT NULL DEFAULT '';
ALTER TABLE activity_participations ADD COLUMN IF NOT EXISTS created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE activity_participations ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ─── 入口模板表 (新建) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entry_templates (
  id                   SERIAL PRIMARY KEY,
  template_code        VARCHAR(64) UNIQUE NOT NULL,
  template_name        VARCHAR(128) NOT NULL,
  entry_type           VARCHAR(64)  NOT NULL DEFAULT '',
  default_feature_name VARCHAR(64)  NOT NULL DEFAULT '',
  status               VARCHAR(32)  NOT NULL DEFAULT 'enabled',
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── 入口实例表 (新建) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entry_instances (
  id                   SERIAL PRIMARY KEY,
  entry_code           VARCHAR(64) UNIQUE NOT NULL,
  site_id              VARCHAR(64)  NOT NULL DEFAULT '',
  site_name            VARCHAR(128) NOT NULL DEFAULT '',
  entry_type           VARCHAR(64)  NOT NULL DEFAULT '',
  entry_qr_code        VARCHAR(64)  NOT NULL DEFAULT '',
  current_feature_name VARCHAR(64)  NOT NULL DEFAULT '',
  status               VARCHAR(32)  NOT NULL DEFAULT 'enabled',
  landing_code         VARCHAR(64)  NOT NULL DEFAULT '',
  default_activity_code VARCHAR(64) NOT NULL DEFAULT '',
  qr_code_value        VARCHAR(256) NOT NULL DEFAULT '',
  external_url         VARCHAR(512) NOT NULL DEFAULT '',
  device_code          VARCHAR(64)  NOT NULL DEFAULT '',
  a_system_device_id   VARCHAR(64)  NOT NULL DEFAULT '',
  source_channel_id    VARCHAR(64)  NOT NULL DEFAULT '',
  sort_order           INTEGER      NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── 落地页表 (新建) ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS landing_pages (
  id                     SERIAL PRIMARY KEY,
  landing_code           VARCHAR(64) UNIQUE NOT NULL,
  name                   VARCHAR(128) NOT NULL DEFAULT '',
  template_type          VARCHAR(64)  NOT NULL DEFAULT '',
  title                  JSONB        NOT NULL DEFAULT '{"zh":"","th":"","en":""}',
  sub_title              JSONB        NOT NULL DEFAULT '{"zh":"","th":"","en":""}',
  benefit_text           JSONB        NOT NULL DEFAULT '{"zh":"","th":"","en":""}',
  support_text           JSONB        NOT NULL DEFAULT '{"zh":"","th":"","en":""}',
  button_text            JSONB        NOT NULL DEFAULT '{"zh":"","th":"","en":""}',
  primary_cta_text       JSONB        NOT NULL DEFAULT '{"zh":"","th":"","en":""}',
  hero_image             VARCHAR(512) NOT NULL DEFAULT '',
  hero_video             VARCHAR(512) NOT NULL DEFAULT '',
  primary_cta_action     VARCHAR(64)  NOT NULL DEFAULT 'follow_oa',
  follow_success_action  VARCHAR(64)  NOT NULL DEFAULT 'open_welfare_home',
  target_activity_id     VARCHAR(64)  NOT NULL DEFAULT '',
  target_product_id      VARCHAR(64)  NOT NULL DEFAULT '',
  target_page            VARCHAR(256) NOT NULL DEFAULT '',
  auto_claim_reward      BOOLEAN      NOT NULL DEFAULT FALSE,
  auto_join_activity     BOOLEAN      NOT NULL DEFAULT FALSE,
  auto_open_nearby       BOOLEAN      NOT NULL DEFAULT FALSE,
  auto_open_welfare_home BOOLEAN      NOT NULL DEFAULT FALSE,
  status                 VARCHAR(32)  NOT NULL DEFAULT 'enabled',
  entry_code             VARCHAR(64)  NOT NULL DEFAULT '',
  sort_order             INTEGER      NOT NULL DEFAULT 0,
  source_entry_id        VARCHAR(64)  NOT NULL DEFAULT '',
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── 创意-落地页绑定表 (新建) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creative_landing_bindings (
  id              SERIAL PRIMARY KEY,
  binding_code    VARCHAR(64) UNIQUE NOT NULL,
  creative_id     VARCHAR(64) NOT NULL DEFAULT '',
  creative_theme  VARCHAR(64) NOT NULL DEFAULT '',
  landing_code    VARCHAR(64) NOT NULL DEFAULT '',
  target_channel  VARCHAR(64) NOT NULL DEFAULT '',
  audience_type   VARCHAR(64) NOT NULL DEFAULT '',
  utm_source      VARCHAR(128) NOT NULL DEFAULT '',
  utm_campaign    VARCHAR(128) NOT NULL DEFAULT '',
  status          VARCHAR(32)  NOT NULL DEFAULT 'enabled',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Banner 表 (新建) ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS banners (
  id                SERIAL PRIMARY KEY,
  banner_code       VARCHAR(64) UNIQUE NOT NULL,
  title             JSONB        NOT NULL DEFAULT '{"zh":"","th":"","en":""}',
  sub_title         JSONB        NOT NULL DEFAULT '{"zh":"","th":"","en":""}',
  image_url         VARCHAR(512) NOT NULL DEFAULT '',
  position_key      VARCHAR(64)  NOT NULL DEFAULT 'home_top',
  jump_type         VARCHAR(32)  NOT NULL DEFAULT 'external',
  jump_target_id    VARCHAR(64)  NOT NULL DEFAULT '',
  jump_target_type  VARCHAR(32)  NOT NULL DEFAULT '',
  link_type         VARCHAR(32)  NOT NULL DEFAULT 'internal',
  link_url          VARCHAR(512) NOT NULL DEFAULT '',
  landing_code      VARCHAR(64)  NOT NULL DEFAULT '',
  activity_code     VARCHAR(64)  NOT NULL DEFAULT '',
  enabled           BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order        INTEGER      NOT NULL DEFAULT 0,
  start_at          TIMESTAMPTZ  NULL,
  end_at            TIMESTAMPTZ  NULL,
  source_entry_id   VARCHAR(64)  NOT NULL DEFAULT '',
  source_channel_id VARCHAR(64)  NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── 活动模板表 (新建) ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_templates (
  id                SERIAL PRIMARY KEY,
  template_code     VARCHAR(64) UNIQUE NOT NULL,
  template_name     VARCHAR(128) NOT NULL DEFAULT '',
  activity_type     VARCHAR(64)  NOT NULL DEFAULT '',
  header_json       JSONB,
  media_assets_json JSONB,
  intro_block_json  JSONB,
  steps_block_json  JSONB,
  reward_block_json JSONB,
  notice_block_json JSONB,
  cta_block_json    JSONB,
  status            VARCHAR(32)  NOT NULL DEFAULT 'enabled',
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── 活动-商品绑定表 (新建) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_product_bindings (
  id              SERIAL PRIMARY KEY,
  binding_code    VARCHAR(64) UNIQUE NOT NULL,
  activity_code   VARCHAR(64) NOT NULL DEFAULT '',
  product_id      VARCHAR(64) NOT NULL DEFAULT '',
  binding_type    VARCHAR(64) NOT NULL DEFAULT '',
  trigger_event   VARCHAR(64) NOT NULL DEFAULT '',
  user_scope      VARCHAR(32) NOT NULL DEFAULT 'all',
  sort_no         INTEGER     NOT NULL DEFAULT 0,
  status          VARCHAR(32) NOT NULL DEFAULT 'enabled',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 索引 ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_entry_instances_entry_type  ON entry_instances(entry_type);
CREATE INDEX IF NOT EXISTS idx_entry_instances_status      ON entry_instances(status);
CREATE INDEX IF NOT EXISTS idx_activities_status           ON activities(status);
CREATE INDEX IF NOT EXISTS idx_activities_activity_type    ON activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_act_participations_act_id   ON activity_participations(activity_id);
CREATE INDEX IF NOT EXISTS idx_act_participations_user_id  ON activity_participations(user_id);
CREATE INDEX IF NOT EXISTS idx_banners_enabled             ON banners(enabled);
CREATE INDEX IF NOT EXISTS idx_banners_sort_order          ON banners(sort_order);
CREATE INDEX IF NOT EXISTS idx_landing_pages_status        ON landing_pages(status);
