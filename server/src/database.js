const Database = require('better-sqlite3');
const path = require('path');

let db;

function getDb() {
  if (db) return db;
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../../../trivanta.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema(db);
  return db;
}

function initSchema(d) {
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
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
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
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
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
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matter_id    INTEGER REFERENCES matters(id),
      from_user_id INTEGER REFERENCES users(id),
      to_user_id   INTEGER REFERENCES users(id),
      subject TEXT,
      body    TEXT NOT NULL,
      read_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
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
      created_at TEXT DEFAULT (datetime('now'))
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
      created_at  TEXT DEFAULT (datetime('now'))
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
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

module.exports = { getDb };
