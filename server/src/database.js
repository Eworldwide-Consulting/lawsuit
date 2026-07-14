const path = require('path');
const { Pool } = require('pg');
const logger = require('./logger');

let db;

const isProductionDb = () => {
  if (process.env.NODE_ENV === 'production') return true;
  // Fall back to remote DB if a connection string is present even without NODE_ENV,
  // so a misconfigured deploy doesn't silently try to open a local SQLite file.
  if (process.env.DATABASE_URL || process.env.SUPABASE_DB_URL) return true;
  return false;
};

function getDb() {
  if (db) return db;
  if (isProductionDb()) {
    const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
    if (!connectionString) throw new Error('DATABASE_URL or SUPABASE_DB_URL is required in production');

    if (connectionString.startsWith('mysql://') || connectionString.startsWith('mysql2://')) {
      const mysqlRaw = require('mysql2');
      // mysql2.createPool({ uri }) is not a documented option — the URI is only
      // parsed when passed as a raw string.  Parse it ourselves so credentials
      // (including %40-encoded @ in passwords) are always extracted correctly.
      const _url = new URL(connectionString.replace(/^mysql2:\/\//, 'mysql://'));
      // MYSQL_SOCKET bypasses TCP entirely — required on Hostinger shared hosting
      // where the user only has UNIX socket grants (u511005792_dbadmin@localhost).
      // Find the path in phpMyAdmin: SHOW VARIABLES LIKE 'socket';
      const socketPath = process.env.MYSQL_SOCKET;
      const networkOpts = socketPath
        ? { socketPath }
        : { host: _url.hostname, port: parseInt(_url.port, 10) || 3306 };
      const rawPool = mysqlRaw.createPool({
        ...networkOpts,
        user:             decodeURIComponent(_url.username),
        password:         process.env.MYSQL_PASS || decodeURIComponent(_url.password),
        database:         _url.pathname.slice(1) || undefined,
        waitForConnections: true,
        connectionLimit:  20,
        queueLimit:       0,
        timezone:         'Z',
        connectTimeout:   10_000,
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
    const Database = require('better-sqlite3');
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
  } else if (database.type === 'mysql') {
    await initMysqlSchema(database.pool);
    await initMysqlColumns(database.pool);
  }
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

async function addMysqlColumnIfMissing(pool, table, column, definition) {
  const [rows] = await pool.execute(
    'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, column]
  );
  if (!rows.length) {
    await pool.execute(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
  }
}

async function initMysqlSchema(pool) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      first_name VARCHAR(255) NOT NULL,
      last_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL DEFAULT '',
      phone VARCHAR(20), dob VARCHAR(10), street VARCHAR(255),
      city VARCHAR(100), state VARCHAR(50), zip VARCHAR(20),
      role VARCHAR(50) DEFAULT 'client',
      two_fa_secret TEXT, two_fa_enabled TINYINT DEFAULT 0,
      two_fa_prompt_shown TINYINT DEFAULT 0,
      avatar_initials VARCHAR(10),
      email_verified TINYINT DEFAULT 0,
      verification_token VARCHAR(255),
      verification_token_expires DATETIME,
      approval_status VARCHAR(50),
      is_prime TINYINT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS user_profiles (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNIQUE,
      bar_number VARCHAR(100), state_bar VARCHAR(100),
      years_experience INT, specializations TEXT,
      firm_role VARCHAR(100), practice_groups TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS matters (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      case_number VARCHAR(100) UNIQUE,
      client_id BIGINT, attorney_id BIGINT,
      matter_type VARCHAR(100),
      stage VARCHAR(50) DEFAULT 'intake',
      status VARCHAR(50) DEFAULT 'active',
      description TEXT, court VARCHAR(255), county VARCHAR(100), state VARCHAR(50),
      urgent TINYINT DEFAULT 0, important_date VARCHAR(20),
      has_documents TINYINT DEFAULT 0,
      worked_with_firm_before TINYINT DEFAULT 0,
      additional_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (attorney_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS documents (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      matter_id BIGINT, user_id BIGINT,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(100), doc_type VARCHAR(100),
      file_path TEXT, file_size BIGINT, mime_type VARCHAR(128),
      storage_key TEXT,
      required TINYINT DEFAULT 0,
      status VARCHAR(50) DEFAULT 'pending',
      review_note TEXT, reviewed_by BIGINT, reviewed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (matter_id) REFERENCES matters(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS messages (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      matter_id BIGINT, from_user_id BIGINT, to_user_id BIGINT,
      subject VARCHAR(255), body TEXT NOT NULL, read_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (matter_id) REFERENCES matters(id),
      FOREIGN KEY (from_user_id) REFERENCES users(id),
      FOREIGN KEY (to_user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS appointments (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      matter_id BIGINT, title VARCHAR(255) NOT NULL,
      type VARCHAR(50) DEFAULT 'teleconference',
      start_time VARCHAR(50) NOT NULL, end_time VARCHAR(50),
      location VARCHAR(255), notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (matter_id) REFERENCES matters(id)
    )`,
    `CREATE TABLE IF NOT EXISTS tasks (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      matter_id BIGINT, assigned_to BIGINT,
      title VARCHAR(255) NOT NULL, description TEXT,
      due_date VARCHAR(20),
      status VARCHAR(50) DEFAULT 'pending',
      priority VARCHAR(50) DEFAULT 'normal',
      action_label VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (matter_id) REFERENCES matters(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS invoices (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      matter_id BIGINT, client_id BIGINT, created_by BIGINT,
      stripe_session_id VARCHAR(255), stripe_payment_intent_id VARCHAR(255),
      amount BIGINT NOT NULL, currency VARCHAR(10) DEFAULT 'usd',
      description TEXT NOT NULL,
      service_type VARCHAR(50) DEFAULT 'general',
      status VARCHAR(50) DEFAULT 'pending',
      due_date VARCHAR(20), paid_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (matter_id) REFERENCES matters(id),
      FOREIGN KEY (client_id) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS audit_log (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT,
      action VARCHAR(100) NOT NULL,
      entity VARCHAR(50), entity_id BIGINT,
      meta TEXT, ip_address VARCHAR(64),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )`,
  ];
  for (const sql of statements) {
    await pool.execute(sql);
  }

  // CREATE INDEX IF NOT EXISTS is only supported in MySQL 8.0.29+ and MariaDB 10.1.4+.
  // For broad compatibility use plain CREATE INDEX and ignore error 1061 (duplicate key
  // name) which means the index already exists — safe to skip on re-deploy.
  const indexes = [
    `CREATE INDEX idx_matters_client   ON matters(client_id)`,
    `CREATE INDEX idx_matters_attorney ON matters(attorney_id)`,
    `CREATE INDEX idx_matters_status   ON matters(status)`,
    `CREATE INDEX idx_documents_matter ON documents(matter_id)`,
    `CREATE INDEX idx_messages_to      ON messages(to_user_id, read_at)`,
    `CREATE INDEX idx_messages_from    ON messages(from_user_id)`,
    `CREATE INDEX idx_tasks_assigned   ON tasks(assigned_to, status)`,
    `CREATE INDEX idx_invoices_client  ON invoices(client_id, status)`,
    `CREATE INDEX idx_audit_user       ON audit_log(user_id)`,
  ];
  for (const sql of indexes) {
    try {
      await pool.execute(sql);
    } catch (err) {
      if (err.errno !== 1061) throw err;
    }
  }
}

async function initMysqlColumns(pool) {
  const cols = [
    ['users', 'two_fa_prompt_shown',        'two_fa_prompt_shown TINYINT(1) DEFAULT 0'],
    ['users', 'two_fa_enabled',             'two_fa_enabled TINYINT(1) DEFAULT 0'],
    ['users', 'two_fa_secret',              'two_fa_secret TEXT'],
    ['users', 'verification_token',         'verification_token TEXT'],
    ['users', 'verification_token_expires', 'verification_token_expires TEXT'],
    ['users', 'avatar_initials',            'avatar_initials VARCHAR(10)'],
    ['users', 'approval_status',            "approval_status VARCHAR(20) DEFAULT 'pending'"],
    ['matters', 'urgent',                   'urgent TINYINT(1) DEFAULT 0'],
    ['matters', 'important_date',           'important_date VARCHAR(32)'],
    ['matters', 'has_documents',            'has_documents TINYINT(1) DEFAULT 0'],
    ['matters', 'worked_with_firm_before',  'worked_with_firm_before TINYINT(1) DEFAULT 0'],
    ['matters', 'additional_notes',         'additional_notes TEXT'],
    ['documents', 'doc_type',              'doc_type VARCHAR(64)'],
    ['documents', 'file_path',             'file_path TEXT'],
    ['documents', 'file_size',             'file_size BIGINT'],
    ['documents', 'mime_type',             'mime_type VARCHAR(128)'],
    ['documents', 'storage_key',           'storage_key TEXT'],
    ['documents', 'required',              'required TINYINT(1) DEFAULT 0'],
    ['tasks', 'action_label',              'action_label VARCHAR(128)'],
    ['invoices', 'stripe_session_id',        'stripe_session_id TEXT'],
    ['invoices', 'stripe_payment_intent_id', 'stripe_payment_intent_id TEXT'],
    ['invoices', 'currency',                 "currency VARCHAR(8) DEFAULT 'usd'"],
    ['invoices', 'service_type',             "service_type VARCHAR(64) DEFAULT 'general'"],
    // password reset (also handled by migration 002 — idempotent here as a safety net)
    ['users', 'password_reset_token',   'password_reset_token TEXT'],
    ['users', 'password_reset_expires', 'password_reset_expires TEXT'],
    ['users', 'is_prime',               'is_prime TINYINT(1) DEFAULT 0'],
  ];
  for (const [table, column, definition] of cols) {
    await addMysqlColumnIfMissing(pool, table, column, definition);
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
      two_fa_prompt_shown INTEGER DEFAULT 0,
      approval_status TEXT,
      is_prime INTEGER DEFAULT 0,
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
      court TEXT, county TEXT, state TEXT,
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
      review_note TEXT,
      reviewed_by INTEGER,
      reviewed_at TEXT,
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
    // Password reset — added in migration 002; listed here so existing SQLite dev
    // databases gain the columns without wiping and re-creating the database.
    ['users', 'password_reset_token',       'TEXT'],
    ['users', 'password_reset_expires',     'TEXT'],
    // Prime subscription flag — added with Stripe integration
    ['users', 'is_prime',                   'INTEGER DEFAULT 0'],
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
      court TEXT, county TEXT, state TEXT,
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
      review_note TEXT,
      reviewed_by INTEGER,
      reviewed_at TIMESTAMPTZ,
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
