// Migration 008 — Guardian Information Collection form
// One row per matter: guardian details + protected person (ward) details,
// filled in by the client, viewable by the legal team. Documents uploaded
// alongside the form live in the regular documents table (category
// 'Guardianship'), so no file columns here.

exports.up = async function ({ run, dbType }) {
  const pk =
    dbType === 'mysql' ? 'BIGINT AUTO_INCREMENT PRIMARY KEY'
    : dbType === 'pg'  ? 'SERIAL PRIMARY KEY'
    :                    'INTEGER PRIMARY KEY AUTOINCREMENT';

  await run(`
    CREATE TABLE IF NOT EXISTS guardianship_forms (
      id ${pk},
      matter_id BIGINT,
      client_id BIGINT,
      guardian_name         VARCHAR(255),
      guardian_relationship VARCHAR(100),
      guardian_dob          VARCHAR(20),
      guardian_phone        VARCHAR(50),
      guardian_email        VARCHAR(255),
      guardian_address      TEXT,
      ward_name              VARCHAR(255),
      ward_dob               VARCHAR(20),
      ward_residence         TEXT,
      ward_medical_conditions TEXT,
      ward_care_needs         TEXT,
      ward_current_caregiver  VARCHAR(255),
      status VARCHAR(20) DEFAULT 'draft',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME
    )
  `);
};

exports.down = async function () {};
