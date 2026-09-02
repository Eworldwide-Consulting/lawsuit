import { useState, useEffect, useRef } from 'react';
import { documentsApi, mattersApi } from '../api';
import { Upload, Download, Trash2, Search, FileText, File, Eye, Edit2, X, Send, CheckCircle, XCircle, RotateCcw, User } from 'lucide-react';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import Badge, { statusVariant } from '../components/ui/Badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

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
  const { user } = useAuth();

  const [docs, setDocs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState('all');
  const [submitting, setSubmitting] = useState({});

  // Confirm-delete state
  const [confirmId, setConfirmId]       = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Edit state
  const [editDoc, setEditDoc]         = useState(null);
  const [editForm, setEditForm]       = useState({ name: '', category: '' });
  const [editLoading, setEditLoading] = useState(false);

  // Attorney review state
  const [reviewing, setReviewing]       = useState({});
  const [rejectDoc, setRejectDoc]       = useState(null);
  const [rejectNote, setRejectNote]     = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  // Client re-upload state (for rejected documents)
  const [reuploadTarget, setReuploadTarget] = useState(null);
  const [reuploading, setReuploading]       = useState({});

  // Which matter/client an upload gets attached to. Staff must explicitly
  // choose one (a firm can have many clients); a client only ever has their
  // own matter(s), so theirs is auto-selected — no prompt needed.
  const [matters, setMatters]               = useState([]);
  const [selectedMatterId, setSelectedMatterId] = useState('');

  const fileRef     = useRef();
  const reuploadRef = useRef();

  const isStaff = ['attorney', 'partner', 'itsupport'].includes(user?.role);

  const load = () =>
    documentsApi.list().then(r => setDocs(r.data)).finally(() => setLoading(false));

  useEffect(() => {
    load();
    mattersApi.list({ limit: 200 }).then(r => {
      const list = r.data?.matters || r.data || [];
      setMatters(list);
      // Client: silently attach their own (most recent) matter to every
      // upload. Staff: leave unselected — they must pick a client below.
      if (!isStaff && list.length) setSelectedMatterId(String(list[0].id));
    }).catch(() => {});
  }, []);

  const selectedMatter = matters.find(m => String(m.id) === String(selectedMatterId));

  async function handleUpload(files) {
    if (!files?.length) return;
    if (isStaff && !selectedMatterId) {
      toast.error('Select which client this document is for before uploading.');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach(f => fd.append('files', f));
      if (selectedMatterId) fd.append('matterId', selectedMatterId);
      const res = await documentsApi.upload(fd);
      const newDocs = Array.isArray(res.data) ? res.data : [];
      if (newDocs.length) setDocs(prev => [...newDocs, ...prev]);
      load();
      const count = files.length;
      toast.success(
        isStaff && selectedMatter
          ? `${count} file${count !== 1 ? 's' : ''} uploaded for ${selectedMatter.client_name} — they've been notified`
          : `${count} file${count !== 1 ? 's' : ''} uploaded`
      );
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function sendForReview(doc) {
    setSubmitting(s => ({ ...s, [doc.id]: true }));
    try {
      await documentsApi.submitForReview(doc.id);
      setDocs(d => d.map(x => x.id === doc.id ? { ...x, status: 'pending' } : x));
      toast.success('Sent to your attorney for review');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not send for review. Please try again.');
    } finally {
      setSubmitting(s => ({ ...s, [doc.id]: false }));
    }
  }

  async function approveDoc(doc) {
    setReviewing(s => ({ ...s, [doc.id]: true }));
    try {
      await documentsApi.updateStatus(doc.id, 'approved');
      setDocs(d => d.map(x => x.id === doc.id ? { ...x, status: 'approved', review_note: null } : x));
      toast.success(`"${doc.name}" approved`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not approve document.');
    } finally {
      setReviewing(s => ({ ...s, [doc.id]: false }));
    }
  }

  async function confirmReject() {
    if (!rejectDoc || !rejectNote.trim()) return;
    setRejectLoading(true);
    try {
      await documentsApi.updateStatus(rejectDoc.id, 'rejected', rejectNote.trim());
      setDocs(d => d.map(x => x.id === rejectDoc.id ? { ...x, status: 'rejected', review_note: rejectNote.trim() } : x));
      toast.success(`"${rejectDoc.name}" rejected — the client can now re-upload`);
      setRejectDoc(null);
      setRejectNote('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not reject document.');
    } finally {
      setRejectLoading(false);
    }
  }

  function startReupload(doc) {
    setReuploadTarget(doc);
    reuploadRef.current?.click();
  }

  async function handleReupload(file) {
    const doc = reuploadTarget;
    if (!doc || !file) return;
    setReuploading(s => ({ ...s, [doc.id]: true }));
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await documentsApi.reupload(doc.id, fd);
      setDocs(d => d.map(x => x.id === doc.id ? { ...x, ...res.data } : x));
      toast.success('Document re-uploaded and sent back to your attorney for review');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Re-upload failed. Please try again.');
    } finally {
      setReuploading(s => ({ ...s, [doc.id]: false }));
      setReuploadTarget(null);
      if (reuploadRef.current) reuploadRef.current.value = '';
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
          disabled={uploading || (isStaff && !selectedMatterId)}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          aria-label="Upload files"
          title={isStaff && !selectedMatterId ? 'Select a client first' : undefined}
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
        <input
          ref={reuploadRef}
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          className="sr-only"
          aria-label="Re-upload file input"
          onChange={e => handleReupload(e.target.files?.[0])}
        />
      </div>

      {/* Staff: choose which client this upload is for — required before
          anything can be uploaded, so a document is never accidentally
          orphaned from a matter (which would make it invisible to the
          client and skip their notification). */}
      {isStaff && (
        <div className="card p-4 mb-5">
          <label className="form-label flex items-center gap-1.5">
            <User size={13} /> Uploading for which client? <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedMatterId}
            onChange={e => setSelectedMatterId(e.target.value)}
            className="form-input text-sm"
            aria-label="Select client for upload"
          >
            <option value="">— Select a client / case —</option>
            {matters.map(m => (
              <option key={m.id} value={m.id}>
                {m.client_name || 'Unknown client'} — {m.case_number || `Matter #${m.id}`}
              </option>
            ))}
          </select>
          {matters.length === 0 && (
            <p className="text-xs text-amber-600 mt-1.5">You have no clients assigned yet.</p>
          )}
          {selectedMatter && (
            <p className="text-xs text-gray-500 mt-1.5">
              Uploaded files will be sent to <strong>{selectedMatter.client_name}</strong> and they'll be notified immediately.
            </p>
          )}
        </div>
      )}

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-disabled={isStaff && !selectedMatterId}
        aria-label={
          isStaff && !selectedMatterId
            ? 'Select a client above before uploading'
            : 'Drop zone — drag and drop files here or press Enter to browse'
        }
        onDrop={e => { if (!(isStaff && !selectedMatterId)) handleDrop(e); else e.preventDefault(); }}
        onDragOver={e => e.preventDefault()}
        onClick={() => { if (!(isStaff && !selectedMatterId)) fileRef.current?.click(); }}
        onKeyDown={e => { if (e.key === 'Enter' && !(isStaff && !selectedMatterId)) fileRef.current?.click(); }}
        className={`drop-zone mb-5 ${isStaff && !selectedMatterId ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <Upload size={24} className="mx-auto text-gray-400 mb-2" aria-hidden="true" />
        <div className="text-sm font-medium text-gray-600">
          {isStaff && !selectedMatterId
            ? 'Select a client above to enable upload'
            : 'Drag & drop files here or click to browse'}
        </div>
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
                          {doc.status === 'rejected' && doc.review_note && (
                            <div className="text-xs text-red-600 mt-0.5 max-w-[240px]" title={doc.review_note}>
                              Rejected: {doc.review_note}
                            </div>
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
                        {isStaff && doc.status === 'pending' && (
                          <>
                            <button
                              onClick={() => approveDoc(doc)}
                              disabled={reviewing[doc.id]}
                              aria-label={`Approve ${doc.name}`}
                              title="Approve document"
                              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {reviewing[doc.id] ? <Spinner size={3} color="text-white" /> : <CheckCircle size={12} />}
                              Approve
                            </button>
                            <button
                              onClick={() => { setRejectDoc(doc); setRejectNote(''); }}
                              disabled={reviewing[doc.id]}
                              aria-label={`Reject ${doc.name}`}
                              title="Reject document"
                              className="flex items-center gap-1 px-2 py-1 mr-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <XCircle size={12} />
                              Reject
                            </button>
                          </>
                        )}
                        {!isStaff && doc.status === 'rejected' && doc.user_id === user?.id && (
                          <button
                            onClick={() => startReupload(doc)}
                            disabled={reuploading[doc.id]}
                            aria-label={`Re-upload ${doc.name}`}
                            title="Upload a corrected file — it goes back to your attorney for review"
                            className="flex items-center gap-1 px-2 py-1 mr-1 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {reuploading[doc.id] ? <Spinner size={3} color="text-white" /> : <RotateCcw size={12} />}
                            Re-upload
                          </button>
                        )}
                        {doc.status === 'uploaded' && doc.user_id === user?.id && (
                          <button
                            onClick={() => sendForReview(doc)}
                            disabled={submitting[doc.id]}
                            aria-label={`Send ${doc.name} for review`}
                            title="Send to attorney for review"
                            className="flex items-center gap-1 px-2 py-1 mr-1 text-xs font-semibold text-white bg-[#0f2057] hover:bg-[#1a3476] rounded-lg transition-colors disabled:opacity-50"
                          >
                            {submitting[doc.id] ? <Spinner size={3} color="text-white" /> : <Send size={12} />}
                            Send for Review
                          </button>
                        )}
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

      {/* Reject modal — reason is required so the client knows what to fix */}
      {rejectDoc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">Reject Document</h2>
              <button
                onClick={() => { setRejectDoc(null); setRejectNote(''); }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Rejecting <span className="font-semibold text-gray-800">{rejectDoc.name}</span>.
                The client will be notified and can upload a corrected file.
              </p>
              <div>
                <label className="form-label">Reason for rejection <span className="text-red-500">*</span></label>
                <textarea
                  value={rejectNote}
                  onChange={e => setRejectNote(e.target.value)}
                  rows={3}
                  className="form-input resize-none"
                  placeholder="e.g. Document is illegible — please upload a clearer scan."
                  autoFocus
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-6">
              <button
                onClick={() => { setRejectDoc(null); setRejectNote(''); }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                disabled={rejectLoading || !rejectNote.trim()}
                className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {rejectLoading ? 'Rejecting…' : 'Reject Document'}
              </button>
            </div>
          </div>
        </div>
      )}

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