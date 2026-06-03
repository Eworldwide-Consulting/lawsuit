const Database = require('better-sqlite3');
const path = require('path');
const { Pool } = require('pg');

let db;

const isProductionDb = () => process.env.NODE_ENV === 'production';

function getDb() {
  if (db) return db;
  if (isProductionDb()) {
    const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL or SUPABASE_DB_URL is required in production');
    }
    const pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });
    pool.on('error', err => console.error('Postgres pool error', err));
    db = { type: 'postgres', pool };
  } else {
    const dbPath = process.env.DB_PATH || path.join(__dirname, '../../trivanta.db');
    const sqlite = new Database(dbPath);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
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
}

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
      user_id INTEGER UNIQUE REFERENCES users(id),
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
      matter_id INTEGER REFERENCES matters(id),
      user_id   INTEGER REFERENCES users(id),
      name      TEXT NOT NULL,
      category  TEXT,
      doc_type  TEXT,
      file_path TEXT,
      file_size INTEGER,
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
  `);

  addSqliteColumnIfMissing(d, 'users', 'email_verified', 'email_verified INTEGER DEFAULT 0');
  addSqliteColumnIfMissing(d, 'users', 'verification_token', 'verification_token TEXT');
  addSqliteColumnIfMissing(d, 'users', 'verification_token_expires', 'verification_token_expires TEXT');
  addSqliteColumnIfMissing(d, 'users', 'two_fa_enabled', 'two_fa_enabled INTEGER DEFAULT 0');
  addSqliteColumnIfMissing(d, 'users', 'two_fa_secret', 'two_fa_secret TEXT');
  addSqliteColumnIfMissing(d, 'users', 'approval_status', 'approval_status TEXT');
  addSqliteColumnIfMissing(d, 'users', 'avatar_initials', 'avatar_initials TEXT');
  addSqliteColumnIfMissing(d, 'users', 'created_at', 'created_at TEXT');
  addSqliteColumnIfMissing(d, 'users', 'updated_at', 'updated_at TEXT');

  addSqliteColumnIfMissing(d, 'matters', 'urgent', 'urgent INTEGER DEFAULT 0');
  addSqliteColumnIfMissing(d, 'matters', 'important_date', 'important_date TEXT');
  addSqliteColumnIfMissing(d, 'matters', 'has_documents', 'has_documents INTEGER DEFAULT 0');
  addSqliteColumnIfMissing(d, 'matters', 'worked_with_firm_before', 'worked_with_firm_before INTEGER DEFAULT 0');
  addSqliteColumnIfMissing(d, 'matters', 'additional_notes', 'additional_notes TEXT');
  addSqliteColumnIfMissing(d, 'matters', 'created_at', 'created_at TEXT');
  addSqliteColumnIfMissing(d, 'matters', 'updated_at', 'updated_at TEXT');

  addSqliteColumnIfMissing(d, 'documents', 'doc_type', 'doc_type TEXT');
  addSqliteColumnIfMissing(d, 'documents', 'file_path', 'file_path TEXT');
  addSqliteColumnIfMissing(d, 'documents', 'file_size', 'file_size INTEGER');
  addSqliteColumnIfMissing(d, 'documents', 'status', "status TEXT DEFAULT 'pending'");
  addSqliteColumnIfMissing(d, 'documents', 'required', 'required INTEGER DEFAULT 0');
  addSqliteColumnIfMissing(d, 'documents', 'created_at', 'created_at TEXT');

  addSqliteColumnIfMissing(d, 'messages', 'read_at', 'read_at TEXT');
  addSqliteColumnIfMissing(d, 'messages', 'created_at', 'created_at TEXT');

  addSqliteColumnIfMissing(d, 'appointments', 'end_time', 'end_time TEXT');
  addSqliteColumnIfMissing(d, 'appointments', 'notes', 'notes TEXT');
  addSqliteColumnIfMissing(d, 'appointments', 'created_at', 'created_at TEXT');

  addSqliteColumnIfMissing(d, 'tasks', 'status', "status TEXT DEFAULT 'pending'");
  addSqliteColumnIfMissing(d, 'tasks', 'priority', "priority TEXT DEFAULT 'normal'");
  addSqliteColumnIfMissing(d, 'tasks', 'action_label', 'action_label TEXT');
  addSqliteColumnIfMissing(d, 'tasks', 'created_at', 'created_at TEXT');

  addSqliteColumnIfMissing(d, 'invoices', 'stripe_session_id', 'stripe_session_id TEXT');
  addSqliteColumnIfMissing(d, 'invoices', 'stripe_payment_intent_id', 'stripe_payment_intent_id TEXT');
  addSqliteColumnIfMissing(d, 'invoices', 'currency', "currency TEXT DEFAULT 'usd'");
  addSqliteColumnIfMissing(d, 'invoices', 'service_type', "service_type TEXT DEFAULT 'general'");
  addSqliteColumnIfMissing(d, 'invoices', 'status', "status TEXT DEFAULT 'pending'");
  addSqliteColumnIfMissing(d, 'invoices', 'due_date', 'due_date TEXT');
  addSqliteColumnIfMissing(d, 'invoices', 'paid_at', 'paid_at TEXT');
  addSqliteColumnIfMissing(d, 'invoices', 'created_at', 'created_at TEXT');
}

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
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE REFERENCES users(id),
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
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      matter_id INTEGER REFERENCES matters(id),
      user_id   INTEGER REFERENCES users(id),
      name      TEXT NOT NULL,
      category  TEXT,
      doc_type  TEXT,
      file_path TEXT,
      file_size INTEGER,
      status    TEXT DEFAULT 'pending',
      required  INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      matter_id    INTEGER REFERENCES matters(id),
      from_user_id INTEGER REFERENCES users(id),
      to_user_id   INTEGER REFERENCES users(id),
      subject TEXT,
      body    TEXT NOT NULL,
      read_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY,
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
      id SERIAL PRIMARY KEY,
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
      due_date TEXT,
      paid_at  TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await addPostgresColumnIfMissing(pool, 'users', 'email_verified', 'email_verified INTEGER DEFAULT 0');
  await addPostgresColumnIfMissing(pool, 'users', 'verification_token', 'verification_token TEXT');
  await addPostgresColumnIfMissing(pool, 'users', 'verification_token_expires', 'verification_token_expires TEXT');
  await addPostgresColumnIfMissing(pool, 'users', 'two_fa_enabled', 'two_fa_enabled INTEGER DEFAULT 0');
  await addPostgresColumnIfMissing(pool, 'users', 'two_fa_secret', 'two_fa_secret TEXT');
  await addPostgresColumnIfMissing(pool, 'users', 'approval_status', 'approval_status TEXT');
  await addPostgresColumnIfMissing(pool, 'users', 'avatar_initials', 'avatar_initials TEXT');
  await addPostgresColumnIfMissing(pool, 'users', 'created_at', 'created_at TEXT');
  await addPostgresColumnIfMissing(pool, 'users', 'updated_at', 'updated_at TEXT');

  await addPostgresColumnIfMissing(pool, 'matters', 'urgent', 'urgent INTEGER DEFAULT 0');
  await addPostgresColumnIfMissing(pool, 'matters', 'important_date', 'important_date TEXT');
  await addPostgresColumnIfMissing(pool, 'matters', 'has_documents', 'has_documents INTEGER DEFAULT 0');
  await addPostgresColumnIfMissing(pool, 'matters', 'worked_with_firm_before', 'worked_with_firm_before INTEGER DEFAULT 0');
  await addPostgresColumnIfMissing(pool, 'matters', 'additional_notes', 'additional_notes TEXT');
  await addPostgresColumnIfMissing(pool, 'matters', 'created_at', 'created_at TEXT');
  await addPostgresColumnIfMissing(pool, 'matters', 'updated_at', 'updated_at TEXT');

  await addPostgresColumnIfMissing(pool, 'documents', 'doc_type', 'doc_type TEXT');
  await addPostgresColumnIfMissing(pool, 'documents', 'file_path', 'file_path TEXT');
  await addPostgresColumnIfMissing(pool, 'documents', 'file_size', 'file_size INTEGER');
  await addPostgresColumnIfMissing(pool, 'documents', 'status', "status TEXT DEFAULT 'pending'");
  await addPostgresColumnIfMissing(pool, 'documents', 'required', 'required INTEGER DEFAULT 0');
  await addPostgresColumnIfMissing(pool, 'documents', 'created_at', 'created_at TEXT');

  await addPostgresColumnIfMissing(pool, 'messages', 'read_at', 'read_at TEXT');
  await addPostgresColumnIfMissing(pool, 'messages', 'created_at', 'created_at TEXT');

  await addPostgresColumnIfMissing(pool, 'appointments', 'end_time', 'end_time TEXT');
  await addPostgresColumnIfMissing(pool, 'appointments', 'notes', 'notes TEXT');
  await addPostgresColumnIfMissing(pool, 'appointments', 'created_at', 'created_at TEXT');

  await addPostgresColumnIfMissing(pool, 'tasks', 'status', "status TEXT DEFAULT 'pending'");
  await addPostgresColumnIfMissing(pool, 'tasks', 'priority', "priority TEXT DEFAULT 'normal'");
  await addPostgresColumnIfMissing(pool, 'tasks', 'action_label', 'action_label TEXT');
  await addPostgresColumnIfMissing(pool, 'tasks', 'created_at', 'created_at TEXT');

  await addPostgresColumnIfMissing(pool, 'invoices', 'stripe_session_id', 'stripe_session_id TEXT');
  await addPostgresColumnIfMissing(pool, 'invoices', 'stripe_payment_intent_id', 'stripe_payment_intent_id TEXT');
  await addPostgresColumnIfMissing(pool, 'invoices', 'currency', "currency TEXT DEFAULT 'usd'");
  await addPostgresColumnIfMissing(pool, 'invoices', 'service_type', "service_type TEXT DEFAULT 'general'");
  await addPostgresColumnIfMissing(pool, 'invoices', 'status', "status TEXT DEFAULT 'pending'");
  await addPostgresColumnIfMissing(pool, 'invoices', 'due_date', 'due_date TEXT');
  await addPostgresColumnIfMissing(pool, 'invoices', 'paid_at', 'paid_at TEXT');
  await addPostgresColumnIfMissing(pool, 'invoices', 'created_at', 'created_at TEXT');
}

module.exports = { getDb, initDatabase };
