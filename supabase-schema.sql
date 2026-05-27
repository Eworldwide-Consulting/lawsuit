-- TriVanta – Supabase PostgreSQL Schema
-- Run this entire file in Supabase Dashboard → SQL Editor → New Query → Run
-- NOTE: Using service_role key on server bypasses RLS; do NOT enable RLS unless you add policies.

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  first_name                 TEXT NOT NULL,
  last_name                  TEXT NOT NULL,
  email                      TEXT UNIQUE NOT NULL,
  password_hash              TEXT NOT NULL DEFAULT '',
  phone                      TEXT,
  dob                        TEXT,
  street                     TEXT,
  city                       TEXT,
  state                      TEXT,
  zip                        TEXT,
  role                       TEXT DEFAULT 'client',   -- client | attorney | partner | itsupport
  two_fa_secret              TEXT,
  two_fa_enabled             BOOLEAN DEFAULT FALSE,
  avatar_initials            TEXT,
  email_verified             BOOLEAN DEFAULT FALSE,
  verification_token         TEXT,
  verification_token_expires TIMESTAMPTZ,
  approval_status            TEXT DEFAULT NULL,        -- NULL (clients/itsupport) | pending | approved | rejected
  created_at                 TIMESTAMPTZ DEFAULT NOW()
);

-- ─── User Profiles (professional details for attorney / partner) ──────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          BIGINT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  bar_number       TEXT,
  state_bar        TEXT,
  years_experience INTEGER,
  specializations  TEXT,   -- comma-separated list
  firm_role        TEXT,   -- Managing Partner | Senior Partner | Associate Partner
  practice_groups  TEXT,   -- comma-separated list
  approval_notes   TEXT,
  approved_at      TIMESTAMPTZ,
  approved_by      BIGINT REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Activity Log ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,   -- registered | login | matter_created | doc_uploaded | approved | rejected
  resource_type TEXT,
  resource_id   BIGINT,
  details       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Matters ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matters (
  id                        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_number               TEXT UNIQUE,
  client_id                 BIGINT REFERENCES users(id) ON DELETE CASCADE,
  attorney_id               BIGINT REFERENCES users(id),
  matter_type               TEXT,
  stage                     TEXT DEFAULT 'intake',
  status                    TEXT DEFAULT 'active',
  description               TEXT,
  court                     TEXT,
  county                    TEXT,
  urgent                    BOOLEAN DEFAULT FALSE,
  important_date            TEXT,
  has_documents             BOOLEAN DEFAULT FALSE,
  worked_with_firm_before   BOOLEAN DEFAULT FALSE,
  additional_notes          TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS matters_updated_at ON matters;
CREATE TRIGGER matters_updated_at
  BEFORE UPDATE ON matters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Documents ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  matter_id   BIGINT REFERENCES matters(id) ON DELETE CASCADE,
  user_id     BIGINT REFERENCES users(id),
  name        TEXT NOT NULL,
  category    TEXT,
  doc_type    TEXT,
  file_path   TEXT,
  file_size   BIGINT,
  required    BOOLEAN DEFAULT FALSE,
  status      TEXT DEFAULT 'pending',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Messages ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  matter_id    BIGINT REFERENCES matters(id),
  from_user_id BIGINT REFERENCES users(id),
  to_user_id   BIGINT REFERENCES users(id),
  subject      TEXT,
  body         TEXT NOT NULL,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Appointments ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  matter_id   BIGINT REFERENCES matters(id),
  title       TEXT NOT NULL,
  type        TEXT DEFAULT 'teleconference',
  start_time  TEXT NOT NULL,
  end_time    TEXT,
  location    TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Tasks ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  matter_id    BIGINT REFERENCES matters(id) ON DELETE CASCADE,
  assigned_to  BIGINT REFERENCES users(id),
  title        TEXT NOT NULL,
  description  TEXT,
  due_date     TEXT,
  status       TEXT DEFAULT 'pending',
  priority     TEXT DEFAULT 'normal',
  action_label TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Annual Returns ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS annual_returns (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  matter_id    BIGINT REFERENCES matters(id),
  period_start TEXT,
  period_end   TEXT,
  status       TEXT DEFAULT 'pending',
  due_date     TEXT,
  filed_date   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Invoices ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id                       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  matter_id                BIGINT REFERENCES matters(id),
  client_id                BIGINT REFERENCES users(id),
  created_by               BIGINT REFERENCES users(id),
  stripe_session_id        TEXT,
  stripe_payment_intent_id TEXT,
  amount                   BIGINT NOT NULL,
  currency                 TEXT DEFAULT 'usd',
  description              TEXT NOT NULL,
  service_type             TEXT DEFAULT 'general',
  status                   TEXT DEFAULT 'pending',
  due_date                 TEXT,
  paid_at                  TIMESTAMPTZ,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);
