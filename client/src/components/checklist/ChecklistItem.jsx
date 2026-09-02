import { useRef, useState } from 'react';
import {
  Check, Clock, AlertCircle, Upload, FileText,
  Download, XCircle, MinusCircle, Info, ChevronDown, ChevronUp,
} from 'lucide-react';
import checklistApi from '../../api/checklist.api';
import { downloadFile } from '../../lib/fileActions';
import { useToast } from '../../context/ToastContext';
import Spinner from '../ui/Spinner';

const STATUS_LABEL = {
  needed_now:            'Needed Now',
  if_available:          'If Available',
  upload_later:          'Upload Later',
  attorney_will_request: 'Attorney Will Request',
  submitted:             'Pending Review',
  accepted:              'Accepted',
  needs_correction:      'Needs Correction',
  not_applicable:        'N/A',
};

// Checkbox appearance per status
function CheckboxIcon({ status }) {
  if (status === 'accepted') {
    return (
      <div className="w-5 h-5 rounded bg-green-500 border-2 border-green-500 flex items-center justify-center flex-shrink-0">
        <Check size={11} className="text-white" strokeWidth={3} />
      </div>
    );
  }
  if (status === 'submitted') {
    return (
      <div className="w-5 h-5 rounded bg-amber-400 border-2 border-amber-400 flex items-center justify-center flex-shrink-0">
        <Clock size={10} className="text-white" />
      </div>
    );
  }
  if (status === 'needs_correction') {
    return (
      <div className="w-5 h-5 rounded bg-red-100 border-2 border-red-400 flex items-center justify-center flex-shrink-0">
        <XCircle size={10} className="text-red-500" />
      </div>
    );
  }
  if (status === 'not_applicable') {
    return (
      <div className="w-5 h-5 rounded bg-gray-100 border-2 border-gray-300 flex items-center justify-center flex-shrink-0">
        <MinusCircle size={10} className="text-gray-400" />
      </div>
    );
  }
  if (status === 'if_available' || status === 'upload_later' || status === 'attorney_will_request') {
    return (
      <div className="w-5 h-5 rounded border-2 border-gray-200 bg-gray-50 flex items-center justify-center flex-shrink-0">
        <Info size={9} className="text-gray-300" />
      </div>
    );
  }
  // needed_now — empty checkbox, ready to upload
  return (
    <div className="w-5 h-5 rounded border-2 border-red-300 bg-white flex-shrink-0 group-hover:border-[#0f2057] transition-colors" />
  );
}

function StatusBadge({ status }) {
  const cls = {
    needed_now:            'bg-red-100 text-red-700',
    if_available:          'bg-blue-50 text-blue-600',
    upload_later:          'bg-gray-100 text-gray-500',
    attorney_will_request: 'bg-purple-50 text-purple-600',
    submitted:             'bg-amber-50 text-amber-700',
    accepted:              'bg-green-50 text-green-700',
    needs_correction:      'bg-red-100 text-red-700',
    not_applicable:        'bg-gray-100 text-gray-500',
  }[status] || 'bg-gray-100 text-gray-500';

  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${cls}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export default function ChecklistItem({ item, onUpdated }) {
  const toast   = useToast();
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]  = useState(0);
  const [expanded, setExpanded]  = useState(false);

  const canUpload    = !['accepted', 'not_applicable', 'attorney_will_request'].includes(item.status);
  const isCorrection = item.status === 'needs_correction';
  const isChecked    = ['submitted', 'accepted', 'not_applicable'].includes(item.status);

  async function handleDownloadFile() {
    try {
      await downloadFile(checklistApi.fileBlob(item.id), item.file_name);
    } catch {
      toast.error('Download failed. Please try again.');
    }
  }

  async function handleFile(file) {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    try {
      const res = await checklistApi.uploadFile(item.id, file, e => {
        if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
      });
      onUpdated(res.data);
      toast.success('File uploaded — pending attorney review. Added to Open Tasks.');
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const rowBg = isCorrection
    ? 'border-red-200 bg-red-50/50'
    : item.status === 'accepted'
    ? 'border-green-200 bg-green-50/30'
    : item.status === 'submitted'
    ? 'border-amber-200 bg-amber-50/20'
    : item.status === 'needed_now'
    ? 'border-gray-200 bg-white hover:border-[#0f2057]/30'
    : 'border-gray-100 bg-gray-50/50';

  return (
    <div className={`rounded-xl border transition-all ${rowBg} ${uploading ? 'opacity-80' : ''}`}>
      <div className="flex items-start gap-3 p-3.5">
        {/* Checkbox — clicking triggers upload for uploadable items */}
        <button
          onClick={() => canUpload && !uploading && fileRef.current?.click()}
          className="mt-0.5 group flex-shrink-0 focus:outline-none"
          disabled={!canUpload || uploading}
          aria-label={isChecked ? `${item.label} — ${STATUS_LABEL[item.status]}` : `Upload file for ${item.label}`}
          title={canUpload ? 'Click to upload file' : STATUS_LABEL[item.status]}
        >
          <CheckboxIcon status={item.status} />
        </button>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <p className={`text-sm font-medium leading-snug ${isChecked ? 'text-gray-500' : 'text-gray-800'} ${item.status === 'accepted' ? 'line-through' : ''}`}>
              {item.label}
            </p>
            <StatusBadge status={item.status} />
          </div>

          {/* Description (collapsible) */}
          {item.description && (
            <div>
              <p className={`text-xs text-gray-400 mt-0.5 leading-relaxed ${!expanded && 'line-clamp-1'}`}>
                {item.description}
              </p>
              {item.description.length > 80 && (
                <button onClick={() => setExpanded(v => !v)} className="text-[10px] text-[#0f2057] mt-0.5 flex items-center gap-0.5">
                  {expanded ? <><ChevronUp size={10} />Less</> : <><ChevronDown size={10} />More</>}
                </button>
              )}
            </div>
          )}

          {/* Attorney correction note */}
          {isCorrection && item.attorney_notes && (
            <div className="mt-2 p-2.5 bg-red-100 border border-red-200 rounded-lg text-xs text-red-700 leading-relaxed">
              <span className="font-semibold">Attorney note: </span>{item.attorney_notes}
            </div>
          )}

          {/* Uploaded file chip */}
          {item.file_name && item.status !== 'needed_now' && item.status !== 'if_available' && (
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              <FileText size={12} className="text-gray-400 flex-shrink-0" />
              <span className="truncate max-w-[180px]">{item.file_name}</span>
              {item.file_size && (
                <span className="text-gray-400">
                  ({item.file_size > 1_048_576
                    ? `${(item.file_size / 1_048_576).toFixed(1)} MB`
                    : `${Math.round(item.file_size / 1024)} KB`})
                </span>
              )}
              <button
                aria-label={`Download ${item.file_name}`}
                className="ml-1 text-[#0f2057] hover:text-blue-700"
                onClick={e => { e.stopPropagation(); handleDownloadFile(); }}
              >
                <Download size={12} />
              </button>
            </div>
          )}

          {/* Upload progress bar */}
          {uploading && (
            <div className="mt-2 flex items-center gap-2">
              <Spinner size={4} color="text-[#0f2057]" />
              <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                <div className="bg-[#0f2057] h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs text-gray-500">{progress}%</span>
            </div>
          )}

          {/* Upload button (secondary) for items that can be uploaded */}
          {canUpload && !uploading && (
            <button
              onClick={() => fileRef.current?.click()}
              className={`mt-2 flex items-center gap-1.5 text-xs font-medium transition-colors ${
                isCorrection
                  ? 'text-red-600 hover:text-red-800'
                  : 'text-[#0f2057] hover:text-blue-700'
              }`}
              aria-label={`Upload file for ${item.label}`}
            >
              <Upload size={12} />
              {item.file_name ? 'Replace file' : isCorrection ? 'Fix & Re-upload' : 'Upload file'}
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        className="sr-only"
        aria-label={`File input for ${item.label}`}
        onChange={e => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}