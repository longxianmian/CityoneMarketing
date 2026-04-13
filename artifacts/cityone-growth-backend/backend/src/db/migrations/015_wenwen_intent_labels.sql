-- 015_wenwen_intent_labels.sql
-- 语义召回意图向量库：pgvector + 意图标签表

-- 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 删除旧表（如果存在，开发阶段可重建）
DROP TABLE IF EXISTS wenwen_intent_labels;

-- 意图标签表（每个意图对应一条记录）
CREATE TABLE wenwen_intent_labels (
  id                    SERIAL PRIMARY KEY,
  intent_code           VARCHAR(100) NOT NULL UNIQUE,
  intent_name           VARCHAR(200) NOT NULL,
  label_texts           JSONB        NOT NULL DEFAULT '{}',
  embedding             vector(1536),
  tool_name             VARCHAR(100),
  oss_content_key       VARCHAR(200),
  card_template_key     VARCHAR(100),
  dispatch_mode         VARCHAR(50)  NOT NULL DEFAULT 'tool_then_card',
  intent_scope          VARCHAR(50)  NOT NULL DEFAULT 'in_scope',
  risk_level            VARCHAR(20)           DEFAULT 'low',
  requires_confirmation BOOLEAN               DEFAULT FALSE,
  requires_payment      BOOLEAN               DEFAULT FALSE,
  priority              INTEGER               DEFAULT 10,
  similarity_threshold  FLOAT                 DEFAULT 0.68,
  is_enabled            BOOLEAN               DEFAULT TRUE,
  created_at            TIMESTAMPTZ           DEFAULT NOW(),
  updated_at            TIMESTAMPTZ           DEFAULT NOW()
);

-- IVFFlat 索引（余弦距离，适合文本 embedding）
-- lists=20 适合 < 1000 条记录，后期可调大
CREATE INDEX IF NOT EXISTS idx_wenwen_intent_labels_embedding
  ON wenwen_intent_labels USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 20);

CREATE INDEX IF NOT EXISTS idx_wenwen_intent_labels_code
  ON wenwen_intent_labels (intent_code)
  WHERE is_enabled = TRUE;
