const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../trivanta.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      phone TEXT,
      dob TEXT,
      street TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      role TEXT DEFAULT 'client',
      two_fa_secret TEXT,
      two_fa_enabled INTEGER DEFAULT 0,
      avatar_initials TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS matters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_number TEXT UNIQUE,
      client_id INTEGER REFERENCES users(id),
      attorney_id INTEGER REFERENCES users(id),
      matter_type TEXT,
      stage TEXT DEFAULT 'intake',
      status TEXT DEFAULT 'active',
      description TEXT,
      court TEXT,
      county TEXT,
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
      user_id INTEGER REFERENCES users(id),
      name TEXT NOT NULL,
      category TEXT,
      doc_type TEXT,
      file_path TEXT,
      file_size INTEGER,
      required INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matter_id INTEGER REFERENCES matters(id),
      from_user_id INTEGER REFERENCES users(id),
      to_user_id INTEGER REFERENCES users(id),
      subject TEXT,
      body TEXT NOT NULL,
      read_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matter_id INTEGER REFERENCES matters(id),
      title TEXT NOT NULL,
      type TEXT DEFAULT 'teleconference',
      start_time TEXT NOT NULL,
      end_time TEXT,
      location TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matter_id INTEGER REFERENCES matters(id),
      assigned_to INTEGER REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT,
      due_date TEXT,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'normal',
      action_label TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS annual_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matter_id INTEGER REFERENCES matters(id),
      period_start TEXT,
      period_end TEXT,
      status TEXT DEFAULT 'pending',
      due_date TEXT,
      filed_date TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matter_id INTEGER REFERENCES matters(id),
      client_id INTEGER REFERENCES users(id),
      created_by INTEGER REFERENCES users(id),
      stripe_session_id TEXT,
      stripe_payment_intent_id TEXT,
      amount INTEGER NOT NULL,
      currency TEXT DEFAULT 'usd',
      description TEXT NOT NULL,
      service_type TEXT DEFAULT 'general',
      status TEXT DEFAULT 'pending',
      due_date TEXT,
      paid_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

module.exports = { getDb };
