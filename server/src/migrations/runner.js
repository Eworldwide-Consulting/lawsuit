// Versioned migration runner — runs each migration file exactly once.
// Tracks applied migrations in a `_migrations` table (schema-version record).
//
// Usage:
//   const { runMigrations } = require('./migrations/runner');
//   await runMigrations(); // call during app boot

const path   = require('path');
const fs     = require('fs');
const { one, run, all } = require('../db');
const logger = require('../logger');

function getDbType() {
  // Avoid circular dep: read the singleton db object directly
  try { return require('../database').getDb().type; } catch { return 'sqlite'; }
}

async function ensureMigrationsTable() {
  const dbType = getDbType();
  if (dbType === 'mysql') {
    await run(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         BIGINT AUTO_INCREMENT PRIMARY KEY,
        name       VARCHAR(255) UNIQUE NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } else {
    // SQLite + PostgreSQL: INTEGER PRIMARY KEY is auto-incrementing rowid
    await run(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         INTEGER PRIMARY KEY,
        name       VARCHAR(255) UNIQUE NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
}

async function getApplied() {
  const rows = await all(`SELECT name FROM _migrations ORDER BY id ASC`);
  return new Set(rows.map(r => r.name));
}

async function runMigrations() {
  await ensureMigrationsTable();
  const applied = await getApplied();
  const dbType  = getDbType();

  const dir = path.join(__dirname, 'versions');
  if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); return; }

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.js'))
    .sort(); // lexicographic — prefix files with 001_, 002_, etc.

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;

    logger.info({ migration: file }, 'Applying migration');
    const migration = require(path.join(dir, file));

    if (typeof migration.up !== 'function')
      throw new Error(`Migration ${file} must export an up() function`);

    await migration.up({ run, one, all, dbType });
    await run(`INSERT INTO _migrations (name) VALUES (?)`, [file]);
    count++;
    logger.info({ migration: file }, 'Migration applied');
  }

  if (count > 0) logger.info({ count }, 'Migrations complete');
}

module.exports = { runMigrations };