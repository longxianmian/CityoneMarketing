-- 014_activities_game_fields.sql
-- 补齐 activities 表缺失的游戏相关字段，以及 mall_items 表缺失的配送类型字段

-- 1. activities 表：游戏程序 ID（关联 game_programs 表）
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS game_program_id TEXT NOT NULL DEFAULT '';

-- 2. activities 表：游戏配置（JSON，存储转盘格数/初始次数/刮刮卡阈值等）
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS game_config JSONB NOT NULL DEFAULT '{}';

-- 3. mall_items 表：配送方式（courier=快递 | pickup=到店自取）
ALTER TABLE mall_items
  ADD COLUMN IF NOT EXISTS delivery_type TEXT NOT NULL DEFAULT 'courier';
