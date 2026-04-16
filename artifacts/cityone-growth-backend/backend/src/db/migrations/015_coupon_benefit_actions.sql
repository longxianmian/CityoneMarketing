-- 015_coupon_benefit_actions.sql
-- 为卡券补充正式的权益动作配置：动作类型 + 关联商品

ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS benefit_action_type TEXT NOT NULL DEFAULT 'benefit_detail';

ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS linked_mall_item_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_coupons_linked_mall_item_id
  ON coupons(linked_mall_item_id);
