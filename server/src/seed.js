require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt   = require('bcryptjs');
const supabase = require('./supabase');

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

async function deleteAll(table) {
  const { error } = await supabase.from(table).delete().gt('id', 0);
  if (error) console.warn(`  Warning clearing ${table}:`, error.message);
}

async function seed() {
  console.log('Clearing transactional data...');
  // Delete in FK-safe order
  await deleteAll('tasks');
  await deleteAll('appointments');
  await deleteAll('messages');
  await deleteAll('documents');
  await deleteAll('matters');

  console.log('Seeding users...');
  const hash = await bcrypt.hash('Password123!', 12);
  const usersData = [
    { first_name: 'Alex',     last_name: 'Morgan',   email: 'partner@trivanta.com',  password_hash: hash, phone: '(555) 100-0001', role: 'partner',   avatar_initials: 'AM', email_verified: true, approval_status: 'approved' },
    { first_name: 'Sarah',    last_name: 'Johnson',  email: 'attorney@trivanta.com', password_hash: hash, phone: '(555) 100-0002', role: 'attorney',  avatar_initials: 'SJ', email_verified: true, approval_status: 'approved' },
    { first_name: 'IT',       last_name: 'Support',  email: 'itsupport@trivanta.com',password_hash: hash, phone: '(555) 100-0099', role: 'itsupport', avatar_initials: 'IT', email_verified: true },
    { first_name: 'Mary',     last_name: 'Allen',    email: 'client@trivanta.com',   password_hash: hash, phone: '(555) 200-0001', role: 'client',    avatar_initials: 'MA', email_verified: true },
    { first_name: 'Margaret', last_name: 'Allen',    email: 'margaret@example.com',  password_hash: hash, phone: '(555) 200-0002', role: 'client',    avatar_initials: 'MA', email_verified: true },
    { first_name: 'Thomas',   last_name: 'Brooks',   email: 'thomas@example.com',    password_hash: hash, phone: '(555) 200-0003', role: 'client',    avatar_initials: 'TB', email_verified: true },
    { first_name: 'Patricia', last_name: 'Davis',    email: 'patricia@example.com',  password_hash: hash, phone: '(555) 200-0004', role: 'client',    avatar_initials: 'PD', email_verified: true },
    { first_name: 'Robert',   last_name: 'Wilson',   email: 'robert@example.com',    password_hash: hash, phone: '(555) 200-0005', role: 'client',    avatar_initials: 'RW', email_verified: true },
    { first_name: 'Linda',    last_name: 'Martinez', email: 'linda@example.com',     password_hash: hash, phone: '(555) 200-0006', role: 'client',    avatar_initials: 'LM', email_verified: true },
    { first_name: 'James',    last_name: 'Anderson', email: 'james@example.com',     password_hash: hash, phone: '(555) 200-0007', role: 'client',    avatar_initials: 'JA', email_verified: true },
  ];

  for (const u of usersData) {
    const { error } = await supabase.from('users').upsert(u, { onConflict: 'email', ignoreDuplicates: true });
    if (error) console.warn(`  Warning upserting ${u.email}:`, error.message);
  }

  const getUser = async email => {
    const { data } = await supabase.from('users').select('id').eq('email', email).single();
    return data;
  };

  const [partnerU, attorneyU, itsupportU, clientU, margaretU, thomasU, patriciaU, robertU, lindaU] = await Promise.all([
    getUser('partner@trivanta.com'),
    getUser('attorney@trivanta.com'),
    getUser('itsupport@trivanta.com'),
    getUser('client@trivanta.com'),
    getUser('margaret@example.com'),
    getUser('thomas@example.com'),
    getUser('patricia@example.com'),
    getUser('robert@example.com'),
    getUser('linda@example.com'),
  ]);

  // Seed user_profiles for partner and attorney
  console.log('Seeding user profiles...');
  const profiles = [
    {
      user_id: partnerU.id, bar_number: 'GA-12345', state_bar: 'Georgia',
      years_experience: 18, specializations: 'Guardianship,Conservatorship,Elder Law',
      firm_role: 'Managing Partner', practice_groups: 'Probate,Elder Law',
      approved_at: new Date().toISOString(), approved_by: itsupportU.id,
    },
    {
      user_id: attorneyU.id, bar_number: 'GA-67890', state_bar: 'Georgia',
      years_experience: 8, specializations: 'Conservatorship,Estate Planning',
      firm_role: null, practice_groups: 'Probate',
      approved_at: new Date().toISOString(), approved_by: itsupportU.id,
    },
  ];
  for (const p of profiles) {
    const { error } = await supabase.from('user_profiles').upsert(p, { onConflict: 'user_id', ignoreDuplicates: true });
    if (error) console.warn(`  Warning upserting profile for user ${p.user_id}:`, error.message);
  }

  console.log('Seeding matters...');
  const mattersData = [
    { case_number: '26-1001', client_id: clientU.id,   attorney_id: partnerU.id,  matter_type: 'guardianship',   description: 'Estate of Mary Allen',     stage: 'hearing_prep',       status: 'active',  court: 'Superior Court of California', county: 'Los Angeles', urgent: false, important_date: daysFromNow(16) },
    { case_number: '26-1002', client_id: margaretU.id, attorney_id: partnerU.id,  matter_type: 'conservatorship', description: 'Estate of Margaret Allen', stage: 'initial_inventory',  status: 'active',  court: 'Superior Court of Georgia',    county: 'Fulton',      urgent: false, important_date: daysFromNow(32) },
    { case_number: '26-1003', client_id: thomasU.id,   attorney_id: attorneyU.id, matter_type: 'conservatorship', description: 'Estate of Thomas Brooks',  stage: 'monthly_records',    status: 'at_risk', court: 'Superior Court of Georgia',    county: 'DeKalb',      urgent: true,  important_date: daysFromNow(8)  },
    { case_number: '25-1004', client_id: patriciaU.id, attorney_id: partnerU.id,  matter_type: 'conservatorship', description: 'Estate of Patricia Davis', stage: 'annual_return_prep', status: 'active',  court: 'Probate Court of Georgia',     county: 'Gwinnett',    urgent: false, important_date: daysFromNow(45) },
    { case_number: '25-1005', client_id: robertU.id,   attorney_id: attorneyU.id, matter_type: 'conservatorship', description: 'Estate of Robert Wilson',  stage: 'court_review',       status: 'active',  court: 'Superior Court of Georgia',    county: 'Cobb',        urgent: false, important_date: daysFromNow(22) },
    { case_number: '26-1006', client_id: lindaU.id,    attorney_id: attorneyU.id, matter_type: 'guardianship',    description: 'Estate of Linda Martinez', stage: 'intake',             status: 'active',  court: 'Superior Court of Georgia',    county: 'DeKalb',      urgent: false, important_date: daysFromNow(60) },
  ];

  const m = {};
  for (const row of mattersData) {
    const { data, error } = await supabase.from('matters').insert(row).select('id, case_number').single();
    if (error) { console.error(`  Error inserting matter ${row.case_number}:`, error.message); continue; }
    m[row.case_number] = data.id;
  }

  console.log('Seeding tasks...');
  const tasks = [
    { matter_id: m['26-1001'], assigned_to: clientU.id,   title: 'Upload care plan',                description: 'Required for upcoming court hearing',              due_date: daysFromNow(-3), status: 'overdue', action_label: 'Upload' },
    { matter_id: m['26-1001'], assigned_to: clientU.id,   title: 'Review doctor appointment notes', description: 'Dr. Smith follow-up details',                       due_date: daysFromNow(6),  status: 'pending', action_label: 'Review' },
    { matter_id: m['26-1001'], assigned_to: clientU.id,   title: 'Sign annual guardian report',     description: 'Covers May 1, 2025 – Apr 30, 2026',                due_date: daysFromNow(14), status: 'pending', action_label: 'Sign'   },
    { matter_id: m['26-1001'], assigned_to: clientU.id,   title: 'Confirm living arrangement',      description: 'Update current caregiver and address information',  due_date: daysFromNow(20), status: 'pending', action_label: 'Confirm'},
    { matter_id: m['26-1001'], assigned_to: clientU.id,   title: 'Upload court order',              description: 'Order from the most recent hearing',                due_date: daysFromNow(25), status: 'pending', action_label: 'Upload' },
    { matter_id: m['26-1002'], assigned_to: margaretU.id, title: 'Upload bank statements',          description: 'Q1 statements for all accounts',                    due_date: daysFromNow(-5), status: 'overdue', action_label: 'Upload' },
    { matter_id: m['26-1002'], assigned_to: margaretU.id, title: 'Submit property inventory',       description: 'List all assets as of date of appointment',         due_date: daysFromNow(10), status: 'pending', action_label: 'Upload' },
    { matter_id: m['26-1002'], assigned_to: margaretU.id, title: 'Obtain property appraisal',       description: 'Real estate and personal property valuation',        due_date: daysFromNow(18), status: 'pending', action_label: 'Review' },
    { matter_id: m['26-1002'], assigned_to: margaretU.id, title: 'File initial inventory with court',description: 'Complete GA Form PC-7A',                           due_date: daysFromNow(32), status: 'pending', action_label: 'Upload' },
    { matter_id: m['26-1003'], assigned_to: thomasU.id,   title: 'Submit April monthly report',     description: 'April financial report — overdue',                  due_date: daysFromNow(-7), status: 'overdue', action_label: 'Upload' },
    { matter_id: m['26-1003'], assigned_to: thomasU.id,   title: 'Upload receipts and invoices',    description: 'All expenditures and income for April',              due_date: daysFromNow(-2), status: 'overdue', action_label: 'Upload' },
    { matter_id: m['26-1003'], assigned_to: thomasU.id,   title: 'Attend status hearing',           description: 'Mandatory appearance — DeKalb County Court',        due_date: daysFromNow(8),  status: 'pending', action_label: 'Review' },
    { matter_id: m['26-1003'], assigned_to: thomasU.id,   title: 'Submit May financial report',     description: 'Due by end of month',                               due_date: daysFromNow(17), status: 'pending', action_label: 'Upload' },
    { matter_id: m['25-1004'], assigned_to: patriciaU.id, title: 'Complete annual accounting',      description: 'For period Jan 1 – Dec 31, 2025',                   due_date: daysFromNow(15), status: 'pending', action_label: 'Upload' },
    { matter_id: m['25-1004'], assigned_to: patriciaU.id, title: 'Upload year-end bank statements', description: 'Final statements for all accounts',                  due_date: daysFromNow(25), status: 'pending', action_label: 'Upload' },
    { matter_id: m['25-1004'], assigned_to: patriciaU.id, title: 'Sign annual return form',         description: 'Georgia Form CN-7 — annual conservator return',      due_date: daysFromNow(35), status: 'pending', action_label: 'Sign'   },
    { matter_id: m['25-1004'], assigned_to: patriciaU.id, title: 'File annual return with court',   description: 'Submit completed return to Probate Court',           due_date: daysFromNow(45), status: 'pending', action_label: 'Upload' },
    { matter_id: m['25-1005'], assigned_to: robertU.id,   title: 'Review court submission packet',  description: 'Verify all documents before filing',                 due_date: daysFromNow(5),  status: 'pending', action_label: 'Review' },
    { matter_id: m['25-1005'], assigned_to: robertU.id,   title: 'Confirm hearing attendance',      description: 'Mandatory appearance at Cobb County court',          due_date: daysFromNow(15), status: 'pending', action_label: 'Confirm'},
    { matter_id: m['25-1005'], assigned_to: robertU.id,   title: 'Upload final financial summary',  description: 'Summary required for court review',                  due_date: daysFromNow(20), status: 'pending', action_label: 'Upload' },
    { matter_id: m['26-1006'], assigned_to: lindaU.id,    title: 'Complete intake questionnaire',   description: 'Initial information for guardianship petition',       due_date: daysFromNow(3),  status: 'pending', action_label: 'Review' },
    { matter_id: m['26-1006'], assigned_to: lindaU.id,    title: 'Submit background check auth',    description: 'Required form for guardian approval',                due_date: daysFromNow(10), status: 'pending', action_label: 'Upload' },
    { matter_id: m['26-1006'], assigned_to: lindaU.id,    title: 'Provide financial disclosure',    description: 'Guardian financial disclosure form',                 due_date: daysFromNow(14), status: 'pending', action_label: 'Upload' },
  ];
  const { error: taskErr } = await supabase.from('tasks').insert(tasks);
  if (taskErr) console.error('  Task seed error:', taskErr.message);

  console.log('Seeding appointments...');
  const appts = [
    { matter_id: m['26-1001'], title: 'Teleconference – Case Update',       type: 'teleconference', start_time: dtFromNow(7,  14, 30), end_time: dtFromNow(7,  15,  0), location: 'Video Call' },
    { matter_id: m['26-1001'], title: 'Annual Guardianship Review Hearing', type: 'in_person',      start_time: dtFromNow(16, 10,  0), end_time: dtFromNow(16, 11,  0), location: 'Superior Court, Dept 12, Los Angeles' },
    { matter_id: m['26-1002'], title: 'Initial Inventory Review Meeting',   type: 'teleconference', start_time: dtFromNow(10, 11,  0), end_time: dtFromNow(10, 11, 30), location: 'Video Call' },
    { matter_id: m['26-1002'], title: 'Conservatorship Hearing',            type: 'in_person',      start_time: dtFromNow(32,  9,  0), end_time: dtFromNow(32, 10,  0), location: 'Superior Court, Fulton County' },
    { matter_id: m['26-1003'], title: 'Emergency Status Hearing',           type: 'in_person',      start_time: dtFromNow(8,  13,  0), end_time: dtFromNow(8,  14,  0), location: 'Superior Court, DeKalb County' },
    { matter_id: m['26-1003'], title: 'Attorney Check-In Call',             type: 'phone',          start_time: dtFromNow(12, 10,  0), end_time: dtFromNow(12, 10, 30), location: 'Phone Call' },
    { matter_id: m['25-1004'], title: 'Annual Return Preparation Meeting',  type: 'teleconference', start_time: dtFromNow(14, 10,  0), end_time: dtFromNow(14, 10, 30), location: 'Video Call' },
    { matter_id: m['25-1004'], title: 'Annual Return Filing Hearing',       type: 'in_person',      start_time: dtFromNow(45,  9, 30), end_time: dtFromNow(45, 10, 30), location: 'Probate Court, Gwinnett County' },
    { matter_id: m['25-1005'], title: 'Pre-Hearing Attorney Conference',    type: 'teleconference', start_time: dtFromNow(18, 15,  0), end_time: dtFromNow(18, 15, 30), location: 'Video Call' },
    { matter_id: m['25-1005'], title: 'Court Review Hearing',               type: 'in_person',      start_time: dtFromNow(22, 14,  0), end_time: dtFromNow(22, 15,  0), location: 'Superior Court, Cobb County' },
    { matter_id: m['26-1006'], title: 'Intake Consultation',                type: 'teleconference', start_time: dtFromNow(4,  10,  0), end_time: dtFromNow(4,  10, 45), location: 'Video Call' },
  ];
  const { error: apptErr } = await supabase.from('appointments').insert(appts);
  if (apptErr) console.error('  Appointment seed error:', apptErr.message);

  console.log('Seeding messages...');
  const messages = [
    { matter_id: m['26-1001'], from_user_id: partnerU.id,  to_user_id: clientU.id,   subject: 'Care Plan Needed',               body: 'Mary, please upload your updated care plan as soon as possible. The court hearing is in 16 days and we need it on file.' },
    { matter_id: m['26-1001'], from_user_id: partnerU.id,  to_user_id: clientU.id,   subject: 'Hearing Reminder',               body: 'Your annual guardianship review hearing is approaching. Please ensure all required documents are uploaded before the hearing date.' },
    { matter_id: m['26-1001'], from_user_id: clientU.id,   to_user_id: partnerU.id,  subject: 'Question about care plan',       body: 'Hi Alex, I have a question about the care plan format. What type of document is accepted? PDF only?' },
    { matter_id: m['26-1002'], from_user_id: partnerU.id,  to_user_id: margaretU.id, subject: 'Initial Inventory Required',     body: 'Margaret, we need you to begin the initial inventory process. Please log in and review the list of required documents.' },
    { matter_id: m['26-1003'], from_user_id: attorneyU.id, to_user_id: thomasU.id,   subject: 'URGENT: Monthly Report Overdue', body: 'Thomas, your April monthly financial report is overdue. This puts your case at risk. Please submit it immediately to avoid court penalties.' },
    { matter_id: m['26-1003'], from_user_id: thomasU.id,   to_user_id: attorneyU.id, subject: 'RE: Monthly Report',             body: 'Sarah, I am working on gathering the documents. I should have everything submitted by tomorrow.' },
    { matter_id: m['25-1004'], from_user_id: partnerU.id,  to_user_id: patriciaU.id, subject: 'Annual Return Preparation',      body: 'Patricia, it is time to begin preparing your annual conservator return. Please start gathering your 2025 financial records.' },
    { matter_id: m['25-1005'], from_user_id: attorneyU.id, to_user_id: robertU.id,   subject: 'Court Review Preparation',       body: 'Robert, your conservatorship court review is coming up soon. Please review your documents and contact us with any questions.' },
    { matter_id: m['26-1002'], from_user_id: partnerU.id,  to_user_id: attorneyU.id, subject: 'Margaret Allen – Status Update', body: 'Sarah, the initial inventory for Estate of Margaret Allen needs attention. The client has not responded to our document requests.' },
    { matter_id: m['26-1006'], from_user_id: attorneyU.id, to_user_id: lindaU.id,    subject: 'Welcome – Intake Process',       body: 'Welcome Linda! We are ready to begin your guardianship case. Please complete the intake questionnaire at your earliest convenience.' },
  ];
  const { error: msgErr } = await supabase.from('messages').insert(messages);
  if (msgErr) console.error('  Message seed error:', msgErr.message);

  console.log('Seeding documents...');
  const docs = [
    { matter_id: m['26-1001'], user_id: clientU.id,   name: 'Letters of Guardianship',         category: '1. Court & Legal Documents',    doc_type: 'letters',        required: true,  status: 'uploaded' },
    { matter_id: m['26-1001'], user_id: clientU.id,   name: 'Court Order – Hearing',            category: '1. Court & Legal Documents',    doc_type: 'court_order',    required: true,  status: 'pending'  },
    { matter_id: m['26-1001'], user_id: clientU.id,   name: 'Care Plan 2026',                   category: '2. Medical & Care Information', doc_type: 'care_plan',      required: true,  status: 'pending'  },
    { matter_id: m['26-1001'], user_id: clientU.id,   name: 'Medical Records – Dr. Smith',      category: '2. Medical & Care Information', doc_type: 'medical_records', required: true,  status: 'uploaded' },
    { matter_id: m['26-1001'], user_id: clientU.id,   name: 'Physician Statement',              category: '2. Medical & Care Information', doc_type: 'physician_stmt', required: true,  status: 'uploaded' },
    { matter_id: m['26-1001'], user_id: clientU.id,   name: 'Doctor Appointment Notes',         category: '6. Additional Documents',       doc_type: 'notes',          required: false, status: 'uploaded' },
    { matter_id: m['26-1002'], user_id: margaretU.id, name: 'Letters of Conservatorship',       category: '1. Court & Legal Documents',    doc_type: 'letters',        required: true,  status: 'uploaded' },
    { matter_id: m['26-1002'], user_id: margaretU.id, name: 'Initial Inventory Form GA PC-7A',  category: '3. Financial & Asset Documents', doc_type: 'inventory',      required: true,  status: 'pending'  },
    { matter_id: m['26-1002'], user_id: margaretU.id, name: 'Bank Statements Q1',               category: '3. Financial & Asset Documents', doc_type: 'bank_stmt',      required: true,  status: 'pending'  },
    { matter_id: m['26-1002'], user_id: margaretU.id, name: 'Property Appraisal Report',        category: '3. Financial & Asset Documents', doc_type: 'appraisal',      required: true,  status: 'pending'  },
    { matter_id: m['26-1003'], user_id: thomasU.id,   name: 'Court Order – Conservatorship',    category: '1. Court & Legal Documents',    doc_type: 'court_order',    required: true,  status: 'uploaded' },
    { matter_id: m['26-1003'], user_id: thomasU.id,   name: 'Monthly Report – March',           category: '4. Monthly & Annual Reports',   doc_type: 'monthly_report', required: true,  status: 'uploaded' },
    { matter_id: m['26-1003'], user_id: thomasU.id,   name: 'Monthly Report – April',           category: '4. Monthly & Annual Reports',   doc_type: 'monthly_report', required: true,  status: 'pending'  },
    { matter_id: m['26-1003'], user_id: thomasU.id,   name: 'Receipts & Invoices – April',      category: '3. Financial & Asset Documents', doc_type: 'receipts',       required: true,  status: 'pending'  },
    { matter_id: m['25-1004'], user_id: patriciaU.id, name: 'Letters of Conservatorship',       category: '1. Court & Legal Documents',    doc_type: 'letters',        required: true,  status: 'uploaded' },
    { matter_id: m['25-1004'], user_id: patriciaU.id, name: 'Annual Accounting 2025',           category: '4. Monthly & Annual Reports',   doc_type: 'annual_acct',    required: true,  status: 'pending'  },
    { matter_id: m['25-1004'], user_id: patriciaU.id, name: 'Bank Statements – Dec 2025',       category: '3. Financial & Asset Documents', doc_type: 'bank_stmt',      required: true,  status: 'uploaded' },
    { matter_id: m['25-1004'], user_id: patriciaU.id, name: 'Annual Return Form GA CN-7',       category: '4. Monthly & Annual Reports',   doc_type: 'annual_return',  required: true,  status: 'pending'  },
    { matter_id: m['25-1004'], user_id: patriciaU.id, name: 'Receipt Documentation 2025',       category: '3. Financial & Asset Documents', doc_type: 'receipts',       required: true,  status: 'uploaded' },
    { matter_id: m['25-1005'], user_id: robertU.id,   name: 'Court Order – Conservatorship',    category: '1. Court & Legal Documents',    doc_type: 'court_order',    required: true,  status: 'uploaded' },
    { matter_id: m['25-1005'], user_id: robertU.id,   name: 'Annual Report 2025',               category: '4. Monthly & Annual Reports',   doc_type: 'annual_acct',    required: true,  status: 'uploaded' },
    { matter_id: m['25-1005'], user_id: robertU.id,   name: 'Financial Summary for Court',      category: '3. Financial & Asset Documents', doc_type: 'financial_sum',  required: true,  status: 'uploaded' },
    { matter_id: m['25-1005'], user_id: robertU.id,   name: 'Asset Inventory',                  category: '3. Financial & Asset Documents', doc_type: 'inventory',      required: true,  status: 'uploaded' },
    { matter_id: m['26-1006'], user_id: lindaU.id,    name: 'Intake Questionnaire',             category: '5. Intake Documents',           doc_type: 'questionnaire',  required: true,  status: 'pending'  },
    { matter_id: m['26-1006'], user_id: lindaU.id,    name: 'Background Check Authorization',   category: '5. Intake Documents',           doc_type: 'background_ck',  required: true,  status: 'pending'  },
    { matter_id: m['26-1006'], user_id: lindaU.id,    name: 'Financial Disclosure Form',        category: '5. Intake Documents',           doc_type: 'financial_disc', required: true,  status: 'pending'  },
  ];
  const { error: docErr } = await supabase.from('documents').insert(docs);
  if (docErr) console.error('  Document seed error:', docErr.message);

  console.log('\n✅ Database seeded successfully!');
  console.log('\n  IT Support: itsupport@trivanta.com / Password123!');
  console.log('  Partner:    partner@trivanta.com   / Password123!');
  console.log('  Attorney:   attorney@trivanta.com  / Password123!');
  console.log('  Client:     client@trivanta.com    / Password123!');
  console.log('\n  Other clients (same password):');
  console.log('  margaret@example.com · thomas@example.com · patricia@example.com');
  console.log('  robert@example.com   · linda@example.com  · james@example.com');
}

seed().catch(err => { console.error('Seed failed:', err.message); process.exit(1); });
