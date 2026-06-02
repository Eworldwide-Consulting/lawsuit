require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt  = require('bcryptjs');
const { getDb } = require('./database');

async function seed() {
  const db   = getDb();
  const hash = await bcrypt.hash('Password123!', 12);

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users
      (first_name,last_name,email,password_hash,role,avatar_initials,email_verified)
    VALUES (?,?,?,?,?,?,1)
  `);

  insertUser.run('Admin',   'Partner',  'partner@trivanta.com',  hash, 'partner',  'AP');
  insertUser.run('Sarah',   'Johnson',  'attorney@trivanta.com', hash, 'attorney', 'SJ');
  insertUser.run('Michael', 'Davis',    'client@trivanta.com',   hash, 'client',   'MD');

  const partner  = db.prepare("SELECT id FROM users WHERE email='partner@trivanta.com'").get();
  const attorney = db.prepare("SELECT id FROM users WHERE email='attorney@trivanta.com'").get();
  const client   = db.prepare("SELECT id FROM users WHERE email='client@trivanta.com'").get();

  if (!db.prepare('SELECT id FROM matters WHERE client_id=?').get(client.id)) {
    const d   = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    const mid = db.prepare(`
      INSERT INTO matters (client_id,attorney_id,matter_type,stage,status,description,
        case_number,court,county,important_date)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(client.id, attorney.id, 'guardianship', 'hearing_prep', 'active',
           'Guardianship for elderly parent', '26-0001',
           'Fulton County Superior Court', 'Fulton', d(30)).lastInsertRowid;

    const itask = db.prepare('INSERT INTO tasks (matter_id,assigned_to,title,description,due_date,priority,action_label) VALUES (?,?,?,?,?,?,?)');
    itask.run(mid, client.id, 'Upload medical records',     'Physician statements required', d(7),  'high',   'Upload');
    itask.run(mid, client.id, 'Review petition draft',      'Review and confirm details',    d(10), 'high',   'Review');
    itask.run(mid, client.id, 'Sign guardianship forms',    'Notarized signature required',  d(14), 'normal', 'Sign');
    itask.run(mid, client.id, 'Confirm hearing attendance', 'Court hearing confirmation',    d(28), 'normal', 'Confirm');

    const idoc = db.prepare('INSERT INTO documents (matter_id,user_id,name,category,status,required) VALUES (?,?,?,?,?,1)');
    idoc.run(mid, client.id, 'Medical Records',      '1. Medical Documentation', 'pending');
    idoc.run(mid, client.id, 'Financial Statements', '2. Financial Records',     'pending');
    idoc.run(mid, client.id, 'Birth Certificate',    '3. Identity Documents',    'uploaded');
    idoc.run(mid, client.id, 'Court Petition',       '4. Legal Filings',         'uploaded');

    db.prepare('INSERT INTO appointments (matter_id,title,type,start_time,location) VALUES (?,?,?,?,?)')
      .run(mid, 'Initial Consultation', 'teleconference',
           new Date(Date.now() + 5 * 86400000).toISOString(), 'Zoom — link in email');

    db.prepare('INSERT INTO messages (matter_id,from_user_id,to_user_id,subject,body) VALUES (?,?,?,?,?)')
      .run(mid, attorney.id, client.id, 'Welcome to TriVanta',
           'Hi Michael, welcome! We have received your case details. Please complete the document uploads when you get a chance.');

    db.prepare('INSERT INTO invoices (client_id,matter_id,created_by,amount,description,service_type,status) VALUES (?,?,?,?,?,?,?)')
      .run(client.id, mid, attorney.id, 25000, 'Initial Consultation Fee', 'consultation', 'pending');
  }

  console.log('✅ Database seeded');
  console.log('   partner@trivanta.com  / Password123!');
  console.log('   attorney@trivanta.com / Password123!');
  console.log('   client@trivanta.com   / Password123!');
}

seed().catch(err => { console.error('Seed failed:', err.message); process.exit(1); });
