// Single source of truth for the password strength rule, shared by the Zod
// schema in middleware/validate.js (used for /register, /reset-password,
// /reset-password/phone, /change-password) and the admin-set-password route
// in routes/admin.js, which doesn't go through validate().
const SPECIAL_CHAR_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

function passwordIssues(pw) {
  const issues = [];
  if (!pw || pw.length < 8) issues.push('at least 8 characters');
  if (!/[A-Z]/.test(pw || '')) issues.push('one uppercase letter');
  if (!/\d/.test(pw || '')) issues.push('one number');
  if (!SPECIAL_CHAR_RE.test(pw || '')) issues.push('one special character (e.g. $ or %)');
  return issues;
}

function isStrongPassword(pw) {
  return passwordIssues(pw).length === 0;
}

const PASSWORD_REQUIREMENTS_MESSAGE =
  'Password must be at least 8 characters and include one uppercase letter, one number, and one special character (e.g. $ or %)';

module.exports = { SPECIAL_CHAR_RE, passwordIssues, isStrongPassword, PASSWORD_REQUIREMENTS_MESSAGE };
