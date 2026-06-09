import { useState } from 'react';
import { X, CheckCircle, XCircle, MinusCircle, FileText, ExternalLink, User, Briefcase } from 'lucide-react';
import checklistApi from '../../api/checklist.api';
import { useToast } from '../../context/ToastContext';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';

const MATTER_TYPE_LABELS = {
  conservatorship:                  'Conservatorship',
  estate_administration:            'Estate Administration',
  guardianship:                     'Guardianship',
  joint_guardianship_conservatorship: 'Joint Guardianship & Conservatorship',
};

const STATUS_CFG = {
  submitted:        { badge: 'warning', label: 'Pending Review' },
  accepted:         { badge: 'success', label: 'Accepted' },
  needs_correction: { badge: 'error',   label: 'Needs Correction' },
  not_applicable:   { badge: 'default', label: 'N/A' },
};

export default function AttorneyReviewPanel({ item, onClose, onReviewed }) {
  const toast = useToast();
  const [action, setAction]           = useState('');
  const [reason, setReason]           = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [reasonError, setReasonError] = useState('');

  if (!item) return null;

  const cfg = STATUS_CFG[item.status] || STATUS_CFG.submitted;

  async function handleSubmit() {
    if (!action) return;
    if (action === 'needs_correction' && !reason.trim()) {
      setReasonError('Please describe what needs to be corrected.');
      return;
    }
    setReasonError('');
    setSubmitting(true);
    try {
      const res = await checklistApi.reviewItem(item.id, action, reason.trim());
      onReviewed(res.data);
      toast.success(
        action === 'accepted'        ? 'Document accepted'
        : action === 'not_applicable' ? 'Item marked Not Applicable'
        : 'Correction requested — task created for client'
      );
      onClose();
    } catch {
      toast.error('Review failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title="Review Document"
      size="lg"
      description={`Reviewing: ${item.label}`}
      footer={
        <div className="flex items-center justify-between w-full gap-3">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="danger"
              leftIcon={<XCircle size={15} />}
              onClick={() => { setAction('needs_correction'); }}
              disabled={submitting || !item.file_path}
              className={action === 'needs_correction' ? 'ring-2 ring-red-400' : ''}
            >
              Request Correction
            </Button>
            <Button
              variant="ghost"
              leftIcon={<MinusCircle size={15} />}
              onClick={() => { setAction('not_applicable'); setReason(''); setReasonError(''); }}
              disabled={submitting}
              className={action === 'not_applicable' ? 'ring-2 ring-gray-400' : ''}
            >
              Not Applicable
            </Button>
            <Button
              variant="primary"
              leftIcon={<CheckCircle size={15} />}
              onClick={() => action === 'accepted' ? handleSubmit() : (setAction('accepted'), setReason(''), setReasonError(''))}
              loading={submitting && action === 'accepted'}
              disabled={submitting || !item.file_path}
              className={action === 'accepted' ? 'ring-2 ring-green-400' : ''}
            >
              Accept File
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Matter context */}
        <div className="flex flex-wrap gap-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
          <div className="flex items-center gap-1.5">
            <User size={13} className="text-gray-400" />
            <span className="font-medium">{item.client_first} {item.client_last}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Briefcase size={13} className="text-gray-400" />
            <span>{item.case_number}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Type:</span>
            <span>{MATTER_TYPE_LABELS[item.matter_type] || item.matter_type}</span>
          </div>
          <Badge variant={cfg.badge} size="sm">{cfg.label}</Badge>
        </div>

        {/* Item label + description */}
        <div>
          <h3 className="text-sm font-semibold text-gray-800">{item.label}</h3>
          {item.description && (
            <p className="text-xs text-gray-500 mt-1">{item.description}</p>
          )}
        </div>

        {/* Uploaded file */}
        {item.file_name ? (
          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <FileText size={16} className="text-[#0f2057]" aria-hidden="true" />
              <div>
                <div className="font-medium">{item.file_name}</div>
                {item.file_size && (
                  <div className="text-xs text-gray-500">
                    {item.file_size > 1_048_576
                      ? `${(item.file_size / 1_048_576).toFixed(1)} MB`
                      : `${Math.round(item.file_size / 1024)} KB`}
                  </div>
                )}
              </div>
            </div>
            <a
              href={checklistApi.downloadUrl(item.id)}
              target="_blank"
              rel="noreferrer"
              aria-label="Open file in new tab"
              className="flex items-center gap-1 text-xs text-[#0f2057] hover:underline font-medium"
            >
              <ExternalLink size={13} />
              View file
            </a>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
            <X size={15} />
            No file uploaded yet — only "Not Applicable" is available.
          </div>
        )}

        {/* Confirm action callout */}
        {action && (
          <div className={`p-3 rounded-lg border text-sm ${
            action === 'accepted'         ? 'bg-green-50 border-green-200 text-green-800'
            : action === 'not_applicable' ? 'bg-gray-50 border-gray-200 text-gray-700'
            : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {action === 'accepted'         && 'Ready to accept this document. Click "Accept File" to confirm.'}
            {action === 'not_applicable'   && 'This item will be marked Not Applicable for this matter. Click "Not Applicable" again to confirm.'}
            {action === 'needs_correction' && 'Describe what the client needs to fix. This will create an open task and notify them.'}
          </div>
        )}

        {/* Correction reason textarea */}
        {action === 'needs_correction' && (
          <div>
            <label htmlFor="correction-reason" className="block text-xs font-semibold text-gray-700 mb-1.5">
              Correction reason <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <textarea
              id="correction-reason"
              rows={3}
              value={reason}
              onChange={e => { setReason(e.target.value); setReasonError(''); }}
              placeholder="e.g. The document is illegible — please re-scan at higher resolution."
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2057] resize-none ${
                reasonError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300'
              }`}
              aria-describedby={reasonError ? 'reason-error' : undefined}
            />
            {reasonError && (
              <p id="reason-error" className="text-xs text-red-600 mt-1">{reasonError}</p>
            )}

            {/* Submit correction */}
            {reason.trim() && (
              <div className="mt-3 flex justify-end">
                <Button
                  variant="danger"
                  leftIcon={<XCircle size={14} />}
                  loading={submitting}
                  onClick={handleSubmit}
                >
                  Send Correction Request
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Confirm Not Applicable */}
        {action === 'not_applicable' && (
          <div className="flex justify-end">
            <Button
              variant="secondary"
              leftIcon={<MinusCircle size={14} />}
              loading={submitting}
              onClick={handleSubmit}
            >
              Confirm Not Applicable
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}