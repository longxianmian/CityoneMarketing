-- Migration 006: stations 生产级压实
-- 第二批第3份补充整改：A系统字段防重 + 站点归因快照字段 + entries station_code 增补

-- ─── 1. stations A系统字段防重 ─────────────────────────────────────────────
-- 使用部分唯一索引（WHERE != ''）：允许多行空值，但非空值必须全局唯一

CREATE UNIQUE INDEX IF NOT EXISTS uniq_stations_a_system_station_id
  ON stations (a_system_station_id)
  WHERE a_system_station_id <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_stations_device_code
  ON stations (device_code)
  WHERE device_code <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_stations_a_system_device_id
  ON stations (a_system_device_id)
  WHERE a_system_device_id <> '';

-- ─── 2. activity_participations 补站点归因快照字段 ─────────────────────────
ALTER TABLE activity_participations
  ADD COLUMN IF NOT EXISTS source_station_code         VARCHAR(64) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_a_system_station_id  VARCHAR(128) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_device_code          VARCHAR(128) NOT NULL DEFAULT '';

-- ─── 3. points_ledger 补站点归因快照字段 ───────────────────────────────────
ALTER TABLE points_ledger
  ADD COLUMN IF NOT EXISTS source_station_code         VARCHAR(64) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_a_system_station_id  VARCHAR(128) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_device_code          VARCHAR(128) NOT NULL DEFAULT '';

COMMENT ON COLUMN activity_participations.source_station_code        IS '参与时的站点归因快照 (stations.station_code)';
COMMENT ON COLUMN activity_participations.source_a_system_station_id IS '参与时的A系统站点ID归因快照';
COMMENT ON COLUMN activity_participations.source_device_code         IS '参与时的设备编码归因快照';

COMMENT ON COLUMN points_ledger.source_station_code                  IS '积分流水站点归因快照 (stations.station_code)';
COMMENT ON COLUMN points_ledger.source_a_system_station_id           IS '积分流水A系统站点ID归因快照';
COMMENT ON COLUMN points_ledger.source_device_code                   IS '积分流水设备编码归因快照';
