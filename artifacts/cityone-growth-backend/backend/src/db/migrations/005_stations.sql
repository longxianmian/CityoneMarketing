-- Migration 005: stations 正式落库 + entry_instances 关联字段补全
-- 第二批第3份：站点与 A 系统旁路连接预留整改

-- ─── 1. 站点主表 ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stations (
  id                    SERIAL PRIMARY KEY,
  station_code          VARCHAR(64)  NOT NULL UNIQUE,
  station_name          JSONB        NOT NULL DEFAULT '{}',
  station_type          VARCHAR(32)  NOT NULL DEFAULT 'powerbank',
  status                VARCHAR(32)  NOT NULL DEFAULT 'active',
  country_code          VARCHAR(8)   NOT NULL DEFAULT 'TH',
  city_code             VARCHAR(64)  NOT NULL DEFAULT '',
  district              VARCHAR(64)  NOT NULL DEFAULT '',
  address               TEXT         NOT NULL DEFAULT '',
  venue_name            VARCHAR(128) NOT NULL DEFAULT '',
  venue_type            VARCHAR(64)  NOT NULL DEFAULT '',
  latitude              NUMERIC(11, 7) NOT NULL DEFAULT 0,
  longitude             NUMERIC(11, 7) NOT NULL DEFAULT 0,
  capacity              INTEGER      NOT NULL DEFAULT 0,
  available_count       INTEGER      NOT NULL DEFAULT 0,
  source                VARCHAR(32)  NOT NULL DEFAULT 'manual',
  source_channel_id     VARCHAR(64)  NOT NULL DEFAULT '',
  -- 与增长主链路的软引用（不加 FK，营销与站点生命周期解耦）
  entry_code            VARCHAR(64)  NOT NULL DEFAULT '',
  landing_code          VARCHAR(64)  NOT NULL DEFAULT '',
  default_activity_id   VARCHAR(64)  NOT NULL DEFAULT '',
  -- A 系统旁路连接预留字段
  a_system_station_id   VARCHAR(128) NOT NULL DEFAULT '',
  device_code           VARCHAR(128) NOT NULL DEFAULT '',
  device_group_code     VARCHAR(128) NOT NULL DEFAULT '',
  a_system_device_id    VARCHAR(128) NOT NULL DEFAULT '',
  sort_order            INTEGER      NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stations_city_code    ON stations (city_code);
CREATE INDEX IF NOT EXISTS idx_stations_status       ON stations (status);
CREATE INDEX IF NOT EXISTS idx_stations_entry_code   ON stations (entry_code);
CREATE INDEX IF NOT EXISTS idx_stations_a_sys_st     ON stations (a_system_station_id);

-- ─── 2. entry_instances 补 station_code 正式关联字段 ────────────────────────
-- 原有 site_id/site_name 为遗留字段，保留不动；station_code 为新规范字段
ALTER TABLE entry_instances
  ADD COLUMN IF NOT EXISTS station_code VARCHAR(64) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_entry_instances_station_code
  ON entry_instances (station_code);

COMMENT ON COLUMN entry_instances.station_code IS '正式站点编码（关联 stations.station_code），site_id 为遗留字段';
COMMENT ON COLUMN stations.a_system_station_id IS 'A系统（共享充电宝系统）站点ID预留，对接时填入';
COMMENT ON COLUMN stations.a_system_device_id  IS 'A系统设备ID预留，单站单设备场景使用';
COMMENT ON COLUMN stations.device_code         IS '设备编码，可来自A系统或手动录入';
