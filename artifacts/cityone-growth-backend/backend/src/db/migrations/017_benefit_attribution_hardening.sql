-- 017_benefit_attribution_hardening.sql
-- 为 user_coupons / mall_redeems 补齐生产级归因快照字段，
-- 让卡券领取、活动发券、商品兑换都能回查到入口/落地页/Banner/站点/设备来源。

ALTER TABLE user_coupons
  ADD COLUMN IF NOT EXISTS source_landing_id          VARCHAR(64)   NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_banner_id           VARCHAR(64)   NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_station_code        VARCHAR(64)   NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_a_system_station_id VARCHAR(128)  NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_device_code         VARCHAR(128)  NOT NULL DEFAULT '';

ALTER TABLE mall_redeems
  ADD COLUMN IF NOT EXISTS source_coupon_id           VARCHAR(64)   NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_landing_id          VARCHAR(64)   NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_banner_id           VARCHAR(64)   NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_station_code        VARCHAR(64)   NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_a_system_station_id VARCHAR(128)  NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_device_code         VARCHAR(128)  NOT NULL DEFAULT '';

COMMENT ON COLUMN user_coupons.source_landing_id IS '用户券领取/发放时的落地页归因快照';
COMMENT ON COLUMN user_coupons.source_banner_id IS '用户券领取/发放时的 Banner 归因快照';
COMMENT ON COLUMN user_coupons.source_station_code IS '用户券领取/发放时的站点归因快照';
COMMENT ON COLUMN user_coupons.source_a_system_station_id IS '用户券领取/发放时的 A 系统站点归因快照';
COMMENT ON COLUMN user_coupons.source_device_code IS '用户券领取/发放时的设备编码归因快照';

COMMENT ON COLUMN mall_redeems.source_coupon_id IS '商城兑换由卡券触发时的来源券ID';
COMMENT ON COLUMN mall_redeems.source_landing_id IS '兑换时的落地页归因快照';
COMMENT ON COLUMN mall_redeems.source_banner_id IS '兑换时的 Banner 归因快照';
COMMENT ON COLUMN mall_redeems.source_station_code IS '兑换时的站点归因快照';
COMMENT ON COLUMN mall_redeems.source_a_system_station_id IS '兑换时的 A 系统站点归因快照';
COMMENT ON COLUMN mall_redeems.source_device_code IS '兑换时的设备编码归因快照';

