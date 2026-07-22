import { useState, useEffect, useRef } from 'react';
import { formsApi, mattersApi, documentsApi } from '../api';
import { useToast } from '../context/ToastContext';
import Spinner from '../components/ui/Spinner';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { Shield, User, HeartHandshake, Upload, Check, Save, FileText, Trash2 } from 'lucide-react';

const UPLOAD_CATEGORY = 'Intake Form';

function Field({ def, value, onChange, disabled }) {
  const common = {
    value: value || '',
    onChange,
    disabled,
    placeholder: def.placeholder,
    className: 'form-input disabled:bg-gray-50 disabled:text-gray-500',
  };
  return (
    <div className={def.type === 'textarea' ? 'sm:col-span-2' : ''}>
      <label className="form-label">{def.label}</label>
      {def.type === 'textarea'
        ? <textarea rows={2} {...common} className={`${common.className} resize-none`} />
        : <input type={def.type} {...common} />}
    </div>
  );
}

export default function IntakeForm() {
  const toast = useToast();
  const fileRef = useRef();

  const [matters, setMatters]     = useState([]);
  const [matterId, setMatterId]   = useState(null);
  const [schema, setSchema]       = useState(null);
  const [form, setForm]           = useState({});
  const [status, setStatus]       = useState(null);   // null | 'draft' | 'submitted'
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [legalCaseNumber, setLegalCaseNumber] = useState('');
  const [savingCaseNumber, setSavingCaseNumber] = useState(false);

  useEffect(() => {
    mattersApi.list()
      .then(r => {
        const list = r.data?.matters || r.data || [];
        setMatters(list);
        if (list.length > 0) setMatterId(list[0].id);
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const m = matters.find(m => m.id === matterId);
    setLegalCaseNumber(m?.legal_case_number || '');
  }, [matterId, matters]);

  async function saveLegalCaseNumber() {
    if (!matterId) return;
    setSavingCaseNumber(true);
    try {
      const res = await mattersApi.updateCaseInfo(matterId, { legalCaseNumber });
      setMatters(prev => prev.map(m => m.id === matterId ? { ...m, ...res.data } : m));
      toast.success('Legal Case Number saved');
    } catch {
      toast.error('Could not save. Please try again.');
    } finally {
      setSavingCaseNumber(false);
    }
  }

  useEffect(() => {
    if (!matterId) return;
    setLoading(true);
    Promise.all([
      formsApi.getIntake(matterId),
      documentsApi.list({ matterId }),
    ])
      .then(([formRes, docsRes]) => {
        const s = formRes.data?.schema || null;
        setSchema(s);
        const emptyForm = s
          ? Object.fromEntries([...s.petitionerFields, ...s.subjectFields].map(f => [f.key, '']))
          : {};
        setForm({ ...emptyForm, ...(formRes.data?.data || {}) });
        setStatus(formRes.data?.status || null);

        const docs = Array.isArray(docsRes.data) ? docsRes.data : [];
        setUploadedDocs(docs.filter(d => d.category === UPLOAD_CATEGORY));
      })
      .catch(() => toast.error('Could not load the form. Please try again.'))
      .finally(() => setLoading(false));
  }, [matterId]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function save(submit) {
    if (!matterId || !schema) return;
    const petitionerNameKey = schema.petitionerFields[0]?.key;
    const subjectNameKey    = schema.subjectFields[0]?.key;
    if (submit && (!form[petitionerNameKey]?.trim() || !form[subjectNameKey]?.trim())) {
      toast.error('Both names are required to submit.');
      return;
    }
    setSaving(true);
    try {
      const res = await formsApi.saveIntake(matterId, { submit, ...form });
      setStatus(res.data?.status || (submit ? 'submitted' : 'draft'));
      toast.success(submit
        ? 'Form submitted — your legal team has been notified'
        : 'Draft saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save the form. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(files) {
    if (!files?.length || !matterId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach(f => fd.append('files', f));
      fd.append('matterId', matterId);
      fd.append('category', UPLOAD_CATEGORY);
      const res = await documentsApi.upload(fd);
      const newDocs = Array.isArray(res.data) ? res.data : [];
      setUploadedDocs(prev => [...newDocs, ...prev]);
      toast.success(`${files.length} document${files.length !== 1 ? 's' : ''} uploaded`);
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDeleteDoc(doc) {
    if (!confirm(`Delete "${doc.name}"? This cannot be undone.`)) return;
    try {
      await documentsApi.delete(doc.id);
      setUploadedDocs(prev => prev.filter(d => d.id !== doc.id));
      toast.success('Document deleted');
    } catch {
      toast.error('Delete failed. Please try again.');
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size={8} /></div>;
  }

  if (!matters.length) {
    return (
      <div className="p-4 lg:p-6 max-w-3xl mx-auto">
        <div className="card">
          <EmptyState
            icon={Shield}
            title="No case yet"
            description="Start your case first — then fill out the intake form here."
          />
        </div>
      </div>
    );
  }

  const currentMatter = matters.find(m => m.id === matterId);
  const submitted = status === 'submitted';

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Shield size={22} className="text-[#0f2057]" aria-hidden="true" />
            Case Intake Form
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Tell us about the people involved in this case.
            Your legal team uses this to prepare the case.
          </p>
          {currentMatter?.case_number && (
            <div className="text-xs text-gray-500 mt-1.5">
              Client Number:{' '}
              <span className="font-mono font-semibold text-[#0f2057]">{currentMatter.case_number}</span>
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            <label className="text-xs text-gray-500 flex-shrink-0">Legal Case Number:</label>
            <input
              value={legalCaseNumber}
              onChange={e => setLegalCaseNumber(e.target.value)}
              placeholder="Court docket number, once assigned"
              className="form-input py-1 text-xs w-56"
            />
            <button
              onClick={saveLegalCaseNumber}
              disabled={savingCaseNumber}
              className="text-xs font-medium text-white bg-[#0f2057] hover:bg-[#1a3476] disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
            >
              {savingCaseNumber ? <Spinner size={3} color="text-white" /> : 'Save'}
            </button>
          </div>
        </div>
        {status && (
          <Badge variant={submitted ? 'success' : 'warning'}>
            {submitted ? 'Submitted' : 'Draft'}
          </Badge>
        )}
      </div>

      {matters.length > 1 && (
        <div className="mb-5">
          <label htmlFor="if-matter" className="form-label">Case</label>
          <select id="if-matter" value={matterId || ''} onChange={e => setMatterId(Number(e.target.value))}
            className="form-input w-auto text-sm">
            {matters.map(m => (
              <option key={m.id} value={m.id}>{m.case_number} — {m.matter_type?.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      )}

      {submitted && (
        <div className="mb-5 p-3.5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 flex items-center gap-2">
          <Check size={16} className="flex-shrink-0" />
          This form has been submitted. You can still update it — changes are saved for your legal team.
        </div>
      )}

      {!schema ? (
        <div className="card p-5 mb-5 text-sm text-gray-500">
          No intake form is defined for this case type yet.
        </div>
      ) : (
        <>
          {/* Petitioner section */}
          <div className="card p-5 mb-5">
            <div className="font-semibold text-gray-800 text-sm mb-4 flex items-center gap-2">
              <User size={15} className="text-[#0f2057]" /> {schema.petitionerLabel}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {schema.petitionerFields.map(def => (
                <Field key={def.key} def={def} value={form[def.key]} onChange={set(def.key)} disabled={saving} />
              ))}
            </div>
          </div>

          {/* Subject section */}
          <div className="card p-5 mb-5">
            <div className="font-semibold text-gray-800 text-sm mb-4 flex items-center gap-2">
              <HeartHandshake size={15} className="text-[#0f2057]" /> {schema.subjectLabel}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {schema.subjectFields.map(def => (
                <Field key={def.key} def={def} value={form[def.key]} onChange={set(def.key)} disabled={saving} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Supporting documents */}
      <div className="card p-5 mb-5">
        <div className="font-semibold text-gray-800 text-sm mb-1 flex items-center gap-2">
          <FileText size={15} className="text-[#0f2057]" /> Supporting Documents
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Upload documents that support this form — medical records, IDs, care agreements, court papers.
        </p>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-green-400 transition-colors disabled:opacity-50"
        >
          {uploading
            ? <Spinner size={5} />
            : <>
                <Upload size={20} className="mx-auto text-gray-400 mb-1" />
                <div className="text-sm text-gray-500">Click to upload documents</div>
                <div className="text-xs text-gray-400 mt-0.5">PDF, DOC, DOCX, JPG, PNG · Max 20 MB each</div>
              </>}
        </button>
        <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          className="sr-only" aria-label="Upload supporting documents"
          onChange={e => handleUpload(e.target.files)} />

        {uploadedDocs.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {uploadedDocs.map(d => (
              <li key={d.id} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                <FileText size={13} className="text-gray-400 flex-shrink-0" />
                <span className="truncate flex-1">{d.name}</span>
                <Badge size="sm" variant={d.status === 'approved' ? 'success' : d.status === 'rejected' ? 'error' : 'info'}>
                  {d.status}
                </Badge>
                <button
                  onClick={() => handleDeleteDoc(d)}
                  aria-label={`Delete ${d.name}`}
                  title="Delete document"
                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={() => save(false)} disabled={saving || !schema}
          className="btn-secondary w-auto px-5 flex items-center gap-2">
          {saving ? <Spinner size={4} /> : <Save size={15} />} Save Draft
        </button>
        <button onClick={() => save(true)} disabled={saving || !schema}
          className="btn-primary flex items-center gap-2">
          {saving ? <Spinner size={4} color="text-white" /> : <Check size={15} />}
          {submitted ? 'Update Submission' : 'Submit to Legal Team'}
        </button>
      </div>
    </div>
  );
}
