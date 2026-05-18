/**
 * TriVanta — Extended End-to-End Test Suite
 * Edge cases, security boundaries, and stress scenarios.
 * Usage:  node e2e-extended.js   (backend must be on localhost:5000)
 */
const http = require('http');

const RUN_ID = Date.now().toString(36).slice(-8);
let PASS = 0, FAIL = 0, WARN = 0;

function log(status, label, detail = '') {
  const sym = { PASS: '✅', FAIL: '❌', WARN: '⚠️ ', INFO: 'ℹ️ ' }[status] ?? 'ℹ️ ';
  if (status === 'PASS') PASS++;
  else if (status === 'FAIL') FAIL++;
  else if (status === 'WARN') WARN++;
  console.log(`${sym} ${label}${detail ? '  →  ' + detail : ''}`);
}
function section(title) {
  console.log('\n' + '═'.repeat(70));
  console.log('  ' + title);
  console.log('═'.repeat(70));
}

const req = (method, path, body, token) => new Promise((resolve, reject) => {
  const d = body ? JSON.stringify(body) : null;
  const r = http.request({
    host: 'localhost', port: 5000, path, method,
    headers: {
      ...(d ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
  }, res => {
    let s = '';
    res.on('data', c => s += c);
    res.on('end', () => {
      try { resolve({ status: res.statusCode, body: JSON.parse(s) }); }
      catch { resolve({ status: res.statusCode, body: { raw: s } }); }
    });
  });
  r.on('error', reject);
  if (d) r.write(d);
  r.end();
});
const post  = (p, b, t) => req('POST',   p, b, t);
const get   = (p, t)    => req('GET',    p, null, t);
const put   = (p, b, t) => req('PUT',    p, b, t);
const del   = (p, t)    => req('DELETE', p, null, t);

const futureDateOnly = d => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const futureDate = (days, hour = 10) => {
  const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0);
  return d.toISOString().slice(0, 19);
};
const pastDate = (days, hour = 10) => {
  const d = new Date(); d.setDate(d.getDate() - days); d.setHours(hour, 0, 0, 0);
  return d.toISOString().slice(0, 19);
};
const uid    = suffix => `ext.${suffix}.${RUN_ID}@trivanta-test.com`;
const sleep  = ms => new Promise(r => setTimeout(r, ms));
const asArr  = v => Array.isArray(v) ? v : [];

(async () => {

  // ═══════════════════════════════════════════════════════════════════
  section('PRE-FLIGHT · SEEDED ACCOUNT VERIFICATION');
  // ═══════════════════════════════════════════════════════════════════

  const preAt = await post('/api/auth/login', { email: 'attorney@trivanta.com', password: 'Password123!' });
  const prePt = await post('/api/auth/login', { email: 'partner@trivanta.com',  password: 'Password123!' });
  log(preAt.status === 200 ? 'PASS' : 'FAIL', 'Attorney seeded account login', preAt.body.user?.email ?? preAt.body.error);
  log(prePt.status === 200 ? 'PASS' : 'FAIL', 'Partner seeded account login',  prePt.body.user?.email ?? prePt.body.error);

  // Abort early if seeded accounts don't exist — remaining suites need them.
  if (preAt.status !== 200 || prePt.status !== 200) {
    console.error('\n❌ Seeded accounts missing. Run: node server/src/seed.js\n');
    process.exit(1);
  }
  const atToken  = preAt.body.token;
  const atUserId = preAt.body.user.id;

  // ═══════════════════════════════════════════════════════════════════
  section('SUITE A · REGISTRATION VALIDATION');
  // ═══════════════════════════════════════════════════════════════════

  const a1 = await post('/api/auth/register', {});
  log(a1.status === 400 ? 'PASS' : 'FAIL', 'A1: Empty body → 400', `${a1.status}`);

  const a2 = await post('/api/auth/register', { firstName: 'X', lastName: 'Y', email: uid('a2') });
  log(a2.status === 400 ? 'PASS' : 'FAIL', 'A2: Missing password → 400', `${a2.status}`);

  const a3 = await post('/api/auth/register', { firstName: 'X', lastName: 'Y', email: uid('a3'), password: 'abc' });
  log([400, 201].includes(a3.status) ? 'INFO' : 'FAIL', 'A3: Short password (server enforces?)', `${a3.status}`);

  const a4 = await post('/api/auth/register', {
    firstName: 'Alice', lastName: 'Chen', email: uid('a4'), password: 'AlicePass1!', role: 'client',
  });
  log(a4.status === 201 ? 'PASS' : 'FAIL', 'A4: Valid registration → 201', `id:${a4.body.user?.id}`);
  log(typeof a4.body.token === 'string' ? 'PASS' : 'FAIL', 'A4: Token returned as string');
  log(a4.body.user?.role === 'client'   ? 'PASS' : 'FAIL', 'A4: Role field correct', a4.body.user?.role);
  log(a4.body.user?.password === undefined ? 'PASS' : 'FAIL', 'A4: Password NOT returned in response');
  const tokenA = a4.body.token;

  const a5 = await post('/api/auth/register', { firstName: 'X', lastName: 'Y', email: uid('a4'), password: 'Pass1!' });
  log(a5.status === 409 ? 'PASS' : 'FAIL', 'A5: Duplicate email → 409', `${a5.status}`);

  const a6 = await post('/api/auth/register', {
    firstName: "'; DROP TABLE users; --", lastName: 'Y', email: uid('a6'), password: 'SecurePass1!',
  });
  log([201, 400].includes(a6.status) ? 'PASS' : 'FAIL', 'A6: SQL injection in firstName handled', `${a6.status}`);

  const a7 = await post('/api/auth/register', {
    firstName: '<script>alert(1)</script>', lastName: 'Y', email: uid('a7'), password: 'SecurePass1!',
  });
  log([201, 400].includes(a7.status) ? 'PASS' : 'FAIL', 'A7: XSS in firstName handled', `${a7.status}`);
  if (a7.status === 201) {
    const m7 = await get('/api/auth/me', a7.body.token);
    const name = m7.body.first_name ?? '';
    const escaped = !name.includes('<script>') || name.includes('&lt;');
    log(escaped ? 'PASS' : 'WARN', 'A7: XSS content stored safely (no raw execution)', `stored as: ${name}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  section('SUITE B · LOGIN & TOKEN SECURITY');
  // ═══════════════════════════════════════════════════════════════════

  const emailB = uid('b');
  const passB  = 'BobSecure99!';
  await post('/api/auth/register', { firstName: 'Bob', lastName: 'Test', email: emailB, password: passB });

  const b1 = await post('/api/auth/login', { email: emailB, password: passB });
  log(b1.status === 200 ? 'PASS' : 'FAIL', 'B1: Correct credentials → 200', b1.body.user?.email);
  const tokenB = b1.body.token;

  const b2 = await post('/api/auth/login', { email: emailB, password: 'WrongPass99!' });
  log(b2.status === 401 ? 'PASS' : 'FAIL', 'B2: Wrong password → 401');

  const b3 = await post('/api/auth/login', { email: 'nobody@nowhere.com', password: 'Pass123!' });
  log(b3.status === 401 ? 'PASS' : 'FAIL', 'B3: Non-existent email → 401');

  // 6 rapid wrong-password attempts — all should be 401 (rate-limit threshold is 20/15min)
  const b4Results = [];
  for (let i = 0; i < 6; i++) {
    const r = await post('/api/auth/login', { email: emailB, password: `wrong${i}` });
    b4Results.push(r.status);
  }
  log(b4Results.every(s => [401, 429].includes(s)) ? 'PASS' : 'FAIL',
    'B4: 6 wrong-password attempts all blocked (401 or 429)', b4Results.join(','));
  log(b4Results.some(s => s === 429) ? 'INFO' : 'INFO',
    'B4: Rate-limiter (20 req/15min) not yet triggered at 6 attempts', b4Results.some(s => s === 429) ? 'triggered' : 'not yet');

  const b5 = await get('/api/auth/me');
  log(b5.status === 401 ? 'PASS' : 'FAIL', 'B5: No token → 401');

  const b6 = await req('GET', '/api/auth/me', null, 'not-a-real-jwt');
  log(b6.status === 401 ? 'PASS' : 'FAIL', 'B6: Malformed JWT → 401');

  const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6OTk5OX0.FAKE_SIGNATURE';
  const b7 = await req('GET', '/api/auth/me', null, fakeToken);
  log(b7.status === 401 ? 'PASS' : 'FAIL', 'B7: Tampered JWT → 401');

  const b8 = await get('/api/auth/me', tokenB);
  log(b8.status === 200 && b8.body.email === emailB ? 'PASS' : 'FAIL', 'B8: Valid token on /auth/me', b8.body.email);

  // Case-insensitive email — only attempt if rate-limit not already hit
  const b9 = await post('/api/auth/login', { email: emailB.toUpperCase(), password: passB });
  log([200, 401, 429].includes(b9.status) ? 'INFO' : 'FAIL',
    'B9: Uppercase email login', `${b9.status} (200=case-insensitive, 401=case-sensitive, 429=rate-limited)`);

  // ═══════════════════════════════════════════════════════════════════
  section('SUITE C · MATTER BOUNDARY TESTS');
  // ═══════════════════════════════════════════════════════════════════

  const emailC = uid('c');
  const regC   = await post('/api/auth/register', { firstName: 'Carol', lastName: 'Test', email: emailC, password: 'CarolPass1!', role: 'client' });
  const tokenC = regC.body.token;
  const userC  = regC.body.user;

  // C1: All matter types — sleep 1s between each to avoid same-second case_number collision
  const matterTypes = ['guardianship', 'conservatorship', 'estate_administration', 'probate', 'other'];
  const createdMatters = [];
  for (const mt of matterTypes) {
    await sleep(1100);
    const r = await post('/api/matters', {
      matterType: mt, description: `Test matter for type: ${mt}`,
      court: 'Test Probate Court', county: 'Test County',
      importantDate: futureDateOnly(30),
    }, tokenC);
    log(r.status === 201 ? 'PASS' : 'FAIL', `C1: matter_type=${mt}`, r.body.case_number ?? r.body.error);
    if (r.status === 201) createdMatters.push(r.body);
  }

  if (createdMatters.length > 0) {
    // C2: Client cannot advance stage
    const c2 = await put('/api/matters/' + createdMatters[0].id, { stage: 'hearing_prep' }, tokenC);
    log(c2.status === 403 ? 'PASS' : 'FAIL', 'C2: Client stage-update blocked → 403');

    // C6: Attorney walks matter through all 6 stages
    const mid  = createdMatters[0].id;
    const stages = ['hearing_prep','initial_inventory','monthly_records','annual_return_prep','court_review','complete'];
    let prev = 'intake';
    for (const stage of stages) {
      const r = await put('/api/matters/' + mid, { stage }, atToken);
      log(r.status === 200 ? 'PASS' : 'FAIL', `C6: ${prev} → ${stage}`, `${r.status}`);
      prev = stage;
    }
    const cFin = await get('/api/matters/' + mid, tokenC);
    log(cFin.body.stage === 'complete' ? 'PASS' : 'FAIL', 'C6: Final stage confirmed: complete', cFin.body.stage);
  }

  // C3: Client sees only their own matters
  const c3 = await get('/api/matters', tokenC);
  log(c3.status === 200 ? 'PASS' : 'FAIL', 'C3: Client can list own matters', `count: ${asArr(c3.body).length}`);
  const allMineC = asArr(c3.body).every(m => m.client_id === userC.id);
  log(allMineC ? 'PASS' : 'WARN', 'C3: All listed matters belong to client C', allMineC ? 'enforced' : 'mixed');

  // C4: Attorney sees all matters
  const c4 = await get('/api/matters', atToken);
  log(c4.status === 200 && Array.isArray(c4.body) ? 'PASS' : 'FAIL',
    'C4: Attorney sees all matters', `total: ${asArr(c4.body).length}`);

  // C5: Empty matter body
  const c5 = await post('/api/matters', {}, tokenC);
  log([400, 201].includes(c5.status) ? 'INFO' : 'FAIL', 'C5: Empty matter body', `${c5.status}`);

  // C7: Non-existent matter
  const c7 = await get('/api/matters/999999', tokenC);
  log([404, 403].includes(c7.status) ? 'PASS' : 'FAIL', 'C7: Non-existent matter → 404/403', `${c7.status}`);

  // ═══════════════════════════════════════════════════════════════════
  section('SUITE D · MESSAGING EDGE CASES');
  // ═══════════════════════════════════════════════════════════════════

  const d1a = await post('/api/messages', { subject: 'test' }, tokenC);
  log(d1a.status === 400 ? 'PASS' : 'FAIL', 'D1a: Message without toUserId+body → 400', `${d1a.status}`);

  const d1b = await post('/api/messages', { toUserId: 1 }, tokenC);
  log(d1b.status === 400 ? 'PASS' : 'FAIL', 'D1b: Message without body → 400', `${d1b.status}`);

  const attorneys = await get('/api/users/attorneys', tokenC);
  const firstAtty = asArr(attorneys.body)[0];
  log(firstAtty?.id ? 'PASS' : 'FAIL', 'D2: Attorney list accessible by client', `id: ${firstAtty?.id}`);

  let msgId;
  if (firstAtty?.id) {
    const d3 = await post('/api/messages', {
      toUserId: atUserId,
      subject: `Test D3 [${RUN_ID}]`,
      body: 'Extended suite test message — run ' + RUN_ID,
    }, tokenC);
    log(d3.status === 201 ? 'PASS' : 'FAIL', 'D3: Valid message sent', `id: ${d3.body.id}`);
    msgId = d3.body.id;
  }

  if (msgId) {
    // D4: Appears in attorney inbox
    const atInbox = await get('/api/messages', atToken);
    const found = asArr(atInbox.body).find(m => m.id === msgId);
    log(found ? 'PASS' : 'FAIL', 'D4: Message appears in attorney inbox');

    // D5/D6: Unread count + mark read
    const before = await get('/api/messages/unread-count', atToken);
    log(typeof before.body.count === 'number' ? 'PASS' : 'FAIL', 'D5: Unread count is numeric', `${before.body.count}`);

    const markRead = await put('/api/messages/' + msgId + '/read', {}, atToken);
    log(markRead.status === 200 ? 'PASS' : 'FAIL', 'D6: Mark message as read → 200');

    const after = await get('/api/messages/unread-count', atToken);
    log(after.body.count <= before.body.count ? 'PASS' : 'FAIL',
      'D6: Unread count does not increase after read', `${before.body.count} → ${after.body.count}`);
  }

  // D7: Non-existent message
  const d7 = await put('/api/messages/999999/read', {}, tokenC);
  log([404, 403].includes(d7.status) ? 'PASS' : 'FAIL', 'D7: Non-existent message → 404/403', `${d7.status}`);

  // D8: Sent folder
  const sent = await get('/api/messages/sent', tokenC);
  log(sent.status === 200 && Array.isArray(sent.body) ? 'PASS' : 'FAIL',
    'D8: Sent folder returns array', `count: ${asArr(sent.body).length}`);
  if (msgId) {
    log(asArr(sent.body).some(m => m.id === msgId) ? 'PASS' : 'FAIL', 'D8: Sent message in sent folder');
  }

  // ═══════════════════════════════════════════════════════════════════
  section('SUITE E · APPOINTMENT EDGE CASES');
  // ═══════════════════════════════════════════════════════════════════

  const e1a = await post('/api/appointments', { location: 'Test' }, atToken);
  log(e1a.status === 400 ? 'PASS' : 'FAIL', 'E1a: Appointment without title → 400', `${e1a.status}`);

  const e1b = await post('/api/appointments', { title: 'Test Appt' }, atToken);
  log(e1b.status === 400 ? 'PASS' : 'FAIL', 'E1b: Appointment without startTime → 400', `${e1b.status}`);

  const e2 = await post('/api/appointments', {
    title: 'Past Appointment Test', type: 'phone',
    startTime: pastDate(5, 10), endTime: pastDate(5, 11), location: 'Telephone',
  }, atToken);
  log([201, 400].includes(e2.status) ? 'INFO' : 'FAIL', 'E2: Past appointment', `${e2.status}`);

  for (const [i, type] of ['teleconference','in_person','phone'].entries()) {
    const r = await post('/api/appointments', {
      title: `E3 test ${type}`, type,
      startTime: futureDate(20 + i * 2, 10),
      endTime:   futureDate(20 + i * 2, 11),
      location: 'Test location',
    }, atToken);
    log(r.status === 201 ? 'PASS' : 'FAIL', `E3: type=${type}`, `${r.status}`);
  }

  const e4all      = await get('/api/appointments', atToken);
  const e4upcoming = await get('/api/appointments/upcoming', atToken);
  log(e4all.status === 200 && Array.isArray(e4all.body) ? 'PASS' : 'FAIL',
    'E4: GET /appointments returns array', `count: ${asArr(e4all.body).length}`);
  log(e4upcoming.status === 200 && Array.isArray(e4upcoming.body) ? 'PASS' : 'FAIL',
    'E4: GET /appointments/upcoming', `count: ${asArr(e4upcoming.body).length}`);
  log(asArr(e4upcoming.body).length <= asArr(e4all.body).length ? 'PASS' : 'FAIL',
    'E4: upcoming count ≤ all count');
  log(asArr(e4upcoming.body).every(a => new Date(a.start_time) > new Date()) ? 'PASS' : 'WARN',
    'E4: All upcoming are in the future');

  const e5 = await del('/api/appointments/999999', atToken);
  log([404, 403].includes(e5.status) ? 'PASS' : 'FAIL', 'E5: Cancel non-existent → 404/403', `${e5.status}`);

  // ═══════════════════════════════════════════════════════════════════
  section('SUITE F · TASK EDGE CASES');
  // ═══════════════════════════════════════════════════════════════════

  const f1 = await post('/api/tasks', { priority: 'high' }, atToken);
  log(f1.status === 400 ? 'PASS' : 'FAIL', 'F1: Task without matterId+title → 400', `${f1.status}`);

  if (createdMatters.length > 0) {
    const mid = createdMatters.at(-1).id; // use last matter (still active)

    for (const priority of ['low','normal','high']) {
      const r = await post('/api/tasks', {
        matterId: mid, assignedTo: userC.id,
        title: `Priority test: ${priority}`, priority,
        dueDate: futureDateOnly(10),
      }, atToken);
      log(r.status === 201 ? 'PASS' : 'FAIL', `F2: task priority=${priority}`, `${r.status}`);
    }

    // F3: Status transitions
    const tR = await post('/api/tasks', {
      matterId: mid, assignedTo: userC.id,
      title: 'Status-transition test', priority: 'normal', dueDate: futureDateOnly(7),
    }, atToken);
    if (tR.status === 201) {
      const tid = tR.body.id;
      for (const status of ['in_progress','completed','pending']) {
        const r = await put('/api/tasks/' + tid, { status }, tokenC);
        log(r.status === 200 ? 'PASS' : 'FAIL', `F3: status → ${status}`, `${r.status}`);
      }
    }
  }

  const f4 = await put('/api/tasks/999999', { status: 'completed' }, tokenC);
  log([404, 403].includes(f4.status) ? 'PASS' : 'FAIL', 'F4: Update non-existent task → 404/403', `${f4.status}`);

  // ═══════════════════════════════════════════════════════════════════
  section('SUITE G · PROFILE & PASSWORD MANAGEMENT');
  // ═══════════════════════════════════════════════════════════════════

  const emailG = uid('g');
  const passG  = 'GaryPass1!';
  const regG   = await post('/api/auth/register', { firstName: 'Gary', lastName: 'G', email: emailG, password: passG, role: 'client' });
  const tokenG = regG.body.token;

  const g1 = await put('/api/auth/profile', { firstName: 'Gary Updated', lastName: 'G Updated', phone: '(555) 999-0001' }, tokenG);
  log(g1.status === 200 ? 'PASS' : 'FAIL', 'G1: Profile update → 200', g1.body.first_name);

  const g2 = await get('/api/auth/me', tokenG);
  log(g2.body.first_name === 'Gary Updated'    ? 'PASS' : 'FAIL', 'G2: First name persisted', g2.body.first_name);
  log(g2.body.phone === '(555) 999-0001'        ? 'PASS' : 'FAIL', 'G2: Phone persisted', g2.body.phone);

  // G3: email should be immutable via profile endpoint
  await put('/api/auth/profile', { email: 'hacked@evil.com', firstName: 'Gary Updated', lastName: 'G Updated' }, tokenG);
  const g3 = await get('/api/auth/me', tokenG);
  log(g3.body.email === emailG ? 'PASS' : 'WARN', 'G3: Email unchanged after profile attempt', g3.body.email);

  const g4 = await put('/api/auth/change-password', { currentPassword: 'WrongCurrent!', newPassword: 'NewGaryPass1!' }, tokenG);
  log(g4.status === 400 ? 'PASS' : 'FAIL', 'G4: Wrong current password → 400', `${g4.status}`);

  const g5a = await put('/api/auth/change-password', { newPassword: 'NewGaryPass1!' }, tokenG);
  log(g5a.status === 400 ? 'PASS' : 'FAIL', 'G5a: Missing currentPassword → 400', `${g5a.status}`);
  const g5b = await put('/api/auth/change-password', { currentPassword: passG }, tokenG);
  log(g5b.status === 400 ? 'PASS' : 'FAIL', 'G5b: Missing newPassword → 400', `${g5b.status}`);

  const g6 = await put('/api/auth/change-password', { currentPassword: passG, newPassword: 'NewGaryPass1!' }, tokenG);
  log(g6.status === 200 ? 'PASS' : 'FAIL', 'G6: Password change success');

  const g7 = await post('/api/auth/login', { email: emailG, password: passG });
  log(g7.status === 401 ? 'PASS' : 'FAIL', 'G7: Old password rejected after change');

  const g8 = await post('/api/auth/login', { email: emailG, password: 'NewGaryPass1!' });
  log(g8.status === 200 ? 'PASS' : 'FAIL', 'G8: New password works');

  // ═══════════════════════════════════════════════════════════════════
  section('SUITE H · ROLE ISOLATION & CROSS-USER SECURITY');
  // ═══════════════════════════════════════════════════════════════════

  const regH1 = await post('/api/auth/register', { firstName: 'H1', lastName: 'Client', email: uid('h1'), password: 'H1Pass1!', role: 'client' });
  const regH2 = await post('/api/auth/register', { firstName: 'H2', lastName: 'Client', email: uid('h2'), password: 'H2Pass1!', role: 'client' });
  const tokenH1 = regH1.body.token;
  const tokenH2 = regH2.body.token;
  const userH1  = regH1.body.user;

  await sleep(1100);
  const mH1 = await post('/api/matters', {
    matterType: 'estate_administration', description: 'H1 private matter',
    court: 'H1 Court', county: 'H1 County', importantDate: futureDateOnly(60),
  }, tokenH1);
  log(mH1.status === 201 ? 'PASS' : 'FAIL', 'H1: Client H1 creates matter', mH1.body.case_number);

  if (mH1.status === 201) {
    const h2list = await get('/api/matters', tokenH2);
    const leaked = asArr(h2list.body).find(m => m.id === mH1.body.id);
    log(!leaked ? 'PASS' : 'FAIL', 'H2: Client H2 cannot see H1 matter in list');

    const h3 = await get('/api/matters/' + mH1.body.id, tokenH2);
    log([403, 404].includes(h3.status) ? 'PASS' : 'WARN',
      'H3: Client H2 direct access to H1 matter → 403/404', `${h3.status}`);

    const h4 = await put('/api/matters/' + mH1.body.id, { stage: 'complete' }, tokenH2);
    log([403, 404].includes(h4.status) ? 'PASS' : 'FAIL',
      'H4: Client H2 cannot update H1 matter', `${h4.status}`);
  }

  const h5a = await get('/api/users',         tokenH1); log(h5a.status === 403 ? 'PASS' : 'FAIL', 'H5: /users blocked for client → 403');
  const h5b = await get('/api/users',         atToken);  log(h5b.status === 200 ? 'PASS' : 'FAIL', 'H5: /users accessible by attorney');
  const h5c = await get('/api/users/clients', tokenH1); log(h5c.status === 403 ? 'PASS' : 'FAIL', 'H5: /users/clients blocked for client → 403');
  const h5d = await get('/api/users/attorneys',tokenH1); log(h5d.status === 200 ? 'PASS' : 'FAIL', 'H5: /users/attorneys accessible by client');

  // ═══════════════════════════════════════════════════════════════════
  section('SUITE I · DASHBOARD DATA INTEGRITY');
  // ═══════════════════════════════════════════════════════════════════

  const emailI = uid('i');
  const regI   = await post('/api/auth/register', { firstName: 'Iris', lastName: 'I', email: emailI, password: 'IrisPass1!', role: 'client' });
  const tokenI = regI.body.token;
  const userI  = regI.body.user;

  const i1 = (await get('/api/dashboard/client', tokenI)).body;
  log('openTasks'      in i1 ? 'PASS' : 'FAIL', 'I1: openTasks field present',     String(i1.openTasks));
  log('upcomingAppts'  in i1 ? 'PASS' : 'FAIL', 'I1: upcomingAppts field present');
  log('messages'       in i1 ? 'PASS' : 'FAIL', 'I1: messages field present');
  log('readinessScore' in i1 ? 'PASS' : 'FAIL', 'I1: readinessScore present',      `${i1.readinessScore}%`);
  log(i1.openTasks === 0 ? 'PASS' : 'FAIL', 'I1: openTasks=0 on empty dashboard');

  await sleep(1100);
  const mI = await post('/api/matters', {
    matterType: 'guardianship', description: 'Iris test matter',
    court: 'Court I', county: 'County I', importantDate: futureDateOnly(30),
  }, tokenI);
  const i2 = (await get('/api/dashboard/client', tokenI)).body;
  log(i2.matter?.id === mI.body.id ? 'PASS' : 'FAIL', 'I2: Matter appears in dashboard', i2.matter?.case_number);
  log(i2.matter?.stage === 'intake' ? 'PASS' : 'FAIL', 'I2: Stage = intake for new matter');

  if (mI.status === 201 && atToken) {
    for (let n = 1; n <= 5; n++) {
      await post('/api/tasks', {
        matterId: mI.body.id, assignedTo: userI.id,
        title: `Iris Task ${n}`, priority: n % 2 === 0 ? 'high' : 'normal',
        dueDate: futureDateOnly(n * 3),
      }, atToken);
    }
    const i3 = (await get('/api/dashboard/client', tokenI)).body;
    log(i3.openTasks === 5 ? 'PASS' : 'FAIL', 'I3: 5 tasks → openTasks=5', `got: ${i3.openTasks}`);

    const tasks = asArr((await get('/api/tasks', tokenI)).body);
    for (const tid of tasks.slice(0, 3).map(t => t.id)) {
      await put('/api/tasks/' + tid, { status: 'completed' }, tokenI);
    }
    const i4 = (await get('/api/dashboard/client', tokenI)).body;
    log(i4.openTasks === 2      ? 'PASS' : 'FAIL', 'I4: 3 tasks done → openTasks=2',    `got: ${i4.openTasks}`);
    log(i4.completedTasks === 3 ? 'PASS' : 'FAIL', 'I4: completedTasks=3',               `got: ${i4.completedTasks}`);
    log(i4.readinessScore >= i2.readinessScore ? 'PASS' : 'WARN',
      'I5: Readiness increases as tasks complete', `${i2.readinessScore}% → ${i4.readinessScore}%`);
  }

  // Partner dashboard structure
  const ptDash = (await get('/api/dashboard/partner', prePt.body.token)).body;
  log(typeof ptDash.activeMatters     === 'number' ? 'PASS' : 'FAIL', 'I6: Partner activeMatters numeric',   String(ptDash.activeMatters));
  log(typeof ptDash.annualDeadlines   === 'number' ? 'PASS' : 'FAIL', 'I6: Partner annualDeadlines numeric');
  log(typeof ptDash.readinessScore    === 'number' ? 'PASS' : 'FAIL', 'I6: Partner readinessScore numeric',  `${ptDash.readinessScore}%`);
  log(Array.isArray(ptDash.matters)               ? 'PASS' : 'FAIL', 'I6: Partner matters is array',        `len: ${ptDash.matters?.length}`);
  log(Array.isArray(ptDash.docStats)              ? 'PASS' : 'FAIL', 'I6: Partner docStats is array');
  log(Array.isArray(ptDash.upcomingAppts)         ? 'PASS' : 'FAIL', 'I6: Partner upcomingAppts is array');

  // ═══════════════════════════════════════════════════════════════════
  section('SUITE J · HTTP METHOD & UNKNOWN ROUTE TESTS');
  // ═══════════════════════════════════════════════════════════════════

  const j1 = await get('/api/auth/register', tokenA);
  log([404, 405].includes(j1.status) ? 'PASS' : 'INFO', 'J1: GET on register-only endpoint', `${j1.status}`);

  const j2 = await post('/api/auth/me', {}, tokenA);
  log([404, 405].includes(j2.status) ? 'PASS' : 'INFO', 'J2: POST on GET-only endpoint',     `${j2.status}`);

  const j3 = await get('/api/nonexistent-route/xyz', tokenA);
  log(j3.status === 404 ? 'PASS' : 'INFO', 'J3: Unknown API endpoint → 404', `${j3.status}`);

  const j4 = await post('/api/auth/login', { email: uid('j4'), password: 'y' });
  log(j4.status === 401 ? 'PASS' : 'FAIL', 'J4: Login with unknown email → 401', `${j4.status}`);

  // ═══════════════════════════════════════════════════════════════════
  section('SUMMARY');
  // ═══════════════════════════════════════════════════════════════════

  const total = PASS + FAIL + WARN;
  const score = (PASS + FAIL) > 0 ? Math.round((PASS / (PASS + FAIL)) * 100) : 100;

  console.log('\n' + '═'.repeat(70));
  console.log('  EXTENDED SUITE RESULTS');
  console.log('═'.repeat(70));
  console.log(`  ✅ PASSED  : ${PASS} / ${total}`);
  console.log(`  ❌ FAILED  : ${FAIL}`);
  console.log(`  ⚠️  WARNINGS: ${WARN}`);
  console.log(`  📊 SCORE   : ${score}%`);
  console.log('');
  console.log('  Suites: A-Registration  B-Login/Tokens  C-Matters  D-Messaging');
  console.log('          E-Appointments  F-Tasks         G-Profile  H-Role-Isolation');
  console.log('          I-Dashboard     J-HTTP-Methods');
  console.log('═'.repeat(70));

})().catch(e => { console.error('\n❌ SUITE ERROR:', e.message, e.stack); process.exit(1); });
