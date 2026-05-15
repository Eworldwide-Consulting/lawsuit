import { useState, useRef } from 'react';
import { documentsApi } from '../../api';
import { Upload, CheckCircle, X, FileText } from 'lucide-react';
import Spinner from './Spinner';

const CATEGORIES = [
  '1. Court & Legal Documents',
  '2. Medical & Care Information',
  '3. Financial & Asset Documents',
  '4. Monthly & Annual Reports',
  '5. Intake Documents',
  '6. Additional Documents',
];

const fmtSize = bytes =>
  bytes >= 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;

export default function DocumentUploadPanel({ matters = [], onUploaded }) {
  const [matterId, setMatterId]   = useState('');
  const [category, setCategory]   = useState(CATEGORIES[0]);
  const [files, setFiles]         = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded]   = useState([]);
  const [error, setError]         = useState('');
  const [dragOver, setDragOver]   = useState(false);
  const fileRef = useRef();

  const addFiles = raw => {
    setError('');
    setUploaded([]);
    setFiles(prev => [...prev, ...Array.from(raw)]);
  };

  const removeFile = idx => setFiles(prev => prev.filter((_, i) => i !== idx));

  const handleDrop = e => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const handleUpload = async () => {
    if (!matterId)     { setError('Select a matter first.'); return; }
    if (!files.length) { setError('Add at least one file.'); return; }
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      files.forEach(f => fd.append('files', f));
      fd.append('matterId', matterId);
      fd.append('category', category);
      const res = await documentsApi.upload(fd);
      setUploaded(res.data.map(d => d.name));
      setFiles([]);
      if (onUploaded) onUploaded(res.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Upload failed — please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="card p-4">
      <div className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
        <Upload size={14} className="text-green-600" />
        Upload Document to Client
      </div>

      {/* Matter selector */}
      <div className="mb-3">
        <label className="text-[11px] font-medium text-gray-500 mb-1 block">Matter</label>
        <select
          value={matterId}
          onChange={e => setMatterId(e.target.value)}
          className="form-input text-sm w-full"
        >
          <option value="">— select matter —</option>
          {matters.map(m => (
            <option key={m.id} value={m.id}>
              {m.case_number} · {(m.client_name || m.description || '').slice(0, 40)}
            </option>
          ))}
        </select>
      </div>

      {/* Category selector */}
      <div className="mb-3">
        <label className="text-[11px] font-medium text-gray-500 mb-1 block">Category</label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="form-input text-sm w-full"
        >
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c.replace(/^\d+\.\s*/, '')}</option>
          ))}
        </select>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors mb-3 ${
          dragOver ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-green-400 hover:bg-gray-50'
        }`}
      >
        <Upload size={20} className="mx-auto text-gray-400 mb-1.5" />
        <div className="text-xs font-medium text-gray-600">Drop files here or click to browse</div>
        <div className="text-[10px] text-gray-400 mt-0.5">PDF · DOC · DOCX · JPG · PNG (max 20 MB)</div>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          className="hidden"
          onChange={e => addFiles(e.target.files)}
        />
      </div>

      {/* Staged files */}
      {files.length > 0 && (
        <div className="space-y-1.5 mb-3 max-h-36 overflow-y-auto">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 bg-blue-50 rounded-lg px-2.5 py-1.5">
              <FileText size={12} className="text-blue-500 flex-shrink-0" />
              <span className="text-xs text-gray-700 flex-1 truncate">{f.name}</span>
              <span className="text-[10px] text-gray-400 whitespace-nowrap">{fmtSize(f.size)}</span>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); removeFile(i); }}
                className="text-gray-400 hover:text-red-500 flex-shrink-0 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
          {error}
        </div>
      )}

      {/* Success */}
      {uploaded.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-1.5 text-green-700 text-xs font-semibold mb-1">
            <CheckCircle size={13} />
            {uploaded.length} file{uploaded.length > 1 ? 's' : ''} uploaded — visible on client dashboard
          </div>
          {uploaded.map((name, i) => (
            <div key={i} className="text-[10px] text-green-600 truncate">• {name}</div>
          ))}
        </div>
      )}

      {/* Upload button */}
      <button
        onClick={handleUpload}
        disabled={uploading || !files.length}
        className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white text-sm font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
      >
        {uploading ? <Spinner size={4} color="text-white" /> : <Upload size={14} />}
        {uploading
          ? 'Uploading…'
          : files.length > 0
            ? `Upload ${files.length} file${files.length > 1 ? 's' : ''}`
            : 'Upload Files'}
      </button>
    </div>
  );
}
