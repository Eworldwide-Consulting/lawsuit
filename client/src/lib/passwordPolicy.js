// Single source of truth for the password strength rule on the client side —
// used by Register, ResetPassword, ForgotPassword (phone reset), and Settings
// (change password). Kept in sync with server/src/lib/passwordPolicy.js
// (same character class both sides).
export const SPECIAL_CHAR_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

export const PASSWORD_RULES = [
  { key: 'length',  label: 'At least 8 characters',                test: pw => pw.length >= 8 },
  { key: 'upper',   label: 'One uppercase letter (A-Z)',            test: pw => /[A-Z]/.test(pw) },
  { key: 'digit',   label: 'One number (0-9)',                      test: pw => /\d/.test(pw) },
  { key: 'special', label: 'One special character (e.g. $ or %)',   test: pw => SPECIAL_CHAR_RE.test(pw) },
];

export function passwordMeetsRules(pw) {
  return PASSWORD_RULES.every(r => r.test(pw || ''));
}

export const PASSWORD_REQUIREMENTS_MESSAGE =
  'Password must be at least 8 characters and include one uppercase letter, one number, and one special character (e.g. $ or %)';
