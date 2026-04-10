-- 008_mall_item_type_refactor.sql
-- 商品分类重构：顶层改为 digital / physical，增加 sub_type 和 is_flash_sale

-- 1. 增加 sub_type 字段（数字商品小类）
ALTER TABLE mall_items
  ADD COLUMN IF NOT EXISTS sub_type VARCHAR(50) DEFAULT NULL;

-- 2. 增加 is_flash_sale 字段（是否为限时秒杀促销商品）
ALTER TABLE mall_items
  ADD COLUMN IF NOT EXISTS is_flash_sale BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. 迁移旧 item_type 值到新体系
--    voucher → digital + sub_type=coupon_code
--    ai      → digital + sub_type=ai_benefit
--    flash   → digital + is_flash_sale=true
--    physical → 保持不变

UPDATE mall_items SET item_type = 'digital', sub_type = 'coupon_code'
  WHERE item_type = 'voucher';

UPDATE mall_items SET item_type = 'digital', sub_type = 'ai_benefit'
  WHERE item_type = 'ai';

UPDATE mall_items SET item_type = 'digital', is_flash_sale = TRUE
  WHERE item_type = 'flash';
