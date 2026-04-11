-- 013_fix_physical_coupons.sql
-- 修正实物礼品卡券的 item_type 字段
-- 冰气风扇等实物礼品券应标记为 physical，确保前端正确分流弹窗

UPDATE coupons
SET item_type = 'physical'
WHERE id = 'coupon_003';

-- 如未来有更多实物礼品券（discount_type = free_order 且名称含实物词），可在此追加
-- 通用规则：管理员创建实物商品券时需在 item_type 字段填写 'physical'
