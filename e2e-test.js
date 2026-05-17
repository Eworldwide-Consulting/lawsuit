/**
 * End-to-End Business Test
 * New user: Jennifer Torres — guardianship case full lifecycle
 */
const http = require('http');
const RUN_ID = Date.now().toString(36).slice(-6);
const JENN_EMAIL = 'jennifer.torres.' + RUN_ID + '@email.com';
let PASS = 0, FAIL = 0, WARN = 0;

function log(status, label, msg = '') {
  const sym = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : status === 'WARN' ? '⚠️ ' : 'ℹ️ ';
  if (status === 'PASS') PASS++;
  else if (status === 'FAIL') FAIL++;
  else if (status === 'WARN') WARN++;
  console.log(sym, label + (msg ? '  →  ' + msg : ''));
}
function section(title) {
  console.log('\n' + '═'.repeat(65));
  console.log('  ' + title);
  console.log('═'.repeat(65));
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

const post = (p, b, t) => req('POST', p, b, t);
const get  = (p, t)    => req('GET',  p, null, t);
const put  = (p, b, t) => req('PUT',  p, b, t);
const del  = (p, t)    => req('DELETE', p, null, t);

const futureDate = (days, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString().slice(0, 19);
};
const futureDateOnly = days => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

(async () => {
  let jToken, jUser, atToken, atUser, ptToken;
  let matterId, caseNumber, taskId1, taskId2, taskId3, apptId, msgId;

  // ════════════════════════════════════════════════════════════════
  section('STEP 1 · REGISTRATION');
  // ════════════════════════════════════════════════════════════════

  // Negative: missing required fields
  const badReg = await post('/api/auth/register', { email: 'j@t.com', password: 'pw' });
  log(badReg.status === 400 ? 'PASS' : 'FAIL', 'Reject registration with missing firstName/lastName', badReg.body.error);

  // Positive: full registration (unique email per run — always a fresh user)
  const reg = await post('/api/auth/register', {
    firstName: 'Jennifer', lastName: 'Torres',
    email: JENN_EMAIL, password: 'SecurePass99!',
    phone: '(404) 555-7890', dob: '1985-03-12',
    street: '421 Peachtree Rd NE', city: 'Atlanta', state: 'GA', zip: '30309',
    role: 'client',
  });
  log(reg.status === 201 ? 'PASS' : 'FAIL', 'New client registered',
    reg.body.user ? reg.body.user.first_name + ' ' + reg.body.user.last_name + ' · id:' + reg.body.user.id : reg.body.error);
  jToken = reg.body.token; jUser = reg.body.user;

  // Negative: duplicate email
  const dupReg = await post('/api/auth/register', { firstName: 'X', lastName: 'Y', email: JENN_EMAIL, password: 'abc' });
  log(dupReg.status === 409 ? 'PASS' : 'FAIL', 'Reject duplicate email registration', dupReg.body.error);

  // ════════════════════════════════════════════════════════════════
  section('STEP 2 · AUTHENTICATION');
  // ════════════════════════════════════════════════════════════════

  // Negative: wrong password
  const badLogin = await post('/api/auth/login', { email: JENN_EMAIL, password: 'badpassword' });
  log(badLogin.status === 401 ? 'PASS' : 'FAIL', 'Reject wrong password', badLogin.body.error);

  // Positive: login
  const login = await post('/api/auth/login', { email: JENN_EMAIL, password: 'SecurePass99!' });
  log(login.status === 200 ? 'PASS' : 'FAIL', 'Client login succeeds', 'role: ' + login.body.user?.role);
  if (login.status === 200) { jToken = login.body.token; jUser = login.body.user; }

  // GET /auth/me
  const me = await get('/api/auth/me', jToken);
  log(me.status === 200 && me.body.email === JENN_EMAIL ? 'PASS' : 'FAIL',
    'GET /auth/me returns correct profile', me.body.first_name + ' ' + me.body.last_name);

  // Unauthenticated request blocked
  const noToken = await get('/api/auth/me');
  log(noToken.status === 401 ? 'PASS' : 'FAIL', 'Unauthenticated request rejected · 401');

  // ════════════════════════════════════════════════════════════════
  section('STEP 3 · EMPTY DASHBOARD (brand-new user, no matter yet)');
  // ════════════════════════════════════════════════════════════════

  const emptyDash = await get('/api/dashboard/client', jToken);
  log(emptyDash.status === 200 ? 'PASS' : 'FAIL', 'Client dashboard responds for new user');
  const ed = emptyDash.body;
  log(ed.matter === null || ed.matter === undefined ? 'PASS' : 'WARN', 'No matter on empty dashboard', 'matter=' + JSON.stringify(ed.matter));
  log(ed.openTasks === 0 ? 'PASS' : 'WARN', 'Zero open tasks', 'got: ' + ed.openTasks);
  log(Array.isArray(ed.upcomingAppts) && ed.upcomingAppts.length === 0 ? 'PASS' : 'WARN', 'No upcoming appointments');
  log(Array.isArray(ed.messages) && ed.messages.length === 0 ? 'PASS' : 'WARN', 'No messages yet');
  log(typeof ed.readinessScore === 'number' ? 'PASS' : 'FAIL', 'Readiness score is numeric', ed.readinessScore + '%');

  const emptyMatters = await get('/api/matters', jToken);
  log(emptyMatters.status === 200 && emptyMatters.body.length === 0 ? 'PASS' : 'WARN',
    'No matters before intake', 'count: ' + emptyMatters.body.length);

  // ════════════════════════════════════════════════════════════════
  section('STEP 4 · INTAKE WIZARD — SUBMIT NEW GUARDIANSHIP MATTER');
  // ════════════════════════════════════════════════════════════════

  const intakeResp = await post('/api/matters', {
    matterType: 'guardianship',
    description: 'Guardianship for Dorothy Torres (mother, age 78, early-stage dementia)',
    court: 'Fulton County Probate Court',
    county: 'Fulton',
    urgent: false,
    importantDate: futureDateOnly(45),
    hasDocuments: false,
    workedWithFirmBefore: false,
    additionalNotes: 'Mother was recently diagnosed with early-stage dementia. Needs help with daily medical decisions and finances.',
    matterStatus: 'active',
  }, jToken);
  log(intakeResp.status === 201 ? 'PASS' : 'FAIL', 'Intake: matter created', 'case#: ' + intakeResp.body.case_number);
  matterId   = intakeResp.body.id;
  caseNumber = intakeResp.body.case_number;
  log(intakeResp.body.stage === 'intake' ? 'PASS' : 'FAIL', 'New matter starts at stage: intake');
  log(intakeResp.body.status === 'active' ? 'PASS' : 'FAIL', 'Matter status: active');
  log(intakeResp.body.client_id === jUser.id ? 'PASS' : 'FAIL', 'Matter linked to Jennifer · client_id: ' + intakeResp.body.client_id);
  log(intakeResp.body.matter_type === 'guardianship' ? 'PASS' : 'FAIL', 'Matter type: guardianship');

  // View matter detail
  const mDet = await get('/api/matters/' + matterId, jToken);
  log(mDet.status === 200 ? 'PASS' : 'FAIL', 'GET /matters/:id returns new matter', mDet.body.description?.slice(0, 40));

  // View timeline — intake should be current
  const timeline = await get('/api/matters/' + matterId + '/timeline', jToken);
  const currStage = timeline.body.find(s => s.current);
  log(currStage?.stage === 'intake' ? 'PASS' : 'FAIL', 'Timeline: intake is current stage');
  const upcomingStages = timeline.body.filter(s => s.upcoming).map(s => s.stage);
  log(upcomingStages.length > 0 ? 'PASS' : 'FAIL', 'Timeline has upcoming stages', upcomingStages.slice(0,3).join(' → ') + '...');

  // ════════════════════════════════════════════════════════════════
  section('STEP 5 · DASHBOARD AFTER INTAKE');
  // ════════════════════════════════════════════════════════════════

  const dai = (await get('/api/dashboard/client', jToken)).body;
  log(dai.matter?.id === matterId ? 'PASS' : 'FAIL', 'Dashboard now shows Jennifer\'s matter', dai.matter?.case_number);
  log(dai.matter?.stage === 'intake' ? 'PASS' : 'FAIL', 'Stage shown as intake');

  const matterList = await get('/api/matters', jToken);
  log(matterList.body.length === 1 ? 'PASS' : 'FAIL', 'Matters list shows 1 matter', 'count: ' + matterList.body.length);

  // ════════════════════════════════════════════════════════════════
  section('STEP 6 · ROLE ENFORCEMENT — CLIENT RESTRICTIONS');
  // ════════════════════════════════════════════════════════════════

  // Client cannot update matter stage
  const blockedStageUpdate = await put('/api/matters/' + matterId, { stage: 'hearing_prep' }, jToken);
  log(blockedStageUpdate.status === 403 ? 'PASS' : 'FAIL',
    'Client CANNOT update matter stage · 403', 'got: ' + blockedStageUpdate.status);

  // Client cannot list all users
  const blockedUsers = await get('/api/users', jToken);
  log(blockedUsers.status === 403 ? 'PASS' : 'FAIL', 'Client CANNOT access /users · 403');

  // Client cannot list all clients
  const blockedClients = await get('/api/users/clients', jToken);
  log(blockedClients.status === 403 ? 'PASS' : 'FAIL', 'Client CANNOT access /users/clients · 403');

  // Client CAN see attorneys (needed to send a message)
  const attList = await get('/api/users/attorneys', jToken);
  log(attList.status === 200 && attList.body.length > 0 ? 'PASS' : 'FAIL',
    'Client CAN see attorneys list', 'count: ' + attList.body.length);
  const attorney = attList.body.find(a => a.role === 'attorney');
  log(attorney ? 'PASS' : 'FAIL', 'Attorney found in list', attorney?.first_name + ' ' + attorney?.last_name);

  // ════════════════════════════════════════════════════════════════
  section('STEP 7 · ATTORNEY MANAGES JENNIFER\'S CASE');
  // ════════════════════════════════════════════════════════════════

  const atLogin = await post('/api/auth/login', { email: 'attorney@trivanta.com', password: 'Password123!' });
  log(atLogin.status === 200 ? 'PASS' : 'FAIL', 'Attorney login', 'role: ' + atLogin.body.user?.role);
  atToken = atLogin.body.token; atUser = atLogin.body.user;

  // Attorney sees Jennifer's new matter
  const atMatters = await get('/api/matters', atToken);
  const jMatter = atMatters.body.find(m => m.id === matterId);
  log(jMatter ? 'PASS' : 'FAIL', 'Attorney sees Jennifer\'s matter in all-matters list', jMatter?.description?.slice(0, 30));

  // Attorney advances stage to hearing_prep
  const stageUp1 = await put('/api/matters/' + matterId, {
    stage: 'hearing_prep',
    additionalNotes: 'Initial consultation done. Petition to be filed within 30 days.',
  }, atToken);
  log(stageUp1.status === 200 && stageUp1.body.success ? 'PASS' : 'FAIL', 'Attorney advances matter → hearing_prep');

  const afterStage1 = await get('/api/matters/' + matterId, atToken);
  log(afterStage1.body.stage === 'hearing_prep' ? 'PASS' : 'FAIL', 'Stage confirmed: hearing_prep', afterStage1.body.stage);

  // Attorney creates 3 tasks for Jennifer
  const t1 = await post('/api/tasks', {
    matterId, assignedTo: jUser.id,
    title: 'Upload medical records for Dorothy Torres',
    description: 'All records from last 12 months — Dr. Patel (primary care)',
    dueDate: futureDateOnly(7), priority: 'high', actionLabel: 'Upload',
  }, atToken);
  log(t1.status === 201 ? 'PASS' : 'FAIL', 'Task 1 created: Upload medical records', t1.body.title?.slice(0, 35));
  taskId1 = t1.body.id;

  const t2 = await post('/api/tasks', {
    matterId, assignedTo: jUser.id,
    title: 'Sign guardianship petition form GA PC-6',
    description: 'Review and sign the guardianship petition. DocuSign link to follow.',
    dueDate: futureDateOnly(14), priority: 'high', actionLabel: 'Sign',
  }, atToken);
  log(t2.status === 201 ? 'PASS' : 'FAIL', 'Task 2 created: Sign petition form');
  taskId2 = t2.body.id;

  const t3 = await post('/api/tasks', {
    matterId, assignedTo: jUser.id,
    title: 'Confirm availability for court hearing',
    description: 'Hearing tentatively set — confirm your attendance',
    dueDate: futureDateOnly(21), priority: 'normal', actionLabel: 'Confirm',
  }, atToken);
  log(t3.status === 201 ? 'PASS' : 'FAIL', 'Task 3 created: Confirm hearing attendance');
  taskId3 = t3.body.id;

  // Task validation: missing title should fail
  const badTask = await post('/api/tasks', { matterId }, atToken);
  log(badTask.status === 400 ? 'PASS' : 'FAIL', 'Task creation rejected without title', badTask.body.error);

  // Attorney schedules appointment
  const appt = await post('/api/appointments', {
    matterId, title: 'Initial Consultation – Torres Guardianship',
    type: 'teleconference',
    startTime: futureDate(5, 14), endTime: futureDate(5, 15),
    location: 'Video Call – Zoom',
    notes: 'Review petition requirements and timeline with Jennifer',
  }, atToken);
  log(appt.status === 201 ? 'PASS' : 'FAIL', 'Attorney schedules consultation appointment', appt.body.title?.slice(0, 35));
  apptId = appt.body.id;

  // Appointment validation: missing title/startTime should fail
  const badAppt = await post('/api/appointments', { matterId, location: 'Zoom' }, atToken);
  log(badAppt.status === 400 ? 'PASS' : 'FAIL', 'Appointment rejected without title/startTime', badAppt.body.error);

  // Attorney sends welcome message to Jennifer
  const msg = await post('/api/messages', {
    toUserId: jUser.id, matterId,
    subject: 'Your Guardianship Case is Active — Action Required',
    body: 'Hi Jennifer, I have reviewed your case and assigned three tasks you need to complete. Please start by uploading Dorothy\'s medical records — this is the most time-sensitive item. Our consultation is in 5 days. Feel free to message me with any questions.',
  }, atToken);
  log(msg.status === 201 ? 'PASS' : 'FAIL', 'Attorney sends message to Jennifer');
  msgId = msg.body.id;

  // Message validation: missing toUserId or body should fail
  const badMsg = await post('/api/messages', { subject: 'test' }, atToken);
  log(badMsg.status === 400 ? 'PASS' : 'FAIL', 'Message rejected without toUserId/body', badMsg.body.error);

  // Attorney gets matter stats
  const stats = await get('/api/matters/stats/overview', atToken);
  log(stats.status === 200 ? 'PASS' : 'FAIL', 'Matter stats overview', 'total: ' + stats.body.total + '  active: ' + stats.body.active);

  // ════════════════════════════════════════════════════════════════
  section('STEP 8 · JENNIFER RETURNS — FULL CLIENT EXPERIENCE');
  // ════════════════════════════════════════════════════════════════

  const jLogin2 = await post('/api/auth/login', { email: JENN_EMAIL, password: 'SecurePass99!' });
  if (jLogin2.status === 200) { jToken = jLogin2.body.token; jUser = jLogin2.body.user; }
  log(jLogin2.status === 200 ? 'PASS' : 'WARN', 'Jennifer re-login after attorney activity');

  // Dashboard now shows all activity
  const jd = (await get('/api/dashboard/client', jToken)).body;
  log(jd.matter?.stage === 'hearing_prep' ? 'PASS' : 'FAIL', 'Dashboard: stage updated to hearing_prep', jd.matter?.stage);
  log(jd.openTasks === 3 ? 'PASS' : 'FAIL', 'Dashboard: 3 open tasks', 'got: ' + jd.openTasks);
  log(jd.upcomingAppts?.length >= 1 ? 'PASS' : 'FAIL', 'Dashboard: appointment visible', 'count: ' + jd.upcomingAppts?.length);
  log(jd.messages?.length >= 1 ? 'PASS' : 'FAIL', 'Dashboard: attorney message visible', 'msg: ' + jd.messages?.[0]?.subject?.slice(0, 30));
  log(jd.deadlines?.length >= 1 ? 'PASS' : 'FAIL', 'Dashboard: deadlines populated', 'count: ' + jd.deadlines?.length);
  log('INFO', 'Jennifer readiness score after tasks assigned', jd.readinessScore + '%');

  // Tasks list
  const jTasks = await get('/api/tasks', jToken);
  log(jTasks.status === 200 ? 'PASS' : 'FAIL', 'GET /tasks works for client');
  log(jTasks.body.length === 3 ? 'PASS' : 'FAIL', 'Jennifer sees all 3 assigned tasks', 'count: ' + jTasks.body.length);

  // Appointments
  const jAppts = await get('/api/appointments', jToken);
  log(jAppts.status === 200 ? 'PASS' : 'FAIL', 'GET /appointments works');
  log(jAppts.body.some(a => a.id === apptId) ? 'PASS' : 'FAIL', 'Consultation appointment visible to Jennifer');

  const jUpcoming = await get('/api/appointments/upcoming', jToken);
  log(jUpcoming.status === 200 && jUpcoming.body.length >= 1 ? 'PASS' : 'FAIL',
    'GET /appointments/upcoming', jUpcoming.body[0]?.title?.slice(0, 30));

  // Inbox + unread count
  const inbox = await get('/api/messages', jToken);
  log(inbox.status === 200 ? 'PASS' : 'FAIL', 'GET /messages inbox');
  log(inbox.body.length >= 1 ? 'PASS' : 'FAIL', 'Attorney\'s message in inbox', inbox.body[0]?.subject?.slice(0, 30));

  const unread1 = await get('/api/messages/unread-count', jToken);
  log(unread1.status === 200 ? 'PASS' : 'FAIL', 'GET /messages/unread-count');
  log(unread1.body.count >= 1 ? 'PASS' : 'FAIL', 'Message shows as unread', 'count: ' + unread1.body.count);

  // Mark message as read
  const markRead = await put('/api/messages/' + msgId + '/read', {}, jToken);
  log(markRead.status === 200 ? 'PASS' : 'FAIL', 'Jennifer marks message as read');

  const unread2 = await get('/api/messages/unread-count', jToken);
  log(unread2.body.count === 0 ? 'PASS' : 'FAIL', 'Unread count drops to 0 after mark-read');

  // Jennifer replies to attorney
  const reply = await post('/api/messages', {
    toUserId: atUser.id, matterId,
    subject: 'RE: Your Guardianship Case is Active',
    body: 'Hi Sarah, thank you! I have all of Dr. Patel\'s records ready and will upload them today. I am also available for the consultation call on the scheduled date. One question — do I need to bring original documents to the hearing or are certified copies acceptable?',
  }, jToken);
  log(reply.status === 201 ? 'PASS' : 'FAIL', 'Jennifer replies to attorney message');

  const sent = await get('/api/messages/sent', jToken);
  log(sent.status === 200 ? 'PASS' : 'FAIL', 'GET /messages/sent works');
  log(sent.body.length >= 1 ? 'PASS' : 'FAIL', 'Reply appears in Jennifer\'s sent folder', 'count: ' + sent.body.length);

  // ════════════════════════════════════════════════════════════════
  section('STEP 9 · JENNIFER COMPLETES TASKS');
  // ════════════════════════════════════════════════════════════════

  // Complete task 1 (medical records uploaded)
  const done1 = await put('/api/tasks/' + taskId1, { status: 'completed' }, jToken);
  log(done1.status === 200 ? 'PASS' : 'FAIL', 'Task 1 marked completed: medical records');

  const dash1 = (await get('/api/dashboard/client', jToken)).body;
  log(dash1.openTasks === 2 ? 'PASS' : 'FAIL', 'Open tasks: 3 → 2', 'got: ' + dash1.openTasks);
  log(dash1.completedTasks === 1 ? 'PASS' : 'FAIL', 'Completed tasks now: 1');
  log('INFO', 'Readiness after 1 task done', dash1.readinessScore + '%');

  // Complete task 2 (petition signed)
  const done2 = await put('/api/tasks/' + taskId2, { status: 'completed' }, jToken);
  log(done2.status === 200 ? 'PASS' : 'FAIL', 'Task 2 marked completed: petition signed');

  const dash2 = (await get('/api/dashboard/client', jToken)).body;
  log(dash2.openTasks === 1 ? 'PASS' : 'FAIL', 'Open tasks: 2 → 1', 'got: ' + dash2.openTasks);
  log(dash2.completedTasks === 2 ? 'PASS' : 'FAIL', 'Completed tasks now: 2');
  log('INFO', 'Readiness after 2 tasks done', dash2.readinessScore + '%');

  // ════════════════════════════════════════════════════════════════
  section('STEP 10 · PROFILE & PASSWORD MANAGEMENT');
  // ════════════════════════════════════════════════════════════════

  // Update profile
  const profileUpdate = await put('/api/auth/profile', {
    firstName: 'Jennifer', lastName: 'Torres', phone: '(404) 555-0001',
  }, jToken);
  log(profileUpdate.status === 200 ? 'PASS' : 'FAIL', 'Profile updated successfully');

  const meAfter = await get('/api/auth/me', jToken);
  log(meAfter.body.phone === '(404) 555-0001' ? 'PASS' : 'FAIL', 'Phone number persisted', meAfter.body.phone);

  // Change password — wrong current password rejected
  const badPwd = await put('/api/auth/change-password', { currentPassword: 'wrongpassword', newPassword: 'NewPass99!' }, jToken);
  log(badPwd.status === 400 ? 'PASS' : 'FAIL', 'Wrong current password rejected on change', badPwd.body.error);

  // Change password — correct
  const goodPwd = await put('/api/auth/change-password', { currentPassword: 'SecurePass99!', newPassword: 'NewPass99!' }, jToken);
  log(goodPwd.status === 200 ? 'PASS' : 'FAIL', 'Password changed successfully');

  // New password works
  const newPwdLogin = await post('/api/auth/login', { email: JENN_EMAIL, password: 'NewPass99!' });
  log(newPwdLogin.status === 200 ? 'PASS' : 'FAIL', 'Login succeeds with new password');
  jToken = newPwdLogin.body.token;

  // Old password now rejected
  const oldPwdLogin = await post('/api/auth/login', { email: JENN_EMAIL, password: 'SecurePass99!' });
  log(oldPwdLogin.status === 401 ? 'PASS' : 'FAIL', 'Old password correctly rejected after change');

  // ════════════════════════════════════════════════════════════════
  section('STEP 11 · ATTORNEY FOLLOW-UP & CASE PROGRESSION');
  // ════════════════════════════════════════════════════════════════

  // Attorney re-login (token still valid, but let's confirm)
  const atRelogin = await post('/api/auth/login', { email: 'attorney@trivanta.com', password: 'Password123!' });
  log(atRelogin.status === 200 ? 'PASS' : 'FAIL', 'Attorney re-login');
  atToken = atRelogin.body.token;

  // Attorney sees Jennifer's reply in inbox
  const atInbox = await get('/api/messages', atToken);
  const jenReplyInBox = atInbox.body.find(m => m.from_user_id === jUser.id);
  log(jenReplyInBox ? 'PASS' : 'FAIL', 'Attorney sees Jennifer\'s reply', jenReplyInBox?.subject?.slice(0, 35));

  // Attorney views all tasks — sees Jennifer's completed ones
  const atTasks = await get('/api/tasks', atToken);
  const completedByJen = atTasks.body.filter(t => [taskId1, taskId2].includes(t.id) && t.status === 'completed');
  log(completedByJen.length === 2 ? 'PASS' : 'FAIL', 'Attorney sees 2 completed tasks by Jennifer');

  // Attorney cancels original appointment (rescheduling)
  const cancelAppt = await del('/api/appointments/' + apptId, atToken);
  log(cancelAppt.status === 200 ? 'PASS' : 'FAIL', 'Attorney cancels original appointment');

  // Attorney schedules replacement
  const newAppt = await post('/api/appointments', {
    matterId, title: 'Hearing Prep Review – Torres Guardianship',
    type: 'in_person',
    startTime: futureDate(10, 9), endTime: futureDate(10, 10),
    location: 'TriVanta Law Offices, 100 Peachtree St, Atlanta GA',
    notes: 'Bring government-issued ID and any correspondence from Dorothy\'s doctors',
  }, atToken);
  log(newAppt.status === 201 ? 'PASS' : 'FAIL', 'Attorney schedules in-person appointment', newAppt.body.location?.slice(0, 30));

  // Attorney marks matter urgent
  const markUrgent = await put('/api/matters/' + matterId, { urgent: true }, atToken);
  log(markUrgent.status === 200 ? 'PASS' : 'FAIL', 'Attorney marks matter as urgent');

  // Attorney advances to next stage
  const stageUp2 = await put('/api/matters/' + matterId, { stage: 'initial_inventory' }, atToken);
  log(stageUp2.status === 200 ? 'PASS' : 'FAIL', 'Attorney advances matter → initial_inventory');

  const finalMatterCheck = await get('/api/matters/' + matterId, atToken);
  log(finalMatterCheck.body.stage === 'initial_inventory' ? 'PASS' : 'FAIL',
    'Stage confirmed: initial_inventory', finalMatterCheck.body.stage);
  log(finalMatterCheck.body.urgent === 1 ? 'PASS' : 'FAIL', 'Urgent flag set');

  // ════════════════════════════════════════════════════════════════
  section('STEP 12 · PARTNER FIRM-WIDE OVERSIGHT');
  // ════════════════════════════════════════════════════════════════

  const ptLogin = await post('/api/auth/login', { email: 'partner@trivanta.com', password: 'Password123!' });
  log(ptLogin.status === 200 ? 'PASS' : 'FAIL', 'Partner login', ptLogin.body.user?.role);
  ptToken = ptLogin.body.token;

  const ptDash = (await get('/api/dashboard/partner', ptToken)).body;
  log(typeof ptDash.activeMatters === 'number' ? 'PASS' : 'FAIL', 'Partner dashboard: activeMatters', ptDash.activeMatters);
  log(typeof ptDash.missingDocs === 'number' ? 'PASS' : 'FAIL', 'Partner dashboard: missingDocs', ptDash.missingDocs);
  log(typeof ptDash.readinessScore === 'number' ? 'PASS' : 'FAIL', 'Partner dashboard: readinessScore', ptDash.readinessScore);
  log(typeof ptDash.annualReturnProgress === 'number' ? 'PASS' : 'FAIL', 'Partner dashboard: annualReturnProgress', ptDash.annualReturnProgress + '%');
  log(Array.isArray(ptDash.docStats) && ptDash.docStats.length > 0 ? 'PASS' : 'FAIL',
    'Partner dashboard: docStats populated', ptDash.docStats.length + ' categories');

  // Partner sees Jennifer's matter in the table
  const jInPt = ptDash.matters?.find(m => m.id === matterId);
  log(jInPt ? 'PASS' : 'FAIL', 'Partner sees Jennifer\'s new matter in firm overview', jInPt?.case_number + ' · ' + jInPt?.stage);
  log(typeof jInPt?.readiness_pct === 'number' ? 'PASS' : 'FAIL', 'Readiness % computed for Jennifer\'s matter', jInPt?.readiness_pct + '%');
  log(typeof jInPt?.missing_docs_count === 'number' ? 'PASS' : 'FAIL', 'Missing doc count for Jennifer\'s matter', jInPt?.missing_docs_count);

  // Partner sees Jennifer's pending task via full task list (dashboard widget is capped; /api/tasks has all)
  const ptAllTasks = await get('/api/tasks', ptToken);
  const jenPendingTask = ptAllTasks.body.find(t => t.matter_id === matterId && t.status !== 'completed');
  log(jenPendingTask ? 'PASS' : 'FAIL', 'Partner sees Jennifer\'s pending task', jenPendingTask?.title?.slice(0, 35));

  // Partner sees upcoming appointments
  log(ptDash.upcomingAppts?.length >= 1 ? 'PASS' : 'FAIL', 'Partner sees upcoming appointments', 'count: ' + ptDash.upcomingAppts?.length);

  // Partner dashboard lifecycle stage
  const LIFECYCLE_KEYS = ['intake', 'hearing_prep', 'initial_inventory', 'monthly_records', 'annual_return_prep', 'court_review', 'complete'];
  const lifecycleStageName = LIFECYCLE_KEYS[ptDash.lifecycleStageIdx];
  log(lifecycleStageName ? 'PASS' : 'FAIL', 'Partner lifecycle stage idx valid', ptDash.lifecycleStageIdx + ' → ' + lifecycleStageName);

  // Partner views matter stats
  const ptStats = await get('/api/matters/stats/overview', ptToken);
  log(ptStats.status === 200 ? 'PASS' : 'FAIL', 'Partner: matter stats overview', 'total:' + ptStats.body.total + ' active:' + ptStats.body.active + ' at-risk:' + ptStats.body.atRisk);

  // ════════════════════════════════════════════════════════════════
  section('STEP 13 · FINAL END STATE VERIFICATION');
  // ════════════════════════════════════════════════════════════════

  const finalMatter = await get('/api/matters/' + matterId, jToken);
  const fm = finalMatter.body;
  log(fm.stage === 'initial_inventory' ? 'PASS' : 'FAIL', 'Final stage: initial_inventory', fm.stage);
  log(fm.case_number === caseNumber ? 'PASS' : 'FAIL', 'Case number preserved throughout', fm.case_number);
  log(fm.urgent === 1 ? 'PASS' : 'FAIL', 'Urgent flag persisted');

  const finalTimeline = await get('/api/matters/' + matterId + '/timeline', jToken);
  const completedStages = finalTimeline.body.filter(s => s.completed).map(s => s.stage);
  log(completedStages.includes('intake') && completedStages.includes('hearing_prep') ? 'PASS' : 'FAIL',
    'Timeline: intake + hearing_prep completed', completedStages.join(' → '));
  const nowCurrent = finalTimeline.body.find(s => s.current);
  log(nowCurrent?.stage === 'initial_inventory' ? 'PASS' : 'FAIL', 'Timeline current stage: initial_inventory');

  const finalDash = (await get('/api/dashboard/client', jToken)).body;
  log(finalDash.openTasks === 1 ? 'PASS' : 'FAIL', 'Final: 1 open task remaining', 'got: ' + finalDash.openTasks);
  log(finalDash.completedTasks === 2 ? 'PASS' : 'FAIL', 'Final: 2 tasks completed', 'got: ' + finalDash.completedTasks);
  log(finalDash.upcomingAppts?.length >= 1 ? 'PASS' : 'FAIL', 'Final: rescheduled appointment visible');
  log('INFO', 'Final readiness score for Jennifer', finalDash.readinessScore + '%');

  // ════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(65));
  console.log('  TEST SUMMARY');
  console.log('═'.repeat(65));
  const total = PASS + FAIL + WARN;
  console.log('  ✅ PASSED  : ' + PASS + ' / ' + total);
  console.log('  ❌ FAILED  : ' + FAIL);
  console.log('  ⚠️  WARNINGS: ' + WARN);
  console.log('  📊 SCORE   : ' + Math.round((PASS / (PASS + FAIL)) * 100) + '%');
  console.log('\n  Test user    : ' + JENN_EMAIL + ' / NewPass99!');
  console.log('  Case number  : ' + caseNumber + '  (id: ' + matterId + ')');
  console.log('  Final stage  : initial_inventory');
  console.log('  Tasks done   : 2 of 3');
  console.log('═'.repeat(65));

})().catch(e => { console.error('\n❌ SCRIPT ERROR:', e.message); process.exit(1); });
