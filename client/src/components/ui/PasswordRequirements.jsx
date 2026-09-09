import { Check } from 'lucide-react';
import { PASSWORD_RULES } from '../../lib/passwordPolicy';

// Live per-rule checklist shown under a new-password field — used on
// Register, ResetPassword, ForgotPassword (phone reset), and Settings
// (change password) so the requirement is communicated the same way
// everywhere a password gets created or changed.
export default function PasswordRequirements({ password }) {
  if (!password) return null;
  return (
    <ul className="mt-1.5 space-y-0.5">
      {PASSWORD_RULES.map(r => {
        const ok = r.test(password);
        return (
          <li key={r.key} className={`text-xs flex items-center gap-1.5 ${ok ? 'text-green-600' : 'text-gray-400'}`}>
            <Check size={12} className={ok ? 'opacity-100' : 'opacity-30'} />
            {r.label}
          </li>
        );
      })}
    </ul>
  );
}
