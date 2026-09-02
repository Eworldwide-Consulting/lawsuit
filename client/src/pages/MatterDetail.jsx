import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { mattersApi, formsApi, documentsApi } from '../api';
import { ArrowLeft, Calendar, FileText, MapPin, Shield, Loader2, ExternalLink } from 'lucide-react';
import Spinner from '../components/ui/Spinner';
import Badge from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const DOC_STATUS_CFG = {
  approved: { variant: 'success', label: 'Approved' },
  rejected: { variant: 'error',   label: 'Rejected' },
  pending:  { variant: 'warning', label: 'Pending Review' },
  uploaded: { variant: 'default', label: 'Uploaded' },
};

// Mirrors server/src/domain/matter.js MATTER_STAGES — kept in sync manually,
// same convention as the read-only stageLabel() formatting already in use here.
const STAGE_OPTIONS = [
  'intake', 'hearing_prep', 'initial_inventory', 'monthly_records',
  'annual_return_prep', 'court_review', 'complete',
];

// Registration never collects a free-text case description (Register.jsx only
// asks for matter type), so most matters have description=NULL by
// construction — falling back to a generic "Untitled Matter" made every one
// of those look broken. Derive a real fallback title from the matter type
// instead, which is always present.
const MATTER_TYPE_LABELS = {
  guardianship:                 'Guardianship',
  conservatorship:              'Conservatorship',
  guardianship_conservatorship: 'Guardianship & Conservatorship',
  estate_administration:        'Estate Administration',
};
function fallbackTitle(matterType) {
  return `${MATTER_TYPE_LABELS[matterType] || 'Legal'} Matter`;
}

export default function MatterDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [matter, setMatter] = useState(null);
  const [intakeForm, setIntakeForm] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [stageSaving, setStageSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    mattersApi.get(id).then(r => setMatter(r.data)).finally(() => setLoading(false));
    formsApi.getIntake(id)
      .then(r => {
        const { schema, data, status } = r.data || {};
        if (schema && status) setIntakeForm({ schema, data: data || {}, status });
        else setIntakeForm(null);
      })
      .catch(() => setIntakeForm(null));
    documentsApi.list({ matterId: id })
      .then(r => setDocuments(r.data || []))
      .catch(() => setDocuments([]))
      .finally(() => setDocsLoading(false));
  }, [id]);

  if (loading) return <div className="flex justify-center py-16"><Spinner size={8} /></div>;
  if (!matter) return <div className="p-6 text-gray-500 dark:text-gray-400">Matter not found.</div>;

  const stageLabel = s => s?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '—';
  const canEditStage = ['attorney', 'partner'].includes(user?.role);

  async function handleStageChange(newStage) {
    if (newStage === matter.stage) return;
    setStageSaving(true);
    try {
      await mattersApi.updateStage(matter.id, newStage);
      setMatter(m => ({ ...m, stage: newStage }));
      toast.success(`Stage updated to ${stageLabel(newStage)}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update the stage.');
    } finally {
      setStageSaving(false);
    }
  }

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <button onClick={() => navigate('/matters')} className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-5">
        <ArrowLeft size={16} /> Back to Matters
      </button>

      <div className="card p-6 mb-5">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <div className="font-mono text-sm text-gray-500 dark:text-gray-400">Case #{matter.case_number}</div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{matter.description || fallbackTitle(matter.matter_type)}</h1>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {canEditStage ? (
              <div className="relative">
                <select
                  value={matter.stage}
                  disabled={stageSaving}
                  onChange={e => handleStageChange(e.target.value)}
                  className="badge badge-blue appearance-none pr-6 cursor-pointer disabled:opacity-60"
                >
                  {STAGE_OPTIONS.map(s => (
                    <option key={s} value={s}>{stageLabel(s)}</option>
                  ))}
                </select>
                {stageSaving && <Loader2 size={12} className="animate-spin absolute right-1.5 top-1/2 -translate-y-1/2" />}
              </div>
            ) : (
              <span className="badge badge-blue">{stageLabel(matter.stage)}</span>
            )}
            <span className={`badge ${matter.status === 'active' ? 'badge-green' : matter.status === 'at_risk' ? 'badge-red' : 'badge-gray'}`}>
              {matter.status === 'at_risk' ? 'At Risk' : matter.status === 'active' ? 'Active' : matter.status}
            </span>
            {matter.urgent === 1 && <span className="badge badge-red">Urgent</span>}
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          {[
            { label: 'Matter Type', value: matter.matter_type?.replace(/_/g,' ') || '—' },
            { label: 'Client', value: matter.client_name || '—' },
            { label: 'Attorney', value: matter.attorney_name || '—' },
            { label: 'Court', value: matter.court || '—' },
            { label: 'State', value: matter.state || '—' },
            { label: 'County', value: matter.county || '—' },
            { label: 'Important Date', value: matter.important_date ? new Date(matter.important_date).toLocaleDateString() : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col">
              <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">{label}</span>
              <span className="font-medium text-gray-800 dark:text-gray-100 mt-0.5">{value}</span>
            </div>
          ))}
        </div>

        {matter.additional_notes && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Additional Notes</div>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{matter.additional_notes}</p>
          </div>
        )}
      </div>

      {/* Documents uploaded for this matter — client uploads and attorney uploads together */}
      <div className="card p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-gray-700 dark:text-gray-200 text-sm flex items-center gap-2">
            <FileText size={14} /> Documents
          </div>
          {!docsLoading && <span className="text-xs text-gray-400 dark:text-gray-500">{documents.length} file{documents.length !== 1 ? 's' : ''}</span>}
        </div>
        {docsLoading ? (
          <div className="flex justify-center py-6"><Spinner size={5} /></div>
        ) : documents.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-3">No documents uploaded yet.</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {documents.map(doc => {
              const cfg = DOC_STATUS_CFG[doc.status] || DOC_STATUS_CFG.uploaded;
              return (
                <div key={doc.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <FileText size={14} className="text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{doc.name}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {doc.category ? `${doc.category} · ` : ''}
                        Uploaded by {doc.uploader_first ? `${doc.uploader_first} ${doc.uploader_last || ''}`.trim() : 'Unknown'}
                        {doc.created_at ? ` · ${new Date(doc.created_at).toLocaleDateString()}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={cfg.variant} size="sm">{cfg.label}</Badge>
                    <a href={documentsApi.viewUrl(doc.id)} target="_blank" rel="noreferrer"
                      className="text-gray-400 hover:text-[#0f2057] dark:hover:text-blue-400 transition-colors" aria-label={`View ${doc.name}`}>
                      <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Client-submitted intake form */}
      {intakeForm && (
        <div className="card p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-gray-700 dark:text-gray-200 text-sm flex items-center gap-2">
              <Shield size={14} /> Intake Form
            </div>
            <Badge variant={intakeForm.status === 'submitted' ? 'success' : 'warning'}>
              {intakeForm.status === 'submitted' ? 'Submitted' : 'Draft'}
            </Badge>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            {[...intakeForm.schema.petitionerFields, ...intakeForm.schema.subjectFields].map(({ key, label }) => (
              <div key={key} className="flex flex-col">
                <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">{label}</span>
                <span className="font-medium text-gray-800 dark:text-gray-100 mt-0.5 whitespace-pre-wrap">{intakeForm.data[key] || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="font-semibold text-gray-700 dark:text-gray-200 text-sm mb-2 flex items-center gap-2"><FileText size={14} /> Contact</div>
          <div className="space-y-1.5 text-sm">
            <div><span className="text-gray-400 dark:text-gray-500">Email:</span> <span className="text-gray-700 dark:text-gray-300">{matter.client_email || '—'}</span></div>
            <div><span className="text-gray-400 dark:text-gray-500">Phone:</span> <span className="text-gray-700 dark:text-gray-300">{matter.client_phone || '—'}</span></div>
          </div>
        </div>
        <div className="card p-4">
          <div className="font-semibold text-gray-700 dark:text-gray-200 text-sm mb-2 flex items-center gap-2"><MapPin size={14} /> Location</div>
          <div className="space-y-1.5 text-sm">
            <div><span className="text-gray-400 dark:text-gray-500">Court:</span> <span className="text-gray-700 dark:text-gray-300">{matter.court || '—'}</span></div>
            <div><span className="text-gray-400 dark:text-gray-500">State:</span> <span className="text-gray-700 dark:text-gray-300">{matter.state || '—'}</span></div>
            <div><span className="text-gray-400 dark:text-gray-500">County:</span> <span className="text-gray-700 dark:text-gray-300">{matter.county || '—'}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
