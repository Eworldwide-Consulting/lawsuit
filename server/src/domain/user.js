// Columns loaded by the auth middleware and cached per-request.
// M1: password_hash excluded — it is never needed on authenticated routes
// (password changes use a dedicated repo call). Minimising cached secrets
// reduces the blast radius of any future cache-poisoning or log-leak bug.
// `status` is loaded here (not just at login) so requireAuth can freeze an
// already-issued session the moment an admin suspends the account, rather than
// letting the existing JWT keep working until it expires.
const USER_COLUMNS = `
  id, first_name, last_name, email, role, phone, avatar_initials,
  email_verified, approval_status, two_fa_enabled, two_fa_secret,
  two_fa_prompt_shown, is_prime, google_id, avatar_url, login_provider, last_login,
  status
`.trim();

// Extended column set used only at login — bcrypt.compare needs the hash.
const LOGIN_COLUMNS = `${USER_COLUMNS}, password_hash`;

const ROLES = Object.freeze({
  CLIENT:    'client',
  ATTORNEY:  'attorney',
  PARTNER:   'partner',
  ITSUPPORT: 'itsupport',
});

const STAFF_ROLES = new Set([ROLES.ATTORNEY, ROLES.PARTNER, ROLES.ITSUPPORT]);
const ADMIN_ROLES = new Set([ROLES.PARTNER, ROLES.ITSUPPORT]);

// Account lifecycle. Rows written before the status column existed read as
// NULL, which is treated as ACTIVE everywhere via normalizeStatus().
const USER_STATUS = Object.freeze({
  ACTIVE:    'active',
  SUSPENDED: 'suspended',
  DELETED:   'deleted',
});

function normalizeStatus(status) {
  return status || USER_STATUS.ACTIVE;
}

function isSuspended(user) {
  return normalizeStatus(user?.status) === USER_STATUS.SUSPENDED;
}

function isDeleted(user) {
  return normalizeStatus(user?.status) === USER_STATUS.DELETED;
}

// Returns only the fields safe to expose in API responses.
// Never lets password_hash, two_fa_secret, or verification tokens leave the server.
function sanitizeUser(user) {
  return {
    id:                   user.id,
    first_name:           user.first_name,
    last_name:            user.last_name,
    email:                user.email,
    role:                 user.role,
    phone:                user.phone           ?? null,
    avatar_initials:      user.avatar_initials  ?? null,
    avatar_url:           user.avatar_url       ?? null,
    email_verified:       user.email_verified   ?? 0,
    approval_status:      user.approval_status  ?? null,
    two_fa_enabled:       user.two_fa_enabled   ?? 0,
    two_fa_prompt_shown:  user.two_fa_prompt_shown ?? 0,
    is_prime:             user.is_prime         ?? 0,
    login_provider:       user.login_provider   ?? 'email',
    has_google:           Boolean(user.google_id),
    last_login:           user.last_login       ?? null,
    status:               normalizeStatus(user.status),
  };
}

function isStaff(role)  { return STAFF_ROLES.has(role); }
function isAdmin(role)  { return ADMIN_ROLES.has(role); }
function isClient(role) { return role === ROLES.CLIENT; }

module.exports = {
  USER_COLUMNS, LOGIN_COLUMNS, ROLES, STAFF_ROLES, ADMIN_ROLES, USER_STATUS,
  sanitizeUser, isStaff, isAdmin, isClient,
  normalizeStatus, isSuspended, isDeleted,
};