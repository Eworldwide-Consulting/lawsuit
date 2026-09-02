import { Check, Clock } from 'lucide-react';

// Shared attorney-assignment status indicator used across all client-facing
// dashboards (ClientDashboard, MyCase, ...) so the acceptance state always
// reads the same way — green check once the attorney has accepted the case.
export default function AttorneyStatusBadge({ hasAttorney, caseAccepted, className = '' }) {
  if (!hasAttorney) {
    return <span className={`text-xs font-medium text-amber-600 dark:text-amber-400 ${className}`}>Not yet assigned</span>;
  }
  if (caseAccepted) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 ${className}`}>
        <Check size={12} strokeWidth={3} className="flex-shrink-0" /> Case Accepted
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 ${className}`}>
      <Clock size={12} className="flex-shrink-0" /> Pending Acceptance
    </span>
  );
}
