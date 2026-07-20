// Migration 009 — generalized intake forms (all 4 matter types)
// Replaces the guardianship-only `guardianship_forms` table (migration 008)
// with a single `intake_forms` table keyed by matter_type, using generic
// petitioner_*/subject_* field names (see domain/intakeFormSchema.js).
// Existing guardianship_forms rows are migrated in; the old table is left in
// place (not dropped) as a harmless historical record — application code
// stops reading/writing it after this migration.

const GUARDIAN_TO_GENERIC_KEY = {
  guardian_name:            'petitioner_name',
  guardian_relationship:    'petitioner_relationship',
  guardian_dob:             'petitioner_dob',
  guardian_phone:           'petitioner_phone',
  guardian_email:           'petitioner_email',
  guardian_address:         'petitioner_address',
  ward_name:                'subject_name',
  ward_dob:                 'subject_dob',
  ward_residence:           'subject_residence',
  ward_medical_conditions:  'subject_medical_conditions',
  ward_care_needs:          'subject_care_needs',
  ward_current_caregiver:   'subject_current_caregiver',
};

exports.up = async function ({ run, one, all, dbType }) {
  const pk =
    dbType === 'mysql' ? 'BIGINT AUTO_INCREMENT PRIMARY KEY'
    : dbType === 'pg'  ? 'SERIAL PRIMARY KEY'
    :                    'INTEGER PRIMARY KEY AUTOINCREMENT';

  await run(`
    CREATE TABLE IF NOT EXISTS intake_forms (
      id ${pk},
      matter_id   BIGINT,
      client_id   BIGINT,
      matter_type VARCHAR(64),
      form_data   TEXT,
      status      VARCHAR(20) DEFAULT 'draft',
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME
    )
  `);

  try {
    await run(`CREATE INDEX idx_intake_forms_matter ON intake_forms (matter_id)`);
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (err.errno !== 1061 && !msg.includes('already exists') && !msg.includes('duplicate')) throw err;
  }

  // ── Migrate existing guardianship_forms rows into the generalized table ──
  const oldRows = await all(`SELECT * FROM guardianship_forms`);

  for (const row of oldRows) {
    const already = await one(`SELECT id FROM intake_forms WHERE matter_id = ?`, [row.matter_id]);
    if (already) continue; // idempotent re-run

    const matter = await one(`SELECT matter_type FROM matters WHERE id = ?`, [row.matter_id]);
    const matterType = matter?.matter_type || 'guardianship';

    const formData = {};
    for (const [oldKey, newKey] of Object.entries(GUARDIAN_TO_GENERIC_KEY)) {
      if (row[oldKey] != null && row[oldKey] !== '') formData[newKey] = row[oldKey];
    }

    await run(
      `INSERT INTO intake_forms (matter_id, client_id, matter_type, form_data, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        row.matter_id, row.client_id, matterType,
        JSON.stringify(formData), row.status || 'draft',
        row.created_at || null, row.updated_at || null,
      ]
    );
  }
};

exports.down = async function () {};
