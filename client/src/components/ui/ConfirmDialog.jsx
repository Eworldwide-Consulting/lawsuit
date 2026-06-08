import Modal from './Modal';
import Button from './Button';
import { AlertTriangle, Trash2, Info, AlertCircle } from 'lucide-react';

const CONFIGS = {
  danger:  { Icon: Trash2,        iconWrap: 'bg-red-50 text-red-500',     confirm: 'danger'   },
  warning: { Icon: AlertTriangle, iconWrap: 'bg-yellow-50 text-yellow-500', confirm: 'primary'  },
  default: { Icon: Info,          iconWrap: 'bg-blue-50 text-blue-500',    confirm: 'primary'  },
  info:    { Icon: AlertCircle,   iconWrap: 'bg-blue-50 text-blue-500',    confirm: 'primary'  },
};

/**
 * ConfirmDialog — accessible confirmation modal.
 * Replaces window.confirm() with a non-blocking, styled alternative.
 *
 * Props:
 *   open          bool
 *   onConfirm     () => void | Promise<void>
 *   onCancel      () => void
 *   title         string
 *   description   string
 *   confirmLabel  string (default 'Confirm')
 *   cancelLabel   string (default 'Cancel')
 *   variant       'default' | 'danger' | 'warning' | 'info'
 *   loading       bool — disables buttons and shows spinner on confirm
 */
export default function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  variant = 'default',
  loading = false,
}) {
  const cfg  = CONFIGS[variant] ?? CONFIGS.default;
  const Icon = cfg.Icon;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="sm"
      showCloseButton={false}
      closeOnBackdrop={!loading}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={cfg.confirm} size="sm" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-4 items-start">
        <div className={`p-2.5 rounded-full flex-shrink-0 ${cfg.iconWrap}`}>
          <Icon size={20} aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 leading-snug">{title}</h3>
          {description && (
            <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
    </Modal>
  );
}