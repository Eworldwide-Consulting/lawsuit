import { useRef, useState } from 'react';
import {
  CheckCircle, Clock, AlertCircle, Upload, FileText,
  Download, XCircle, MinusCircle, Info,
} from 'lucide-react';
import checklistApi from '../../api/checklist.api';
import { useToast } from '../../context/ToastContext';
import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';

// Status → visual config
const STATUS_CFG = {
  needed_now:              { Icon: AlertCircle, cls: 'text-red-500',    badge: 'error',   label: 'Needed Now' },
  if_available:            { Icon: Info,        cls: 'text-blue-400',   badge: 'info',    label: 'If Available' },
  upload_later:            { Icon: Clock,       cls: 'text-gray-400',   badge: 'default', label: 'Upload Later' },
  attorney_will_request:   { Icon: Clock,       cls: 'text-purple-400', badge: 'purple',  label: 'Attorney Will Request' },
  submitted:               { Icon: Clock,       cls: 'text-yellow-500', badge: 'warning', label: 'Pending Review' },
  accepted:                { Icon: CheckCircle, cls: 'text-green-500',  badge: 'success', label: 'Accepted' },
  needs_correction:        { Icon: XCircle,     cls: 'text-red-500',    badge: 'error',   label: 'Needs Correction' },
  not_applicable:          { Icon: MinusCircle, cls: 'text-gray-400',   badge: 'default', label: 'N/A' },
};

export default function ChecklistItem({ item, onUpdated }) {
  const toast    = useToast();
  const fileRef  = useRef();
  const [uploading, setUploading]   = useState(false);
  const [progress, setProgress]     = useState(0);

  const cfg = STATUS_CFG[item.status] || STATUS_CFG.if_available;
  const { Icon } = cfg;

  const canUpload = !['accepted', 'not_applicable', 'attorney_will_request'].includes(item.status);
  const isCorrection = item.status === 'needs_correction';

  async function handleFile(file) {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    try {
      const res = await checklistApi.uploadFile(item.id, file, e => {
        if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
      });
      onUpdated(res.data);
      toast.success('File uploaded — pending attorney review');
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div
      className={`rounded-lg border transition-colors ${
        isCorrection
          ? 'border-red-200 bg-red-50/40'
          : item.status === 'accepted'
          ? 'border-green-200 bg-green-50/30'
          : item.status === 'submitted'
          ? 'border-yellow-200 bg-yellow-50/30'
          : 'border-gray-200 bg-white'
      } p-3.5`}
    >
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div className="flex-shrink-0 mt-0.5">
          <Icon size={17} className={cfg.cls} aria-hidden="true" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-800 leading-snug">{item.label}</p>
            <Badge variant={cfg.badge} size="sm">{cfg.label}</Badge>
          </div>

          {item.description && (
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.description}</p>
          )}

          {/* Attorney correction note */}
          {isCorrection && item.attorney_notes && (
            <div className="mt-2 p-2.5 bg-red-100 border border-red-200 rounded-lg text-xs text-red-700 leading-relaxed">
              <span className="font-semibold">Attorney note: </span>{item.attorney_notes}
            </div>
          )}

          {/* Uploaded file chip */}
          {item.file_name && item.status !== 'needed_now' && item.status !== 'if_available' && (
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
              <FileText size={12} className="text-gray-400" aria-hidden="true" />
              <span className="truncate max-w-[180px]">{item.file_name}</span>
              {item.file_size && (
                <span className="text-gray-400">
                  ({item.file_size > 1_048_576
                    ? `${(item.file_size / 1_048_576).toFixed(1)} MB`
                    : `${Math.round(item.file_size / 1024)} KB`})
                </span>
              )}
              <a
                href={checklistApi.downloadUrl(item.id)}
                target="_blank"
                rel="noreferrer"
                aria-label={`Download ${item.file_name}`}
                className="ml-1 text-[#0f2057] hover:text-blue-700"
              >
                <Download size={12} />
              </a>
            </div>
          )}

          {/* Upload button / progress */}
          {canUpload && (
            <div className="mt-2">
              {uploading ? (
                <div className="flex items-center gap-2">
                  <Spinner size={4} color="text-[#0f2057]" />
                  <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-[#0f2057] h-1.5 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{progress}%</span>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#0f2057] hover:text-blue-700 transition-colors"
                  aria-label={`Upload file for ${item.label}`}
                >
                  <Upload size={13} aria-hidden="true" />
                  {item.file_name ? 'Replace file' : 'Upload file'}
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                className="sr-only"
                aria-label={`File input for ${item.label}`}
                onChange={e => handleFile(e.target.files?.[0])}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}