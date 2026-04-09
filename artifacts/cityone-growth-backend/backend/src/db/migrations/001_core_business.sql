-- =============================================================================
-- 001_core_business.sql
-- CityOne Growth System — 第一批核心业务表
-- 覆盖：卡券、用户卡券、商品、兑换订单、积分账户、积分流水、分享归因、消费归因、媒体资产
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 媒体资产（OSS 上传记录）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media_assets (
  id           VARCHAR(100)  PRIMARY KEY,
  bucket       VARCHAR(100),
  object_key   TEXT          NOT NULL,
  url          TEXT,
  mime_type    VARCHAR(100),
  size_bytes   BIGINT,
  storage      VARCHAR(20)   DEFAULT 'oss',
  module_type  VARCHAR(50),
  uploader_id  VARCHAR(100),
  status       VARCHAR(20)   DEFAULT 'active',
  created_at   TIMESTAMPTZ   DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 卡券主表
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coupons (
  id             VARCHAR(50)   PRIMARY KEY,
  name           JSONB         NOT NULL,          -- {zh, th, en}
  coupon_type    VARCHAR(50)   NOT NULL DEFAULT 'general',
  discount_type  VARCHAR(50),
  discount_value NUMERIC(10,2) DEFAULT 0,
  min_amount     NUMERIC(10,2) DEFAULT 0,
  total_count    INTEGER       DEFAULT 0,
  claimed_count  INTEGER       DEFAULT 0,
  status         SMALLINT      DEFAULT 1,         -- 1=启用 0=停用
  valid_from     TIMESTAMPTZ,
  valid_to       TIMESTAMPTZ,
  cover_image    TEXT,
  cover_video    TEXT,
  station_scope  JSONB         DEFAULT '{"type":"all"}',
  created_at     TIMESTAMPTZ   DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 用户卡券领取记录
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_coupons (
  id                   VARCHAR(100)  PRIMARY KEY,
  line_user_id         VARCHAR(100),
  user_id              VARCHAR(100),
  coupon_id            VARCHAR(50)   NOT NULL,
  product_status       VARCHAR(20)   DEFAULT 'claimed', -- claimed, used, expired, revoked
  source_type          VARCHAR(50),
  source_id            VARCHAR(100),
  -- 归因字段
  source_entry_id      VARCHAR(100),
  source_activity_id   VARCHAR(100),
  source_share_id      VARCHAR(100),
  source_channel_id    VARCHAR(100),
  source_device_id     VARCHAR(100),
  a_system_user_id     VARCHAR(100),
  a_system_device_id   VARCHAR(100),
  -- 时间
  claimed_at           TIMESTAMPTZ   DEFAULT NOW(),
  used_at              TIMESTAMPTZ,
  expired_at           TIMESTAMPTZ,
  station_id           VARCHAR(100),
  created_at           TIMESTAMPTZ   DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_coupons_user    ON user_coupons(user_id);
CREATE INDEX IF NOT EXISTS idx_user_coupons_line    ON user_coupons(line_user_id);
CREATE INDEX IF NOT EXISTS idx_user_coupons_coupon  ON user_coupons(coupon_id);

-- -----------------------------------------------------------------------------
-- 积分商城商品
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mall_items (
  id               VARCHAR(100)  PRIMARY KEY,
  name             JSONB         NOT NULL,        -- {zh, th, en}
  item_type        VARCHAR(50)   NOT NULL DEFAULT 'digital',  -- digital, physical, service, voucher, ai, flash
  exchange_mode    VARCHAR(20)   DEFAULT 'points',            -- points, mix, cash
  price_thb        NUMERIC(10,2),
  points_required  INTEGER       DEFAULT 0,
  stock            INTEGER       DEFAULT -1,       -- -1 = 不限库存
  on_shelf         BOOLEAN       DEFAULT FALSE,
  cover_image      TEXT,
  cover_video      TEXT,
  description      JSONB,
  detail_title     JSONB,
  highlights       JSONB,
  rules            JSONB,
  tag              VARCHAR(50),
  badge            VARCHAR(50),
  sort_order       INTEGER       DEFAULT 0,
  created_at       TIMESTAMPTZ   DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 积分账户（每个用户一条）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS points_accounts (
  user_id            VARCHAR(100)  PRIMARY KEY,
  line_user_id       VARCHAR(100),
  total_points       INTEGER       DEFAULT 0,
  available_points   INTEGER       DEFAULT 0,
  pending_points     INTEGER       DEFAULT 0,
  consumed_points    INTEGER       DEFAULT 0,
  revoked_points     INTEGER       DEFAULT 0,
  -- A 系统旁路映射预留
  a_system_user_id   VARCHAR(100),
  a_system_device_id VARCHAR(100),
  updated_at         TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_points_accounts_line ON points_accounts(line_user_id);

-- -----------------------------------------------------------------------------
-- 积分流水（只追加，不修改）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS points_ledger (
  id                   VARCHAR(100)  PRIMARY KEY,
  user_id              VARCHAR(100),
  line_user_id         VARCHAR(100),
  type                 VARCHAR(50)   NOT NULL,   -- credit, debit, expire, admin_adjust
  points               INTEGER       NOT NULL,
  ref_type             VARCHAR(50),              -- activity, redeem, share, consume, manual_adjust
  ref_id               VARCHAR(100),
  reason               TEXT,
  operator_id          VARCHAR(100),
  -- 归因字段
  source_entry_id      VARCHAR(100),
  source_activity_id   VARCHAR(100),
  source_share_id      VARCHAR(100),
  source_channel_id    VARCHAR(100),
  created_at           TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_points_ledger_user      ON points_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_points_ledger_line_user ON points_ledger(line_user_id);
CREATE INDEX IF NOT EXISTS idx_points_ledger_type      ON points_ledger(type);

-- -----------------------------------------------------------------------------
-- 积分兑换记录（mall_redeems）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mall_redeems (
  id                   VARCHAR(100)  PRIMARY KEY,
  user_id              VARCHAR(100),
  line_user_id         VARCHAR(100),
  item_id              VARCHAR(100)  NOT NULL,
  item_name            JSONB,
  points_spent         INTEGER       DEFAULT 0,
  price_thb            NUMERIC(10,2),
  status               VARCHAR(20)   DEFAULT 'success',  -- success, cancelled, pending
  ledger_id            VARCHAR(100),
  -- 归因字段
  source_entry_id      VARCHAR(100),
  source_activity_id   VARCHAR(100),
  source_channel_id    VARCHAR(100),
  a_system_user_id     VARCHAR(100),
  created_at           TIMESTAMPTZ   DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mall_redeems_user    ON mall_redeems(user_id);
CREATE INDEX IF NOT EXISTS idx_mall_redeems_item    ON mall_redeems(item_id);

-- -----------------------------------------------------------------------------
-- 分享裂变关系链
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS share_relations (
  id                   VARCHAR(100)  PRIMARY KEY,
  sharer_user_id       VARCHAR(100),
  sharer_line_user_id  VARCHAR(100),
  invitee_line_user_id VARCHAR(100),
  share_content_type   VARCHAR(50),
  share_content_id     VARCHAR(100),
  campaign_id          VARCHAR(100),
  follow_status        VARCHAR(20)   DEFAULT 'pending',  -- pending, followed, unfollowed
  points_status        VARCHAR(20)   DEFAULT 'pending',  -- pending, credited, revoked
  points_value         INTEGER       DEFAULT 0,
  -- 归因字段
  source_entry_id      VARCHAR(100),
  source_channel_id    VARCHAR(100),
  created_at           TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_share_relations_sharer   ON share_relations(sharer_user_id);
CREATE INDEX IF NOT EXISTS idx_share_relations_invitee  ON share_relations(invitee_line_user_id);
CREATE INDEX IF NOT EXISTS idx_share_relations_campaign ON share_relations(campaign_id);

-- -----------------------------------------------------------------------------
-- 消费归因（A 系统消费 → 积分发放）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consume_relations (
  id                VARCHAR(100)  PRIMARY KEY,
  user_id           VARCHAR(100),
  line_user_id      VARCHAR(100),
  order_id          VARCHAR(100),
  paid_amount       NUMERIC(10,2),
  pointable_amount  NUMERIC(10,2),
  credited_points   INTEGER       DEFAULT 0,
  revoked_points    INTEGER       DEFAULT 0,
  points_status     VARCHAR(20)   DEFAULT 'pending',  -- pending, credited, revoked
  -- A 系统旁路映射预留
  a_system_order_id  VARCHAR(100),
  a_system_device_id VARCHAR(100),
  created_at         TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consume_relations_user ON consume_relations(user_id);

-- -----------------------------------------------------------------------------
-- 积分规则
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS points_rules (
  rule_id              VARCHAR(100)  PRIMARY KEY,
  rule_type            VARCHAR(50)   NOT NULL,
  description          TEXT,
  points_value         INTEGER       DEFAULT 0,
  revoke_on_unfollow   BOOLEAN       DEFAULT FALSE,
  revoke_window_days   INTEGER       DEFAULT 0,
  enabled              BOOLEAN       DEFAULT TRUE,
  created_at           TIMESTAMPTZ   DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 活动主表（第一版，后续第二批补全字段）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activities (
  activity_id          VARCHAR(100)  PRIMARY KEY,
  activity_name        JSONB,
  activity_type        VARCHAR(50),
  goal                 VARCHAR(50),
  status               VARCHAR(20)   DEFAULT 'draft',  -- draft, active, ended, archived
  cover_image          TEXT,
  cover_video          TEXT,
  campaign_id          VARCHAR(100),
  city_id              VARCHAR(50),
  -- 归因字段
  source_entry_id      VARCHAR(100),
  source_channel_id    VARCHAR(100),
  created_at           TIMESTAMPTZ   DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 活动参与记录
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_participations (
  id                   VARCHAR(100)  PRIMARY KEY,
  activity_id          VARCHAR(100),
  user_id              VARCHAR(100),
  line_user_id         VARCHAR(100),
  points_awarded       INTEGER       DEFAULT 0,
  -- 归因字段
  source_entry_id      VARCHAR(100),
  source_share_id      VARCHAR(100),
  source_channel_id    VARCHAR(100),
  a_system_user_id     VARCHAR(100),
  joined_at            TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_participations_activity ON activity_participations(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_participations_user     ON activity_participations(user_id);
