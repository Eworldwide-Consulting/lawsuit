require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { one, run, all } = require('./db');

async function seed() {
  console.log('🌱 Seeding MySQL database...');
  const hash = await bcrypt.hash('Password123!', 12);

  const users = [
    ['Admin',   'Partner',  'partner@trivanta.com',  hash, 'partner',  'AP'],
    ['Sarah',   'Johnson',  'attorney@trivanta.com', hash, 'attorney', 'SJ'],
    ['Michael', 'Davis',    'client@trivanta.com',   hash, 'client',   'MD'],
  ];

  for (const [fn,ln,email,pw,role,ini] of users) {
    const existing = await one('SELECT id FROM users WHERE email=?', [email]);
    if (!existing) await run('INSERT INTO users (first_name,last_name,email,password_hash,role,avatar_initials,email_verified) VALUES (?,?,?,?,?,?,1)', [fn,ln,email,pw,role,ini]);
  }
  console.log('✅ Users created');

  const attorney = await one("SELECT id FROM users WHERE email='attorney@trivanta.com'");
  const client   = await one("SELECT id FROM users WHERE email='client@trivanta.com'");

  const existing = await one('SELECT id FROM matters WHERE client_id=?', [client.id]);
  if (existing) { console.log('✅ Demo data already exists'); return; }

  const d = n => new Date(Date.now()+n*86400000).toISOString().slice(0,10);
  const r = await run('INSERT INTO matters (client_id,attorney_id,matter_type,stage,status,description,case_number,court,county,important_date) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [client.id,attorney.id,'guardianship','hearing_prep','active','Guardianship for elderly parent','26-0001','Fulton County Superior Court','Fulton',d(30)]);
  const mid = r.insertId;

  const tasks = [
    [mid,client.id,'Upload medical records','Physician statements required',d(7),'high','Upload'],
    [mid,client.id,'Review petition draft','Review and confirm details',d(10),'high','Review'],
    [mid,client.id,'Sign guardianship forms','Notarized signature required',d(14),'normal','Sign'],
    [mid,client.id,'Confirm hearing attendance','Court hearing confirmation',d(28),'normal','Confirm'],
  ];
  for (const t of tasks) await run('INSERT INTO tasks (matter_id,assigned_to,title,description,due_date,priority,action_label,status) VALUES (?,?,?,?,?,?,?,?)', [...t,'pending']);

  const docs = [
    [mid,client.id,'Medical Records','1. Medical Documentation','pending',1],
    [mid,client.id,'Financial Statements','2. Financial Records','pending',1],
    [mid,client.id,'Birth Certificate','3. Identity Documents','uploaded',1],
    [mid,client.id,'Court Petition','4. Legal Filings','uploaded',1],
  ];
  for (const doc of docs) await run('INSERT INTO documents (matter_id,user_id,name,category,status,required) VALUES (?,?,?,?,?,?)', doc);

  await run('INSERT INTO appointments (matter_id,title,type,start_time,location) VALUES (?,?,?,?,?)',
    [mid,'Initial Consultation','teleconference',new Date(Date.now()+5*86400000).toISOString().slice(0,19),'Zoom — link in email']);

  await run('INSERT INTO messages (matter_id,from_user_id,to_user_id,subject,body) VALUES (?,?,?,?,?)',
    [mid,attorney.id,client.id,'Welcome to TriVanta','Hi Michael, welcome! Please complete the document uploads when you can.']);

  await run('INSERT INTO invoices (client_id,matter_id,created_by,amount,description,service_type,status) VALUES (?,?,?,?,?,?,?)',
    [client.id,mid,attorney.id,25000,'Initial Consultation Fee','consultation','pending']);

  console.log('✅ Demo data created');
  console.log('   partner@trivanta.com  / Password123!');
  console.log('   attorney@trivanta.com / Password123!');
  console.log('   client@trivanta.com   / Password123!');
}

seed().catch(err => { console.error('Seed failed:', err.message); process.exit(1); });
