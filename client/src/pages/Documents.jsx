import { useState, useEffect, useRef } from 'react';
import { documentsApi } from '../api';
import { Upload, Download, Trash2, Search, FileText, File, Eye, Edit2, X } from 'lucide-react';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import Badge, { statusVariant } from '../components/ui/Badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../context/ToastContext';

const fmtSize = (bytes) =>
  bytes > 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

const CATEGORIES = [
  'Medical Records',
  'Financial Documents',
  'Legal Filings',
  'Court Orders',
  'Identity Documents',
  'Insurance Documents',
  'Correspondence',
  'Other',
];

export default function Documents() {
  const toast = useToast();

  const [docs, setDocs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState('all');

  // Confirm-delete state
  const [confirmId, setConfirmId]       = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Edit state
  const [editDoc, setEditDoc]         = useState(null);
  const [editForm, setEditForm]       = useState({ name: '', category: '' });
  const [editLoading, setEditLoading] = useState(false);

  const fileRef = useRef();

  const load = () =>
    documentsApi.list().then(r => setDocs(r.data)).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  async function handleUpload(files) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach(f => fd.append('files', f));
      const res = await documentsApi.upload(fd);
      const newDocs = Array.isArray(res.data) ? res.data : [];
      if (newDocs.length) setDocs(prev => [...newDocs, ...prev]);
      load();
      toast.success(`${files.length} file${files.length !== 1 ? 's' : ''} uploaded`);
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function confirmDelete() {
    if (!confirmId) return;
    setDeleteLoading(true);
    try {
      await documentsApi.delete(confirmId);
      setDocs(d => d.filter(x => x.id !== confirmId));
      toast.success('Document deleted');
    } catch {
      toast.error('Delete failed. Please try again.');
    } finally {
      setDeleteLoading(false);
      setConfirmId(null);
    }
  }

  function openEdit(doc) {
    setEditDoc(doc);
    setEditForm({ name: doc.name, category: doc.category || '' });
  }

  async function saveEdit() {
    if (!editDoc) return;
    setEditLoading(true);
    try {
      const res = await documentsApi.update(editDoc.id, editForm);
      setDocs(d => d.map(x => x.id === editDoc.id ? { ...x, ...res.data } : x));
      toast.success('Document updated');
      setEditDoc(null);
    } catch {
      toast.error('Update failed. Please try again.');
    } finally {
      setEditLoading(false);
    }
  }

  const filtered = docs.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !q || d.name.toLowerCase().includes(q) || (d.category || '').toLowerCase().includes(q);
    const matchFilter = filter === 'all' || d.status === filter;
    return matchSearch && matchFilter;
  });

  const handleDrop = (e) => {
    e.preventDefault();
    handleUpload(e.dataTransfer.files);
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-500 text-sm">{docs.length} document{docs.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          aria-label="Upload files"
        >
          {uploading ? <Spinner size={4} color="text-white" /> : <Upload size={16} aria-hidden="true" />}
          Upload Files
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          className="sr-only"
          aria-label="File input"
          onChange={e => handleUpload(e.target.files)}
        />
      </div>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop zone — drag and drop files here or press Enter to browse"
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
        className="drop-zone mb-5"
      >
        <Upload size={24} className="mx-auto text-gray-400 mb-2" aria-hidden="true" />
        <div className="text-sm font-medium text-gray-600">Drag & drop files here or click to browse</div>
        <div className="text-xs text-gray-400 mt-1">PDF, DOC, DOCX, JPG, PNG · Max 20 MB each</div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search documents…"
            aria-label="Search documents"
            className="form-input pl-9 text-sm"
          />
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          aria-label="Filter by status"
          className="form-input w-auto text-sm"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="uploaded">Uploaded</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16" aria-label="Loading documents">
          <Spinner size={8} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={FileText}
            title={search || filter !== 'all' ? 'No matching documents' : 'No documents yet'}
            description={
              search || filter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Upload your first document to get started.'
            }
            action={
              !search && filter === 'all'
                ? { label: 'Upload Document', icon: Upload, onClick: () => fileRef.current?.click() }
                : undefined
            }
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table" aria-label="Documents">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['File Name', 'Uploaded By', 'Category', 'Size', 'Status', 'Date', 'Actions'].map(h => (
                    <th key={h} scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(doc => (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0" aria-hidden="true">
                          <File size={16} className="text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-800 truncate max-w-[200px]">{doc.name}</div>
                          {doc.doc_type && (
                            <div className="text-xs text-gray-400">{doc.doc_type.replace(/_/g, ' ')}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-xs whitespace-nowrap">
                      {doc.uploader_first
                        ? `${doc.uploader_first} ${doc.uploader_last}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{doc.category || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{doc.file_size ? fmtSize(doc.file_size) : '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(doc.status)}>{doc.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(doc.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {doc.file_path && (
                          <a
                            href={documentsApi.viewUrl(doc.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`View ${doc.name}`}
                            title="View document"
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            <Eye size={14} />
                          </a>
                        )}
                        {doc.file_path && (
                          <a
                            href={documentsApi.downloadUrl(doc.id)}
                            download
                            aria-label={`Download ${doc.name}`}
                            title="Download"
                            className="p-1.5 text-gray-400 hover:text-[#0f2057] hover:bg-gray-100 rounded transition-colors"
                          >
                            <Download size={14} />
                          </a>
                        )}
                        <button
                          onClick={() => openEdit(doc)}
                          aria-label={`Edit ${doc.name}`}
                          title="Edit details"
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmId(doc.id)}
                          aria-label={`Delete ${doc.name}`}
                          title="Delete"
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!confirmId}
        variant="danger"
        title="Delete document?"
        description="This file will be permanently deleted and cannot be recovered."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmId(null)}
        loading={deleteLoading}
      />

      {/* Edit modal */}
      {editDoc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">Edit Document</h2>
              <button
                onClick={() => setEditDoc(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="form-label">File Name</label>
                <input
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="form-input"
                  placeholder="Document name"
                />
              </div>
              <div>
                <label className="form-label">Category</label>
                <select
                  value={editForm.category}
                  onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                  className="form-input"
                >
                  <option value="">— Select category —</option>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              {editForm.category === '' && (
                <div>
                  <label className="form-label">Or enter custom category</label>
                  <input
                    value={editForm.category}
                    onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                    className="form-input"
                    placeholder="e.g. Tax Returns"
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 pb-6">
              <button
                onClick={() => setEditDoc(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={editLoading || !editForm.name.trim()}
                className="px-4 py-2 text-sm font-semibold bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                {editLoading ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}