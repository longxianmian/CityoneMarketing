-- 010_station_promo_qr.sql
-- 为站点推广码（桌贴/海报/店员）新增字段，复用 entry_instances 表

-- 1. 新增店员信息字段（仅 staff_qr 类型使用）
ALTER TABLE entry_instances
  ADD COLUMN IF NOT EXISTS staff_name VARCHAR(64)  NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS staff_no   VARCHAR(32)  NOT NULL DEFAULT '';

-- 2. 新增扫码计数字段（用于快速展示，精确数据从归因表实时查询）
ALTER TABLE entry_instances
  ADD COLUMN IF NOT EXISTS scan_count INTEGER NOT NULL DEFAULT 0;

-- 3. 索引：按站点+类型快速查推广码
CREATE INDEX IF NOT EXISTS idx_entry_instances_station_type
  ON entry_instances (station_code, entry_type);
