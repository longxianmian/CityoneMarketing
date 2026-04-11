/**
 * PostgreSQL 连接池
 * 优先读取 DATABASE_URL（Replit 开发环境 / 生产环境统一入口）
 * 回退到 DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD 拆分变量
 */
import pg from 'pg'

const { Pool } = pg

function buildConfig() {
  const ssl = process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: false }
    : false

  const base = {
    max: 20,
    min: 2,
    idleTimeoutMillis: 120000,
    connectionTimeoutMillis: 8000,
    allowExitOnIdle: false,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  }

  if (process.env.DATABASE_URL) {
    return { ...base, connectionString: process.env.DATABASE_URL, ssl }
  }

  return {
    ...base,
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl,
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

/**
 * 预热连接池 — 启动时提前建立 min 个物理连接，避免首批请求冷启动延迟
 */
export async function warmupPool(count = 2) {
  const clients = []
  try {
    for (let i = 0; i < count; i++) {
      clients.push(await pool.connect())
    }
    console.log(`[DB] Pool warmed up with ${count} connections`)
  } catch (err) {
    console.warn('[DB] Warmup partial failure:', err.message)
  } finally {
    clients.forEach(c => c.release())
  }
}

export default pool
