-- 009_coupon_physical_delivery.sql
-- 为卡券系统增加实物礼品支持：item_type 字段 + user_coupons 配送字段

-- 1. coupons 表增加 item_type（digital=服务/数字券，physical=实物礼品券）
ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) NOT NULL DEFAULT 'digital';

-- 2. user_coupons 表增加配送字段（仅实物卡券领取时填写）
ALTER TABLE user_coupons
  ADD COLUMN IF NOT EXISTS delivery_type    VARCHAR(20),   -- courier | pickup
  ADD COLUMN IF NOT EXISTS delivery_name    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS delivery_phone   VARCHAR(50),
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS pickup_name      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS pickup_phone     VARCHAR(50),
  ADD COLUMN IF NOT EXISTS shipping_status  VARCHAR(20);   -- pending | shipped | delivered
