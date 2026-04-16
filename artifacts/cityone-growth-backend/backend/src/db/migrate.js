/**
 * 数据库迁移运行器
 * 读取 src/db/migrations/*.sql 文件，按文件名顺序执行未执行的迁移
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { query } from './pool.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const MIGRATIONS_DIR = path.join(__dirname, 'migrations')
const OPTIONAL_MIGRATIONS = new Set([
  '015_wenwen_intent_labels'
])

function shouldSkipMigration(version, err) {
  if (!OPTIONAL_MIGRATIONS.has(version)) {
    return false
  }

  const message = String(err?.message || '').toLowerCase()
  return (
    message.includes('permission denied to create extension') ||
    message.includes('type "vector" does not exist') ||
    message.includes('extension "vector" is not available')
  )
}

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version      VARCHAR(100) PRIMARY KEY,
      executed_at  TIMESTAMPTZ  DEFAULT NOW()
    )
  `)
}

async function getExecutedVersions() {
  const res = await query('SELECT version FROM schema_migrations ORDER BY version')
  return new Set(res.rows.map(r => r.version))
}

async function recordMigration(version) {
  await query('INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING', [version])
}

export async function runMigrations() {
  console.log('[DB] Checking migrations...')
  await ensureMigrationsTable()
  const executed = await getExecutedVersions()

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()

  let ran = 0
  for (const file of files) {
    const version = file.replace('.sql', '')
    if (executed.has(version)) continue

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    console.log(`[DB] Running migration: ${file}`)
    try {
      await query(sql)
      await recordMigration(version)
      ran++
    } catch (err) {
      if (!shouldSkipMigration(version, err)) {
        throw err
      }

      console.warn(`[DB] Optional migration skipped: ${file} (${err.message})`)
    }
  }

  if (ran === 0) {
    console.log('[DB] All migrations up to date.')
  } else {
    console.log(`[DB] Ran ${ran} new migration(s).`)
  }
}
