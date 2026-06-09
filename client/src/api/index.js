// Barrel re-export — all domain API modules are importable directly
// (e.g. import authApi from './api/auth.api') or via this index for
// backward compatibility with existing named imports.

export { default as http } from './http';
export { default as authApi } from './auth.api';
export { default as mattersApi } from './matters.api';
export { default as documentsApi } from './documents.api';
export { default as messagesApi } from './messages.api';
export { default as appointmentsApi } from './appointments.api';
export { default as tasksApi } from './tasks.api';
export { default as dashboardApi } from './dashboard.api';
export { default as usersApi } from './users.api';
export { default as paymentsApi } from './payments.api';
export { default as adminApi } from './admin.api';
export { default as notificationsApi } from './notifications.api';
export { default as checklistApi }     from './checklist.api';

export { default } from './http';