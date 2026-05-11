require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getDb } = require('./database');

async function seed() {
  const db = getDb();
  console.log('Seeding database...');

  const hash = await bcrypt.hash('Password123!', 12);

  const users = [
    ['Alex', 'Morgan', 'partner@lexprotect.com', hash, '(555) 100-0001', 'partner', 'AM'],
    ['Sarah', 'Johnson', 'attorney@lexprotect.com', hash, '(555) 100-0002', 'attorney', 'SJ'],
    ['Mary', 'Allen', 'client@lexprotect.com', hash, '(555) 200-0001', 'client', 'MA'],
    ['Margaret', 'Allen', 'margaret@example.com', hash, '(555) 200-0002', 'client', 'MA'],
    ['Thomas', 'Brooks', 'thomas@example.com', hash, '(555) 200-0003', 'client', 'TB'],
    ['Patricia', 'Davis', 'patricia@example.com', hash, '(555) 200-0004', 'client', 'PD'],
    ['Robert', 'Wilson', 'robert@example.com', hash, '(555) 200-0005', 'client', 'RW'],
    ['Linda', 'Martinez', 'linda@example.com', hash, '(555) 200-0006', 'client', 'LM'],
    ['James', 'Anderson', 'james@example.com', hash, '(555) 200-0007', 'client', 'JA'],
  ];

  for (const [fn, ln, email, pw, phone, role, initials] of users) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (!existing) {
      db.prepare(`INSERT INTO users (first_name, last_name, email, password_hash, phone, role, avatar_initials) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(fn, ln, email, pw, phone, role, initials);
    }
  }

  const partnerUser = db.prepare("SELECT id FROM users WHERE email = 'partner@lexprotect.com'").get();
  const attorneyUser = db.prepare("SELECT id FROM users WHERE email = 'attorney@lexprotect.com'").get();
  const clientUser = db.prepare("SELECT id FROM users WHERE email = 'client@lexprotect.com'").get();
  const margaretUser = db.prepare("SELECT id FROM users WHERE email = 'margaret@example.com'").get();
  const thomasUser = db.prepare("SELECT id FROM users WHERE email = 'thomas@example.com'").get();
  const patriciaUser = db.prepare("SELECT id FROM users WHERE email = 'patricia@example.com'").get();
  const robertUser = db.prepare("SELECT id FROM users WHERE email = 'robert@example.com'").get();

  const matters = [
    ['25-0012', clientUser.id, partnerUser.id, 'guardianship', 'Estate of Robert Allen', 'hearing_prep', 'active', 'Superior Court of California', 'County of Los Angeles'],
    ['25-0013', margaretUser.id, partnerUser.id, 'conservatorship', 'Estate of Margaret Allen', 'hearing_prep', 'active', 'Superior Court', 'County of Fulton'],
    ['25-0009', thomasUser.id, attorneyUser.id, 'conservatorship', 'Estate of Thomas Brooks', 'initial_inventory', 'at_risk', 'Superior Court', 'County of DeKalb'],
    ['24-0027', patriciaUser.id, partnerUser.id, 'conservatorship', 'Estate of Patricia Davis', 'monthly_records', 'active', 'Probate Court', 'County of Gwinnett'],
    ['24-0018', robertUser.id, attorneyUser.id, 'conservatorship', 'Estate of Robert Wilson', 'court_review', 'active', 'Superior Court', 'County of Cobb'],
  ];

  for (const [cn, cid, aid, mt, desc, stage, status, court, county] of matters) {
    const existing = db.prepare('SELECT id FROM matters WHERE case_number = ?').get(cn);
    if (!existing) {
      db.prepare(`INSERT INTO matters (case_number, client_id, attorney_id, matter_type, description, stage, status, court, county) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(cn, cid, aid, mt, desc, stage, status, court, county);
    }
  }

  const matter = db.prepare("SELECT id FROM matters WHERE case_number = '25-0012'").get();

  const tasks = [
    [matter.id, clientUser.id, 'Upload care plan', 'Required for care plan stage', '2025-05-23', 'overdue', 'Upload'],
    [matter.id, clientUser.id, 'Review doctor appointment details', 'Dr. Smith - Follow up on May 23, 2025', '2025-05-25', 'pending', 'Review'],
    [matter.id, clientUser.id, 'Sign annual guardian report', 'Cover period Apr 1, 2024 - Apr 30, 2025', '2025-05-28', 'pending', 'Sign'],
    [matter.id, clientUser.id, 'Confirm living arrangement update', 'Update caregiver information', '2025-05-30', 'pending', 'Confirm'],
    [matter.id, clientUser.id, 'Upload court order', 'From May 12, 2025 hearing', '2025-06-01', 'pending', 'Upload'],
  ];

  for (const [mid, uid, title, desc, due, status, actionLabel] of tasks) {
    db.prepare(`INSERT INTO tasks (matter_id, assigned_to, title, description, due_date, status, action_label) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(mid, uid, title, desc, due, status, actionLabel);
  }

  const appts = [
    [matter.id, 'Teleconference - Annual Review', 'teleconference', '2025-05-22T10:00:00', '2025-05-22T10:30:00', 'Video Call'],
    [matter.id, 'Annual Hearing', 'in_person', '2025-05-29T12:00:00', '2025-05-29T13:00:00', 'Court'],
  ];

  for (const [mid, title, type, start, end, location] of appts) {
    db.prepare(`INSERT INTO appointments (matter_id, title, type, start_time, end_time, location) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(mid, title, type, start, end, location);
  }

  db.prepare(`INSERT INTO messages (matter_id, from_user_id, to_user_id, subject, body) VALUES (?, ?, ?, ?, ?)`)
    .run(matter.id, partnerUser.id, clientUser.id, 'Care Plan Update', 'Please upload the care plan when you have a moment. Thank you!');

  const documents = [
    [matter.id, clientUser.id, 'Court Order', '1. Court & Legal Documents', 'court_order', 1, 'uploaded'],
    [matter.id, clientUser.id, 'Care Plan', '2. Medical & Care Information', 'care_plan', 1, 'pending'],
    [matter.id, clientUser.id, 'Medical Records', '2. Medical & Care Information', 'medical_records', 1, 'uploaded'],
    [matter.id, clientUser.id, 'Appointment Notes', '6. Additional Documents', 'notes', 0, 'pending'],
  ];

  for (const [mid, uid, name, cat, type, req, status] of documents) {
    db.prepare(`INSERT INTO documents (matter_id, user_id, name, category, doc_type, required, status) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(mid, uid, name, cat, type, req, status);
  }

  console.log('✅ Database seeded successfully!');
  console.log('\nDemo accounts:');
  console.log('  Partner:  partner@lexprotect.com / Password123!');
  console.log('  Attorney: attorney@lexprotect.com / Password123!');
  console.log('  Client:   client@lexprotect.com  / Password123!');
}

seed().catch(console.error);
