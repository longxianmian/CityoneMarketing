-- =============================================================================
-- 011_performance_indexes.sql
-- 补充高频查询所需索引，消除全表扫描 ORDER BY / COUNT(*)
-- =============================================================================

-- points_ledger: ORDER BY created_at DESC (最常用排序)
CREATE INDEX IF NOT EXISTS idx_points_ledger_created_at
  ON points_ledger(created_at DESC);

-- points_ledger: 按 ref_type 过滤
CREATE INDEX IF NOT EXISTS idx_points_ledger_ref_type
  ON points_ledger(ref_type);

-- points_accounts: ORDER BY updated_at DESC / total_points DESC
CREATE INDEX IF NOT EXISTS idx_points_accounts_updated_at
  ON points_accounts(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_points_accounts_total_pts
  ON points_accounts(total_points DESC);

-- share_relations: ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_share_relations_created_at
  ON share_relations(created_at DESC);

-- consume_relations: ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_consume_relations_created_at
  ON consume_relations(created_at DESC);

-- user_coupons: ORDER BY created_at DESC + status 过滤
CREATE INDEX IF NOT EXISTS idx_user_coupons_created_at
  ON user_coupons(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_coupons_product_status
  ON user_coupons(product_status);

-- mall_redeems: ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_mall_redeems_created_at
  ON mall_redeems(created_at DESC);

-- entry_instances: ORDER BY created_at DESC + station_code 过滤 (推广码列表)
CREATE INDEX IF NOT EXISTS idx_entry_instances_created_at
  ON entry_instances(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entry_instances_station_entry
  ON entry_instances(station_code, entry_type);
