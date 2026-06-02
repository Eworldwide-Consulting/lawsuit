-- TriVanta – MariaDB/MySQL Schema
-- Compatible with MariaDB 10.2+ and MySQL 5.7+
-- NOTE: Using service_role key on server bypasses RLS; do NOT enable RLS unless you add policies.

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                         BIGINT AUTO_INCREMENT PRIMARY KEY,
  first_name                 VARCHAR(255) NOT NULL,
  last_name                  VARCHAR(255) NOT NULL,
  email                      VARCHAR(255) UNIQUE NOT NULL,
  password_hash              TEXT NOT NULL DEFAULT '',
  phone                      VARCHAR(20),
  dob                        VARCHAR(10),
  street                     VARCHAR(255),
  city                       VARCHAR(100),
  state                      VARCHAR(50),
  zip                        VARCHAR(20),
  role                       VARCHAR(50) DEFAULT 'client',
  two_fa_secret              TEXT,
  two_fa_enabled             TINYINT DEFAULT 0,
  avatar_initials            VARCHAR(10),
  email_verified             TINYINT DEFAULT 0,
  verification_token         VARCHAR(255),
  verification_token_expires DATETIME,
  approval_status            VARCHAR(50),
  created_at                 DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_email (email)
);

-- ─── User Profiles (professional details for attorney / partner) ──────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id               BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id          BIGINT UNIQUE,
  bar_number       VARCHAR(100),
  state_bar        VARCHAR(100),
  years_experience INT,
  specializations  TEXT,
  firm_role        VARCHAR(100),
  practice_groups  TEXT,
  approval_notes   TEXT,
  approved_at      DATETIME,
  approved_by      BIGINT,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- ─── Activity Log ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT,
  action        VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id   BIGINT,
  details       TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ─── Matters ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matters (
  id                        BIGINT AUTO_INCREMENT PRIMARY KEY,
  case_number               VARCHAR(100) UNIQUE,
  client_id                 BIGINT,
  attorney_id               BIGINT,
  matter_type               VARCHAR(100),
  stage                     VARCHAR(50) DEFAULT 'intake',
  status                    VARCHAR(50) DEFAULT 'active',
  description               TEXT,
  court                     VARCHAR(255),
  county                    VARCHAR(100),
  urgent                    TINYINT DEFAULT 0,
  important_date            VARCHAR(20),
  has_documents             TINYINT DEFAULT 0,
  worked_with_firm_before   TINYINT DEFAULT 0,
  additional_notes          TEXT,
  created_at                DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (attorney_id) REFERENCES users(id)
);

-- ─── Documents ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  matter_id   BIGINT,
  user_id     BIGINT,
  name        VARCHAR(255) NOT NULL,
  category    VARCHAR(100),
  doc_type    VARCHAR(100),
  file_path   TEXT,
  file_size   BIGINT,
  required    TINYINT DEFAULT 0,
  status      VARCHAR(50) DEFAULT 'pending',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (matter_id) REFERENCES matters(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ─── Messages ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  matter_id    BIGINT,
  from_user_id BIGINT,
  to_user_id   BIGINT,
  subject      VARCHAR(255),
  body         TEXT NOT NULL,
  read_at      DATETIME,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (matter_id) REFERENCES matters(id),
  FOREIGN KEY (from_user_id) REFERENCES users(id),
  FOREIGN KEY (to_user_id) REFERENCES users(id)
);

-- ─── Appointments ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  matter_id   BIGINT,
  title       VARCHAR(255) NOT NULL,
  type        VARCHAR(50) DEFAULT 'teleconference',
  start_time  VARCHAR(50) NOT NULL,
  end_time    VARCHAR(50),
  location    VARCHAR(255),
  notes       TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (matter_id) REFERENCES matters(id)
);

-- ─── Tasks ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  matter_id    BIGINT,
  assigned_to  BIGINT,
  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  due_date     VARCHAR(20),
  status       VARCHAR(50) DEFAULT 'pending',
  priority     VARCHAR(50) DEFAULT 'normal',
  action_label VARCHAR(255),
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (matter_id) REFERENCES matters(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id)
);

-- ─── Annual Returns ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS annual_returns (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  matter_id    BIGINT,
  period_start VARCHAR(20),
  period_end   VARCHAR(20),
  status       VARCHAR(50) DEFAULT 'pending',
  due_date     VARCHAR(20),
  filed_date   VARCHAR(20),
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (matter_id) REFERENCES matters(id)
);

-- ─── Invoices ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id                       BIGINT AUTO_INCREMENT PRIMARY KEY,
  matter_id                BIGINT,
  client_id                BIGINT,
  created_by               BIGINT,
  stripe_session_id        VARCHAR(255),
  stripe_payment_intent_id VARCHAR(255),
  amount                   BIGINT NOT NULL,
  currency                 VARCHAR(10) DEFAULT 'usd',
  description              TEXT NOT NULL,
  service_type             VARCHAR(50) DEFAULT 'general',
  status                   VARCHAR(50) DEFAULT 'pending',
  due_date                 VARCHAR(20),
  paid_at                  DATETIME,
  created_at               DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (matter_id) REFERENCES matters(id),
  FOREIGN KEY (client_id) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
