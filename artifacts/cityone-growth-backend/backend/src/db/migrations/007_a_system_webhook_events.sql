-- 007_a_system_webhook_events.sql
-- A 系统 Webhook 事件接收日志表
-- 用途：幂等去重、全链路追踪、失败可重试

CREATE TABLE IF NOT EXISTS a_system_webhook_events (
  -- 自增主键（内部用）
  id               SERIAL         PRIMARY KEY,

  -- A 系统事件全局唯一 ID（幂等键）
  event_id         VARCHAR(200)   NOT NULL UNIQUE,

  -- 事件类型：device_borrow | station_sync
  event_type       VARCHAR(50)    NOT NULL DEFAULT '',

  -- 完整原始 payload（JSON）
  payload_json     JSONB          NOT NULL DEFAULT '{}',

  -- 处理状态：pending | processing | success | failed | duplicate
  process_status   VARCHAR(20)    NOT NULL DEFAULT 'pending',

  -- 反查后得到的增长系统站点编码
  station_code     VARCHAR(50)    NOT NULL DEFAULT '',

  -- 反查后得到的入口编码
  entry_code       VARCHAR(50)    NOT NULL DEFAULT '',

  -- 触发的活动 ID
  activity_id      VARCHAR(100)   NOT NULL DEFAULT '',

  -- 触发奖励的用户（line_user_id 或 a_system_user_id）
  user_id          VARCHAR(200)   NOT NULL DEFAULT '',

  -- 本次发放积分数
  points_awarded   INTEGER        NOT NULL DEFAULT 0,

  -- 处理失败时的错误信息
  error_message    TEXT           NOT NULL DEFAULT '',

  -- 接收时间（UTC）
  received_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  -- 处理完成时间（UTC）
  processed_at     TIMESTAMPTZ
);

-- 幂等快速查询：通过 event_id 去重
CREATE INDEX IF NOT EXISTS idx_a_system_webhook_events_event_id
  ON a_system_webhook_events (event_id);

-- 运营查询：按接收时间降序
CREATE INDEX IF NOT EXISTS idx_a_system_webhook_events_received_at
  ON a_system_webhook_events (received_at DESC);

-- 状态过滤：查找失败/待处理事件用于补偿
CREATE INDEX IF NOT EXISTS idx_a_system_webhook_events_status
  ON a_system_webhook_events (process_status);

COMMENT ON TABLE a_system_webhook_events IS 'A 系统 Webhook 事件接收日志：幂等去重 + 全链路追踪';
COMMENT ON COLUMN a_system_webhook_events.event_id IS '幂等键，A 系统全局唯一，重复投递时跳过处理';
COMMENT ON COLUMN a_system_webhook_events.process_status IS 'pending=待处理, processing=处理中, success=成功, failed=失败, duplicate=幂等跳过';
