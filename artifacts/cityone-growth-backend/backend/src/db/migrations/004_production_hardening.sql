-- 第二批第2份 生产级压实补充
-- Task 1: 活动参与幂等唯一约束
-- Task 2: 归因快照字段补齐
-- Task 3: 状态字段检查备注（程序级，此处仅补缺失约束）

-- ─── Task 1: activity_participations 幂等唯一约束 ─────────────────────────
-- 防止并发重复参与：同一用户对同一活动只允许一条参与记录
ALTER TABLE activity_participations
  ADD CONSTRAINT uniq_participation_user UNIQUE (activity_id, user_id);

-- ─── Task 2a: activity_participations 补归因快照字段 ────────────────────
ALTER TABLE activity_participations ADD COLUMN IF NOT EXISTS source_landing_id VARCHAR(64) NOT NULL DEFAULT '';

-- ─── Task 2b: points_ledger 补归因快照字段 ──────────────────────────────
-- source_landing_id: 来源落地页
ALTER TABLE points_ledger ADD COLUMN IF NOT EXISTS source_landing_id  VARCHAR(64) NOT NULL DEFAULT '';
-- source_banner_id: 来源 Banner（原表已有 source_activity_id / source_entry_id）
ALTER TABLE points_ledger ADD COLUMN IF NOT EXISTS source_banner_id   VARCHAR(64) NOT NULL DEFAULT '';

-- ─── 说明 ───────────────────────────────────────────────────────────────────
-- activity_participations 归因字段完整清单（压实后）：
--   source_entry_id       入口编码
--   source_landing_id     落地页编码  ← 本次新增
--   source_banner_id      Banner编码  ← 003 已加
--   source_share_id       分享溯源
--   source_channel_id     渠道来源
--   device_code           设备码（预留）
--   a_system_device_id    A系统设备ID（预留）
--   a_system_user_id      A系统用户ID
--
-- points_ledger 归因字段完整清单（压实后）：
--   source_entry_id       入口编码
--   source_activity_id    活动编码
--   source_landing_id     落地页编码  ← 本次新增
--   source_banner_id      Banner编码  ← 本次新增
--   source_share_id       分享溯源
--   source_channel_id     渠道来源
