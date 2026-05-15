require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { getDb } = require('./database');

// All dates computed relative to the day the seed runs
function daysFromNow(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dtFromNow(days, hour = 10, minute = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString().slice(0, 19);
}

async function seed() {
  const db = getDb();

  console.log('Clearing transactional data...');
  db.exec(`
    DELETE FROM tasks;
    DELETE FROM appointments;
    DELETE FROM messages;
    DELETE FROM documents;
    DELETE FROM matters;
  `);

  console.log('Seeding users...');
  const hash = await bcrypt.hash('Password123!', 12);
  const users = [
    ['Alex',     'Morgan',   'partner@trivanta.com',  hash, '(555) 100-0001', 'partner',  'AM'],
    ['Sarah',    'Johnson',  'attorney@trivanta.com', hash, '(555) 100-0002', 'attorney', 'SJ'],
    ['Mary',     'Allen',    'client@trivanta.com',   hash, '(555) 200-0001', 'client',   'MA'],
    ['Margaret', 'Allen',    'margaret@example.com',  hash, '(555) 200-0002', 'client',   'MA'],
    ['Thomas',   'Brooks',   'thomas@example.com',    hash, '(555) 200-0003', 'client',   'TB'],
    ['Patricia', 'Davis',    'patricia@example.com',  hash, '(555) 200-0004', 'client',   'PD'],
    ['Robert',   'Wilson',   'robert@example.com',    hash, '(555) 200-0005', 'client',   'RW'],
    ['Linda',    'Martinez', 'linda@example.com',     hash, '(555) 200-0006', 'client',   'LM'],
    ['James',    'Anderson', 'james@example.com',     hash, '(555) 200-0007', 'client',   'JA'],
  ];
  for (const [fn, ln, email, pw, phone, role, initials] of users) {
    db.prepare(`
      INSERT OR IGNORE INTO users (first_name, last_name, email, password_hash, phone, role, avatar_initials)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(fn, ln, email, pw, phone, role, initials);
  }

  const get = email => db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  const partnerU  = get('partner@trivanta.com');
  const attorneyU = get('attorney@trivanta.com');
  const clientU   = get('client@trivanta.com');
  const margaretU = get('margaret@example.com');
  const thomasU   = get('thomas@example.com');
  const patriciaU = get('patricia@example.com');
  const robertU   = get('robert@example.com');
  const lindaU    = get('linda@example.com');

  console.log('Seeding matters...');
  const insertMatter = db.prepare(`
    INSERT INTO matters
      (case_number, client_id, attorney_id, matter_type, description, stage, status, court, county, urgent, important_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const m = {};
  const mattersData = [
    // case#, client, attorney, type, description, stage, status, court, county, urgent, importantDate
    ['26-0012', clientU.id,   partnerU.id,  'guardianship',   'Estate of Mary Allen',     'hearing_prep',       'active',  'Superior Court of California',  'Los Angeles',  0, daysFromNow(16)],
    ['26-0013', margaretU.id, partnerU.id,  'conservatorship','Estate of Margaret Allen', 'initial_inventory',  'active',  'Superior Court of Georgia',     'Fulton',       0, daysFromNow(32)],
    ['26-0009', thomasU.id,   attorneyU.id, 'conservatorship','Estate of Thomas Brooks',  'monthly_records',    'at_risk', 'Superior Court of Georgia',     'DeKalb',       1, daysFromNow(8)],
    ['25-0027', patriciaU.id, partnerU.id,  'conservatorship','Estate of Patricia Davis', 'annual_return_prep', 'active',  'Probate Court of Georgia',      'Gwinnett',     0, daysFromNow(45)],
    ['25-0018', robertU.id,   attorneyU.id, 'conservatorship','Estate of Robert Wilson',  'court_review',       'active',  'Superior Court of Georgia',     'Cobb',         0, daysFromNow(22)],
    ['26-0021', lindaU.id,    attorneyU.id, 'guardianship',   'Estate of Linda Martinez', 'intake',             'active',  'Superior Court of Georgia',     'DeKalb',       0, daysFromNow(60)],
  ];
  for (const [cn, cid, aid, mt, desc, stage, status, court, county, urgent, idate] of mattersData) {
    const r = insertMatter.run(cn, cid, aid, mt, desc, stage, status, court, county, urgent, idate);
    m[cn] = r.lastInsertRowid;
  }

  console.log('Seeding tasks...');
  const insertTask = db.prepare(`
    INSERT INTO tasks (matter_id, assigned_to, title, description, due_date, status, action_label)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const tasks = [
    // 26-0012  Mary Allen — guardianship, hearing_prep
    [m['26-0012'], clientU.id,   'Upload care plan',               'Required for upcoming court hearing',                  daysFromNow(-3), 'overdue', 'Upload'],
    [m['26-0012'], clientU.id,   'Review doctor appointment notes','Dr. Smith follow-up details',                          daysFromNow(6),  'pending', 'Review'],
    [m['26-0012'], clientU.id,   'Sign annual guardian report',    'Covers May 1, 2025 – Apr 30, 2026',                   daysFromNow(14), 'pending', 'Sign'],
    [m['26-0012'], clientU.id,   'Confirm living arrangement',     'Update current caregiver and address information',     daysFromNow(20), 'pending', 'Confirm'],
    [m['26-0012'], clientU.id,   'Upload court order',             'Order from the most recent hearing',                  daysFromNow(25), 'pending', 'Upload'],

    // 26-0013  Margaret Allen — conservatorship, initial_inventory
    [m['26-0013'], margaretU.id, 'Upload bank statements',         'Q1 statements for all accounts',                      daysFromNow(-5), 'overdue', 'Upload'],
    [m['26-0013'], margaretU.id, 'Submit property inventory',      'List all assets as of date of appointment',           daysFromNow(10), 'pending', 'Upload'],
    [m['26-0013'], margaretU.id, 'Obtain property appraisal',      'Real estate and personal property valuation',         daysFromNow(18), 'pending', 'Review'],
    [m['26-0013'], margaretU.id, 'File initial inventory with court','Complete GA Form PC-7A',                            daysFromNow(32), 'pending', 'Upload'],

    // 26-0009  Thomas Brooks — conservatorship, monthly_records, AT RISK
    [m['26-0009'], thomasU.id,   'Submit April monthly report',    'April financial report — overdue',                    daysFromNow(-7), 'overdue', 'Upload'],
    [m['26-0009'], thomasU.id,   'Upload receipts and invoices',   'All expenditures and income for April',               daysFromNow(-2), 'overdue', 'Upload'],
    [m['26-0009'], thomasU.id,   'Attend status hearing',          'Mandatory appearance — DeKalb County Court',          daysFromNow(8),  'pending', 'Review'],
    [m['26-0009'], thomasU.id,   'Submit May financial report',    'Due by end of month',                                 daysFromNow(17), 'pending', 'Upload'],

    // 25-0027  Patricia Davis — conservatorship, annual_return_prep
    [m['25-0027'], patriciaU.id, 'Complete annual accounting',     'For period Jan 1 – Dec 31, 2025',                     daysFromNow(15), 'pending', 'Upload'],
    [m['25-0027'], patriciaU.id, 'Upload year-end bank statements','Final statements for all accounts',                   daysFromNow(25), 'pending', 'Upload'],
    [m['25-0027'], patriciaU.id, 'Sign annual return form',        'Georgia Form CN-7 — annual conservator return',       daysFromNow(35), 'pending', 'Sign'],
    [m['25-0027'], patriciaU.id, 'File annual return with court',  'Submit completed return to Probate Court',            daysFromNow(45), 'pending', 'Upload'],

    // 25-0018  Robert Wilson — conservatorship, court_review
    [m['25-0018'], robertU.id,   'Review court submission packet', 'Verify all documents before filing',                  daysFromNow(5),  'pending', 'Review'],
    [m['25-0018'], robertU.id,   'Confirm hearing attendance',     'Mandatory appearance at Cobb County court',           daysFromNow(15), 'pending', 'Confirm'],
    [m['25-0018'], robertU.id,   'Upload final financial summary', 'Summary required for court review',                   daysFromNow(20), 'pending', 'Upload'],

    // 26-0021  Linda Martinez — guardianship, intake
    [m['26-0021'], lindaU.id,    'Complete intake questionnaire',  'Initial information for guardianship petition',        daysFromNow(3),  'pending', 'Review'],
    [m['26-0021'], lindaU.id,    'Submit background check auth',   'Required form for guardian approval',                 daysFromNow(10), 'pending', 'Upload'],
    [m['26-0021'], lindaU.id,    'Provide financial disclosure',   'Guardian financial disclosure form',                  daysFromNow(14), 'pending', 'Upload'],
  ];
  for (const args of tasks) insertTask.run(...args);

  console.log('Seeding appointments...');
  const insertAppt = db.prepare(`
    INSERT INTO appointments (matter_id, title, type, start_time, end_time, location)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const appts = [
    [m['26-0012'], 'Teleconference – Case Update',       'teleconference', dtFromNow(7,  14, 30), dtFromNow(7,  15,  0), 'Video Call'],
    [m['26-0012'], 'Annual Guardianship Review Hearing', 'in_person',      dtFromNow(16, 10,  0), dtFromNow(16, 11,  0), 'Superior Court, Dept 12, Los Angeles'],
    [m['26-0013'], 'Initial Inventory Review Meeting',   'teleconference', dtFromNow(10, 11,  0), dtFromNow(10, 11, 30), 'Video Call'],
    [m['26-0013'], 'Conservatorship Hearing',            'in_person',      dtFromNow(32,  9,  0), dtFromNow(32, 10,  0), 'Superior Court, Fulton County'],
    [m['26-0009'], 'Emergency Status Hearing',           'in_person',      dtFromNow(8,  13,  0), dtFromNow(8,  14,  0), 'Superior Court, DeKalb County'],
    [m['26-0009'], 'Attorney Check-In Call',             'phone',          dtFromNow(12, 10,  0), dtFromNow(12, 10, 30), 'Phone Call'],
    [m['25-0027'], 'Annual Return Preparation Meeting',  'teleconference', dtFromNow(14, 10,  0), dtFromNow(14, 10, 30), 'Video Call'],
    [m['25-0027'], 'Annual Return Filing Hearing',       'in_person',      dtFromNow(45,  9, 30), dtFromNow(45, 10, 30), 'Probate Court, Gwinnett County'],
    [m['25-0018'], 'Pre-Hearing Attorney Conference',    'teleconference', dtFromNow(18, 15,  0), dtFromNow(18, 15, 30), 'Video Call'],
    [m['25-0018'], 'Court Review Hearing',               'in_person',      dtFromNow(22, 14,  0), dtFromNow(22, 15,  0), 'Superior Court, Cobb County'],
    [m['26-0021'], 'Intake Consultation',                'teleconference', dtFromNow(4,  10,  0), dtFromNow(4,  10, 45), 'Video Call'],
  ];
  for (const args of appts) insertAppt.run(...args);

  console.log('Seeding messages...');
  const insertMsg = db.prepare(`
    INSERT INTO messages (matter_id, from_user_id, to_user_id, subject, body)
    VALUES (?, ?, ?, ?, ?)
  `);
  const messages = [
    [m['26-0012'], partnerU.id,  clientU.id,   'Care Plan Needed',              'Mary, please upload your updated care plan as soon as possible. The court hearing is in 16 days and we need it on file.'],
    [m['26-0012'], partnerU.id,  clientU.id,   'Hearing Reminder',              'Your annual guardianship review hearing is approaching. Please ensure all required documents are uploaded before the hearing date.'],
    [m['26-0012'], clientU.id,   partnerU.id,  'Question about care plan',      'Hi Alex, I have a question about the care plan format. What type of document is accepted? PDF only?'],
    [m['26-0013'], partnerU.id,  margaretU.id, 'Initial Inventory Required',    'Margaret, we need you to begin the initial inventory process. Please log in and review the list of required documents.'],
    [m['26-0009'], attorneyU.id, thomasU.id,   'URGENT: Monthly Report Overdue','Thomas, your April monthly financial report is overdue. This puts your case at risk. Please submit it immediately to avoid court penalties.'],
    [m['26-0009'], thomasU.id,   attorneyU.id, 'RE: Monthly Report',            'Sarah, I am working on gathering the documents. I should have everything submitted by tomorrow.'],
    [m['25-0027'], partnerU.id,  patriciaU.id, 'Annual Return Preparation',     'Patricia, it is time to begin preparing your annual conservator return. Please start gathering your 2025 financial records.'],
    [m['25-0018'], attorneyU.id, robertU.id,   'Court Review Preparation',      'Robert, your conservatorship court review is coming up soon. Please review your documents and contact us with any questions.'],
    [m['26-0013'], partnerU.id,  attorneyU.id, 'Margaret Allen – Status Update','Sarah, the initial inventory for Estate of Margaret Allen needs attention. The client has not responded to our document requests.'],
    [m['26-0021'], attorneyU.id, lindaU.id,    'Welcome – Intake Process',      'Welcome Linda! We are ready to begin your guardianship case. Please complete the intake questionnaire at your earliest convenience.'],
  ];
  for (const args of messages) insertMsg.run(...args);

  console.log('Seeding documents...');
  const insertDoc = db.prepare(`
    INSERT INTO documents (matter_id, user_id, name, category, doc_type, required, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const docs = [
    // 26-0012  Mary Allen (guardianship) — 4 uploaded, 2 pending
    [m['26-0012'], clientU.id,   'Letters of Guardianship',          '1. Court & Legal Documents',    'letters',        1, 'uploaded'],
    [m['26-0012'], clientU.id,   'Court Order – Hearing',            '1. Court & Legal Documents',    'court_order',    1, 'pending'],
    [m['26-0012'], clientU.id,   'Care Plan 2026',                   '2. Medical & Care Information', 'care_plan',      1, 'pending'],
    [m['26-0012'], clientU.id,   'Medical Records – Dr. Smith',      '2. Medical & Care Information', 'medical_records',1, 'uploaded'],
    [m['26-0012'], clientU.id,   'Physician Statement',              '2. Medical & Care Information', 'physician_stmt', 1, 'uploaded'],
    [m['26-0012'], clientU.id,   'Doctor Appointment Notes',         '6. Additional Documents',       'notes',          0, 'uploaded'],

    // 26-0013  Margaret Allen (conservatorship) — 1 uploaded, 3 pending
    [m['26-0013'], margaretU.id, 'Letters of Conservatorship',       '1. Court & Legal Documents',    'letters',        1, 'uploaded'],
    [m['26-0013'], margaretU.id, 'Initial Inventory Form GA PC-7A',  '3. Financial & Asset Documents','inventory',      1, 'pending'],
    [m['26-0013'], margaretU.id, 'Bank Statements Q1',               '3. Financial & Asset Documents','bank_stmt',      1, 'pending'],
    [m['26-0013'], margaretU.id, 'Property Appraisal Report',        '3. Financial & Asset Documents','appraisal',      1, 'pending'],

    // 26-0009  Thomas Brooks (at_risk) — 2 uploaded, 2 pending
    [m['26-0009'], thomasU.id,   'Court Order – Conservatorship',    '1. Court & Legal Documents',    'court_order',    1, 'uploaded'],
    [m['26-0009'], thomasU.id,   'Monthly Report – March',           '4. Monthly & Annual Reports',   'monthly_report', 1, 'uploaded'],
    [m['26-0009'], thomasU.id,   'Monthly Report – April',           '4. Monthly & Annual Reports',   'monthly_report', 1, 'pending'],
    [m['26-0009'], thomasU.id,   'Receipts & Invoices – April',      '3. Financial & Asset Documents','receipts',       1, 'pending'],

    // 25-0027  Patricia Davis — 3 uploaded, 2 pending
    [m['25-0027'], patriciaU.id, 'Letters of Conservatorship',       '1. Court & Legal Documents',    'letters',        1, 'uploaded'],
    [m['25-0027'], patriciaU.id, 'Annual Accounting 2025',           '4. Monthly & Annual Reports',   'annual_acct',    1, 'pending'],
    [m['25-0027'], patriciaU.id, 'Bank Statements – Dec 2025',       '3. Financial & Asset Documents','bank_stmt',      1, 'uploaded'],
    [m['25-0027'], patriciaU.id, 'Annual Return Form GA CN-7',       '4. Monthly & Annual Reports',   'annual_return',  1, 'pending'],
    [m['25-0027'], patriciaU.id, 'Receipt Documentation 2025',       '3. Financial & Asset Documents','receipts',       1, 'uploaded'],

    // 25-0018  Robert Wilson — all uploaded (court_review stage)
    [m['25-0018'], robertU.id,   'Court Order – Conservatorship',    '1. Court & Legal Documents',    'court_order',    1, 'uploaded'],
    [m['25-0018'], robertU.id,   'Annual Report 2025',               '4. Monthly & Annual Reports',   'annual_acct',    1, 'uploaded'],
    [m['25-0018'], robertU.id,   'Financial Summary for Court',      '3. Financial & Asset Documents','financial_sum',  1, 'uploaded'],
    [m['25-0018'], robertU.id,   'Asset Inventory',                  '3. Financial & Asset Documents','inventory',      1, 'uploaded'],

    // 26-0021  Linda Martinez (intake) — all pending
    [m['26-0021'], lindaU.id,    'Intake Questionnaire',             '5. Intake Documents',           'questionnaire',  1, 'pending'],
    [m['26-0021'], lindaU.id,    'Background Check Authorization',   '5. Intake Documents',           'background_ck',  1, 'pending'],
    [m['26-0021'], lindaU.id,    'Financial Disclosure Form',        '5. Intake Documents',           'financial_disc', 1, 'pending'],
  ];
  for (const args of docs) insertDoc.run(...args);

  console.log('\n✅ Database seeded successfully!');
  console.log('\n  Partner:  partner@trivanta.com  / Password123!');
  console.log('  Attorney: attorney@trivanta.com / Password123!');
  console.log('  Client:   client@trivanta.com   / Password123!');
  console.log('\n  Other clients (same password):');
  console.log('  margaret@example.com · thomas@example.com · patricia@example.com');
  console.log('  robert@example.com   · linda@example.com  · james@example.com');
}

seed().catch(console.error);
