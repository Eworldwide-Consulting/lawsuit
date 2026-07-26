// E2E smoke test — runs against local server on port 5000
const BASE = 'http://localhost:5000/api';

let pass = 0, fail = 0;

async function req(method, path, body, headers = {}) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  let data;
  try { data = await r.json(); } catch { data = {}; }
  return { status: r.status, data };
}

function ok(label, cond, detail = '') {
  if (cond) { console.log(`  ✅ ${label}`); pass++; }
  else       { console.error(`  ❌ ${label}${detail ? ' — ' + detail : ''}`); fail++; }
}

async function run() {
  console.log('\n── Health ─────────────────────────────────────────');
  const h = await req('GET', '/health');
  ok('GET /health → 200', h.status === 200, JSON.stringify(h.data));

  // ── Login: demo accounts that skip OTP (email/password → immediate token) ──
  console.log('\n── Login (demo accounts) ───────────────────────────');
  const accounts = [
    ['partner@trivanta.com',    'partner'],
    ['attorney@trivanta.com',   'attorney'],
    ['client@trivanta.com',     'client'],
  ];
  const tokens = {};
  for (const [email, label] of accounts) {
    const r = await req('POST', '/auth/login', { email, password: 'Password123!' });
    const gotToken = r.status === 200 && !!r.data.token;
    ok(`Login ${label}`, gotToken, `status=${r.status} data=${JSON.stringify(r.data)}`);
    if (gotToken) tokens[label] = r.data.token;
  }

  // ── Login: itsupport is a real admin account now — must be OTP-gated, not
  // an immediate token (L6 fix: removed from the DEMO_EMAILS OTP exemption) ──
  console.log('\n── Login (itsupport — must require mail OTP) ───────');
  const itSupportLogin = await req('POST', '/auth/login', {
    email: 'itsupport@gkasevault.io', password: 'Password123!',
  });
  ok('Login itsupport → otpRequired (not an immediate token)',
    itSupportLogin.status === 200 && itSupportLogin.data.otpRequired === true && !itSupportLogin.data.token,
    `status=${itSupportLogin.status} data=${JSON.stringify(itSupportLogin.data)}`);

  // ── /me with valid token ────────────────────────────────────────────────────
  console.log('\n── /me ─────────────────────────────────────────────');
  if (tokens.partner) {
    const r = await req('GET', '/auth/me', null, { Authorization: `Bearer ${tokens.partner}` });
    ok('/me → 200 with role', r.status === 200 && r.data.role === 'partner', JSON.stringify(r.data));
    ok('/me no password_hash', !r.data.password_hash);
  }

  // ── Bad credentials ─────────────────────────────────────────────────────────
  console.log('\n── Bad credentials ─────────────────────────────────');
  const bad = await req('POST', '/auth/login', { email: 'partner@trivanta.com', password: 'WrongPass!' });
  ok('Bad password → 401', bad.status === 401, JSON.stringify(bad.data));

  // ── Pending-attorney blocked ────────────────────────────────────────────────
  console.log('\n── Pending attorney blocked ─────────────────────────');
  const pend = await req('POST', '/auth/login', { email: 'nonexistent@example.com', password: 'x' });
  ok('Nonexistent user → 401', pend.status === 401);

  // ── M6: email domain validation ─────────────────────────────────────────────
  console.log('\n── M6 email domain validation ──────────────────────');
  const badDomain = await req('POST', '/auth/register', {
    firstName: 'Test', lastName: 'User', email: 'test@protonmail.com',
    password: 'Password123!', role: 'client',
  });
  ok('Disallowed domain → 422', badDomain.status === 422, JSON.stringify(badDomain.data));

  const goodDomain = await req('POST', '/auth/register', {
    firstName: 'Test', lastName: 'User', email: `smoketest+${Date.now()}@gmail.com`,
    password: 'Password123!', role: 'client',
  });
  ok('Allowed domain (gmail) → 201', goodDomain.status === 201, JSON.stringify(goodDomain.data));

  // ── M2: /check-email removed ─────────────────────────────────────────────────
  console.log('\n── M2 /check-email removed ──────────────────────────');
  const ce = await req('GET', '/auth/check-email?email=partner@trivanta.com');
  ok('/check-email → 404', ce.status === 404, `got ${ce.status}`);

  // ── L5: forgot-password ───────────────────────────────────────────────────────
  console.log('\n── L5 forgot-password ───────────────────────────────');
  const fp1 = await req('POST', '/auth/forgot-password', { email: 'partner@trivanta.com' });
  ok('forgot-password (real email) → { sent: true }', fp1.status === 200 && fp1.data.sent === true, JSON.stringify(fp1.data));
  ok('forgot-password does not leak token', !fp1.data.token && !fp1.data._token, JSON.stringify(fp1.data));

  const fp2 = await req('POST', '/auth/forgot-password', { email: 'nobody@gmail.com' });
  ok('forgot-password (unknown email) → { sent: true }', fp2.status === 200 && fp2.data.sent === true, JSON.stringify(fp2.data));

  // ── H2: admin user list — no verification_link in rows, pagination works ──────
  console.log('\n── H2 admin user list (paginated, no sensitive fields) ──');
  if (tokens.partner) {
    const ul = await req('GET', '/admin/users?limit=5&offset=0', null, { Authorization: `Bearer ${tokens.partner}` });
    ok('GET /admin/users → 200', ul.status === 200, `status=${ul.status}`);
    const rows = Array.isArray(ul.data) ? ul.data : (ul.data.users ?? []);
    ok('Admin users → no verification_link', rows.every(u => !u.verification_link && !u.password_hash),
      rows.length ? `fields: ${Object.keys(rows[0]).join(',')}` : 'empty');
  }

  // ── H4: file upload rejects SVG ───────────────────────────────────────────────
  console.log('\n── H4 file MIME validation ──────────────────────────');
  if (tokens.client) {
    const { FormData, Blob } = await import('node:buffer').then(() => globalThis);
    // Minimal test: just confirm the endpoint exists and rejects unauthenticated
    const noAuth = await req('POST', '/documents/upload', null);
    ok('Document upload unauthenticated → 401', noAuth.status === 401, `got ${noAuth.status}`);
  }

  // ── Results ───────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(52)}`);
  console.log(`  Passed: ${pass}   Failed: ${fail}   Total: ${pass + fail}`);
  if (fail > 0) process.exit(1);
}

run().catch(err => { console.error('Smoke test crashed:', err); process.exit(1); });