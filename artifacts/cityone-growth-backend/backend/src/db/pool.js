/**
 * PostgreSQL 连接池
 * 优先读取 DATABASE_URL（Replit 开发环境 / 生产环境统一入口）
 * 回退到 DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD 拆分变量
 */
import pg from 'pg'

const { Pool } = pg

function buildConfig() {
  if (process.env.DATABASE_URL) {
    const ssl = process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false
    return {
      connectionString: process.env.DATABASE_URL,
      ssl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000,
    }
  }

  // 拆分变量模式（生产服务器推荐）
  const ssl = process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: false }
    : false
  return {
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 8000,
  }
}

const pool = new Pool(buildConfig())

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool client error:', err.message)
})

/**
 * 执行 SQL 查询
 */
export async function query(text, params) {
  try {
    return await pool.query(text, params)
  } catch (err) {
    console.error('[DB] Query error:', err.message, '\nSQL:', text?.substring(0, 200))
    throw err
  }
}

/**
 * 事务包装器 — 积分扣减 / 兑换等原子操作必须使用此函数
 */
export async function withTransaction(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * 验证数据库连通性
 */
export async function testConnection() {
  const res = await pool.query('SELECT NOW() AS now, current_database() AS db, version() AS ver')
  return res.rows[0]
}

export default pool
