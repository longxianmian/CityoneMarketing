-- 016_mall_redeem_delivery_fields.sql
-- 为 mall_redeems 补齐配送字段，支持卡券兑换实物商品闭环

ALTER TABLE mall_redeems
  ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS delivery_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS delivery_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS delivery_station_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS shipping_status VARCHAR(20);
