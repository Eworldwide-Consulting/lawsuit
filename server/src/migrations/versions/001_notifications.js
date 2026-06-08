// Adds the notifications table and performance indexes introduced in Phase D.
// MySQL-safe: uses AUTO_INCREMENT for MySQL, INTEGER PRIMARY KEY for SQLite/Postgres.
// Indexes use plain CREATE INDEX + errno-1061 guard instead of IF NOT EXISTS
// (which requires MySQL 8.0.29+ for index statements).

exports.up = async function ({ run, dbType }) {
  if (dbType === 'mysql') {
    await run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id          BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id     BIGINT NOT NULL,
        type        VARCHAR(64) NOT NULL,
        title       VARCHAR(255) NOT NULL,
        body        TEXT,
        entity_type VARCHAR(64),
        entity_id   BIGINT,
        read_at     DATETIME,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } else {
    await run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id          INTEGER PRIMARY KEY,
        user_id     INTEGER NOT NULL,
        type        VARCHAR(64) NOT NULL,
        title       VARCHAR(255) NOT NULL,
        body        TEXT,
        entity_type VARCHAR(64),
        entity_id   INTEGER,
        read_at     DATETIME,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  // Plain CREATE INDEX + ignore-duplicate guard — works across SQLite, MySQL 5.7+, Postgres
  const indexes = [
    `CREATE INDEX idx_notif_user_unread    ON notifications (user_id, read_at)`,
    `CREATE INDEX idx_matters_stage_status ON matters (stage, status)`,
    `CREATE INDEX idx_messages_unread      ON messages (to_user_id, read_at)`,
  ];
  for (const sql of indexes) {
    try {
      await run(sql);
    } catch (err) {
      const msg = (err.message || '').toLowerCase();
      // MySQL 1061 = duplicate key name; SQLite = "already exists"
      if (err.errno === 1061 || msg.includes('already exists') || msg.includes('duplicate')) continue;
      throw err;
    }
  }
};