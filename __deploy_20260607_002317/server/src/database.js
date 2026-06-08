const Database = require('better-sqlite3');
const path = require('path');
const { Pool } = require('pg');
const logger = require('./logger');

let db;

const isProductionDb = () => process.env.NODE_ENV === 'production';

function getDb() {
  if (db) return db;
  if (isProductionDb()) {
    const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
    if (!connectionString) throw new Error('DATABASE_URL or SUPABASE_DB_URL is required in production');

    if (connectionString.startsWith('mysql://') || connectionString.startsWith('mysql2://')) {
      const mysqlRaw = require('mysql2');
      const rawPool = mysqlRaw.createPool({
        uri: connectionString,
        waitForConnections: true,
        connectionLimit: 20,
        queueLimit: 0,
        timezone: 'Z',
      });
      // Make || work as string concat (same as SQLite/PostgreSQL) so no SQL changes needed
      rawPool.on('connection', (conn) => {
        conn.query("SET sql_mode = 'PIPES_AS_CONCAT,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");
      });
      rawPool.on('error', (err) => logger.error({ err: err.message }, 'MySQL pool error'));
      db = { type: 'mysql', pool: rawPool.promise() };
    } else {
      const pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
        max: 20,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      });
      pool.on('error', (err) => logger.error({ err }, 'Postgres pool error'));
      db = { type: 'postgres', pool };
    }
  } else {
    const dbPath = process.env.DB_PATH || path.join(__dirname, '../../trivanta.db');
    const sqlite = new Database(dbPath);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    sqlite.pragma('busy_timeout = 5000');
    initSqliteSchema(sqlite);
    db = { type: 'sqlite', sqlite };
  }
  return db;
}

async function initDatabase() {
  const database = getDb();
  if (database.type === 'postgres') {
    await initPostgresSchema(database.pool);
  }
  // mysql: schema already created via Hostinger phpMyAdmin
  logger.info({ type: database.type }, 'Database initialized');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function addSqliteColumnIfMissing(d, table, column, definition) {
  const existing = d.prepare(`PRAGMA table_info(${table})`).all().find(r => r.name === column);
  if (!existing) d.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

async function addPostgresColumnIfMissing(pool, table, column, definition) {
  const result = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
    [table, column]
  );
  if (result.rowCount === 0) {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

// ── SQLite schema ─────────────────────────────────────────────────────────────

function initSqliteSchema(d) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name  TEXT NOT NULL,
      email      TEXT UNIQUE NOT NULL,
      password_hash TEXT DEFAULT '',
      role       TEXT DEFAULT 'client',
      phone TEXT, dob TEXT, street TEXT, city TEXT, state TEXT, zip TEXT,
      avatar_initials TEXT,
      email_verified INTEGER DEFAULT 0,
      verification_token TEXT,
      verification_token_expires TEXT,
      two_fa_enabled INTEGER DEFAULT 0,
      two_fa_secret  TEXT,
      approval_status TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      bar_number TEXT,
      state_bar TEXT,
      years_experience INTEGER,
      specializations TEXT,
      firm_role TEXT,
      practice_groups TEXT
    );

    CREATE TABLE IF NOT EXISTS matters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id   INTEGER REFERENCES users(id),
      attorney_id INTEGER REFERENCES users(id),
      matter_type TEXT,
      stage  TEXT DEFAULT 'intake',
      status TEXT DEFAULT 'active',
      description TEXT,
      case_number TEXT,
      court TEXT, county TEXT,
      urgent INTEGER DEFAULT 0,
      important_date TEXT,
      has_documents INTEGER DEFAULT 0,
      worked_with_firm_before INTEGER DEFAULT 0,
      additional_notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matter_id INTEGER REFERENCES matters(id) ON DELETE CASCADE,
      user_id   INTEGER REFERENCES users(id),
      name      TEXT NOT NULL,
      category  TEXT,
      doc_type  TEXT,
      file_path TEXT,
      file_size INTEGER,
      mime_type TEXT,
      storage_key TEXT,
      status    TEXT DEFAULT 'pending',
      required  INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matter_id    INTEGER REFERENCES matters(id),
      from_user_id INTEGER REFERENCES users(id),
      to_user_id   INTEGER REFERENCES users(id),
      subject TEXT,
      body    TEXT NOT NULL,
      read_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matter_id  INTEGER REFERENCES matters(id),
      title      TEXT NOT NULL,
      type       TEXT DEFAULT 'teleconference',
      start_time TEXT NOT NULL,
      end_time   TEXT,
      location   TEXT,
      notes      TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matter_id   INTEGER REFERENCES matters(id),
      assigned_to INTEGER REFERENCES users(id),
      title       TEXT NOT NULL,
      description TEXT,
      due_date    TEXT,
      status      TEXT DEFAULT 'pending',
      priority    TEXT DEFAULT 'normal',
      action_label TEXT,
      created_at  TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matter_id  INTEGER REFERENCES matters(id),
      client_id  INTEGER REFERENCES users(id),
      created_by INTEGER REFERENCES users(id),
      stripe_session_id TEXT,
      stripe_payment_intent_id TEXT,
      amount      INTEGER NOT NULL,
      currency    TEXT DEFAULT 'usd',
      description TEXT NOT NULL,
      service_type TEXT DEFAULT 'general',
      status   TEXT DEFAULT 'pending',
      due_date TEXT,
      paid_at  TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER REFERENCES users(id),
      action     TEXT NOT NULL,
      entity     TEXT,
      entity_id  INTEGER,
      meta       TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_matters_client   ON matters(client_id);
    CREATE INDEX IF NOT EXISTS idx_matters_attorney ON matters(attorney_id);
    CREATE INDEX IF NOT EXISTS idx_matters_status   ON matters(status);
    CREATE INDEX IF NOT EXISTS idx_documents_matter ON documents(matter_id);
    CREATE INDEX IF NOT EXISTS idx_messages_to      ON messages(to_user_id, read_at);
    CREATE INDEX IF NOT EXISTS idx_messages_from    ON messages(from_user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_assigned   ON tasks(assigned_to, status);
    CREATE INDEX IF NOT EXISTS idx_invoices_client  ON invoices(client_id, status);
    CREATE INDEX IF NOT EXISTS idx_audit_user       ON audit_log(user_id);
  `);

  // Safe migrations — idempotent column additions
  const cols = [
    ['users', 'email_verified',             'INTEGER DEFAULT 0'],
    ['users', 'verification_token',          'TEXT'],
    ['users', 'verification_token_expires',  'TEXT'],
    ['users', 'two_fa_enabled',              'INTEGER DEFAULT 0'],
    ['users', 'two_fa_secret',               'TEXT'],
    ['users', 'two_fa_prompt_shown',         'INTEGER DEFAULT 0'],
    ['users', 'approval_status',             'TEXT'],
    ['users', 'avatar_initials',             'TEXT'],
    ['users', 'created_at',                  'TEXT'],
    ['users', 'updated_at',                  'TEXT'],
    ['matters', 'urgent',                    'INTEGER DEFAULT 0'],
    ['matters', 'important_date',            'TEXT'],
    ['matters', 'has_documents',             'INTEGER DEFAULT 0'],
    ['matters', 'worked_with_firm_before',   'INTEGER DEFAULT 0'],
    ['matters', 'additional_notes',          'TEXT'],
    ['matters', 'created_at',               'TEXT'],
    ['matters', 'updated_at',               'TEXT'],
    ['documents', 'doc_type',               'TEXT'],
    ['documents', 'file_path',              'TEXT'],
    ['documents', 'file_size',              'INTEGER'],
    ['documents', 'mime_type',              'TEXT'],
    ['documents', 'storage_key',            'TEXT'],
    ['documents', 'status',                 "TEXT DEFAULT 'pending'"],
    ['documents', 'required',               'INTEGER DEFAULT 0'],
    ['documents', 'created_at',             'TEXT'],
    ['messages', 'read_at',                 'TEXT'],
    ['messages', 'created_at',              'TEXT'],
    ['appointments', 'end_time',            'TEXT'],
    ['appointments', 'notes',               'TEXT'],
    ['appointments', 'created_at',          'TEXT'],
    ['tasks', 'status',                     "TEXT DEFAULT 'pending'"],
    ['tasks', 'priority',                   "TEXT DEFAULT 'normal'"],
    ['tasks', 'action_label',               'TEXT'],
    ['tasks', 'created_at',                 'TEXT'],
    ['invoices', 'stripe_session_id',       'TEXT'],
    ['invoices', 'stripe_payment_intent_id','TEXT'],
    ['invoices', 'currency',                "TEXT DEFAULT 'usd'"],
    ['invoices', 'service_type',            "TEXT DEFAULT 'general'"],
    ['invoices', 'status',                  "TEXT DEFAULT 'pending'"],
    ['invoices', 'due_date',                'TEXT'],
    ['invoices', 'paid_at',                 'TEXT'],
    ['invoices', 'created_at',              'TEXT'],
  ];
  for (const [table, col, def] of cols) addSqliteColumnIfMissing(d, table, col, `${col} ${def}`);
}

// ── PostgreSQL schema ─────────────────────────────────────────────────────────

async function initPostgresSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name  TEXT NOT NULL,
      email      TEXT UNIQUE NOT NULL,
      password_hash TEXT DEFAULT '',
      role       TEXT DEFAULT 'client',
      phone TEXT, dob TEXT, street TEXT, city TEXT, state TEXT, zip TEXT,
      avatar_initials TEXT,
      email_verified INTEGER DEFAULT 0,
      verification_token TEXT,
      verification_token_expires TEXT,
      two_fa_enabled INTEGER DEFAULT 0,
      two_fa_secret  TEXT,
      approval_status TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      bar_number TEXT,
      state_bar TEXT,
      years_experience INTEGER,
      specializations TEXT,
      firm_role TEXT,
      practice_groups TEXT
    );

    CREATE TABLE IF NOT EXISTS matters (
      id SERIAL PRIMARY KEY,
      client_id   INTEGER REFERENCES users(id),
      attorney_id INTEGER REFERENCES users(id),
      matter_type TEXT,
      stage  TEXT DEFAULT 'intake',
      status TEXT DEFAULT 'active',
      description TEXT,
      case_number TEXT,
      court TEXT, county TEXT,
      urgent INTEGER DEFAULT 0,
      important_date TEXT,
      has_documents INTEGER DEFAULT 0,
      worked_with_firm_before INTEGER DEFAULT 0,
      additional_notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      matter_id INTEGER REFERENCES matters(id) ON DELETE CASCADE,
      user_id   INTEGER REFERENCES users(id),
      name      TEXT NOT NULL,
      category  TEXT,
      doc_type  TEXT,
      file_path TEXT,
      file_size INTEGER,
      mime_type TEXT,
      storage_key TEXT,
      status    TEXT DEFAULT 'pending',
      required  INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      matter_id    INTEGER REFERENCES matters(id),
      from_user_id INTEGER REFERENCES users(id),
      to_user_id   INTEGER REFERENCES users(id),
      subject TEXT,
      body    TEXT NOT NULL,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY,
      matter_id  INTEGER REFERENCES matters(id),
      title      TEXT NOT NULL,
      type       TEXT DEFAULT 'teleconference',
      start_time TIMESTAMPTZ NOT NULL,
      end_time   TIMESTAMPTZ,
      location   TEXT,
      notes      TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      matter_id   INTEGER REFERENCES matters(id),
      assigned_to INTEGER REFERENCES users(id),
      title       TEXT NOT NULL,
      description TEXT,
      due_date    DATE,
      status      TEXT DEFAULT 'pending',
      priority    TEXT DEFAULT 'normal',
      action_label TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      matter_id  INTEGER REFERENCES matters(id),
      client_id  INTEGER REFERENCES users(id),
      created_by INTEGER REFERENCES users(id),
      stripe_session_id TEXT,
      stripe_payment_intent_id TEXT,
      amount      INTEGER NOT NULL,
      currency    TEXT DEFAULT 'usd',
      description TEXT NOT NULL,
      service_type TEXT DEFAULT 'general',
      status   TEXT DEFAULT 'pending',
      due_date DATE,
      paid_at  TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      user_id    INTEGER REFERENCES users(id),
      action     TEXT NOT NULL,
      entity     TEXT,
      entity_id  INTEGER,
      meta       JSONB,
      ip_address TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_matters_client   ON matters(client_id);
    CREATE INDEX IF NOT EXISTS idx_matters_attorney ON matters(attorney_id);
    CREATE INDEX IF NOT EXISTS idx_matters_status   ON matters(status);
    CREATE INDEX IF NOT EXISTS idx_documents_matter ON documents(matter_id);
    CREATE INDEX IF NOT EXISTS idx_messages_to      ON messages(to_user_id, read_at);
    CREATE INDEX IF NOT EXISTS idx_messages_from    ON messages(from_user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_assigned   ON tasks(assigned_to, status);
    CREATE INDEX IF NOT EXISTS idx_invoices_client  ON invoices(client_id, status);
    CREATE INDEX IF NOT EXISTS idx_audit_user       ON audit_log(user_id);
  `);

  // Safe migrations
  const cols = [
    ['users', 'email_verified',             'INTEGER DEFAULT 0'],
    ['users', 'verification_token',          'TEXT'],
    ['users', 'verification_token_expires',  'TEXT'],
    ['users', 'two_fa_enabled',              'INTEGER DEFAULT 0'],
    ['users', 'two_fa_secret',               'TEXT'],
    ['users', 'two_fa_prompt_shown',         'INTEGER DEFAULT 0'],
    ['users', 'approval_status',             'TEXT'],
    ['users', 'avatar_initials',             'TEXT'],
    ['matters', 'urgent',                    'INTEGER DEFAULT 0'],
    ['matters', 'important_date',            'TEXT'],
    ['matters', 'has_documents',             'INTEGER DEFAULT 0'],
    ['matters', 'worked_with_firm_before',   'INTEGER DEFAULT 0'],
    ['matters', 'additional_notes',          'TEXT'],
    ['documents', 'doc_type',               'TEXT'],
    ['documents', 'file_path',              'TEXT'],
    ['documents', 'file_size',              'INTEGER'],
    ['documents', 'mime_type',              'TEXT'],
    ['documents', 'storage_key',            'TEXT'],
    ['documents', 'required',               'INTEGER DEFAULT 0'],
    ['messages', 'read_at',                 'TIMESTAMPTZ'],
    ['appointments', 'end_time',            'TIMESTAMPTZ'],
    ['appointments', 'notes',               'TEXT'],
    ['tasks', 'action_label',               'TEXT'],
    ['invoices', 'stripe_session_id',       'TEXT'],
    ['invoices', 'stripe_payment_intent_id','TEXT'],
    ['invoices', 'currency',                "TEXT DEFAULT 'usd'"],
    ['invoices', 'service_type',            "TEXT DEFAULT 'general'"],
    ['invoices', 'due_date',                'DATE'],
    ['invoices', 'paid_at',                 'TIMESTAMPTZ'],
  ];
  for (const [table, col, def] of cols) await addPostgresColumnIfMissing(pool, table, col, `${col} ${def}`);
}

module.exports = { getDb, initDatabase };
