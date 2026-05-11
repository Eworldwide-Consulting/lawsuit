import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { mattersApi } from '../api';
import { ArrowLeft, Calendar, FileText, MapPin } from 'lucide-react';
import Spinner from '../components/ui/Spinner';

export default function MatterDetail() {
  const { id } = useParams();
  const [matter, setMatter] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    mattersApi.get(id).then(r => setMatter(r.data)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex justify-center py-16"><Spinner size={8} /></div>;
  if (!matter) return <div className="p-6 text-gray-500">Matter not found.</div>;

  const stageLabel = s => s?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '—';

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <button onClick={() => navigate('/matters')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
        <ArrowLeft size={16} /> Back to Matters
      </button>

      <div className="card p-6 mb-5">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <div className="font-mono text-sm text-gray-500">Case #{matter.case_number}</div>
            <h1 className="text-xl font-bold text-gray-900 mt-0.5">{matter.description || 'Untitled Matter'}</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="badge badge-blue">{stageLabel(matter.stage)}</span>
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
            { label: 'County', value: matter.county || '—' },
            { label: 'Important Date', value: matter.important_date ? new Date(matter.important_date).toLocaleDateString() : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col">
              <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
              <span className="font-medium text-gray-800 mt-0.5">{value}</span>
            </div>
          ))}
        </div>

        {matter.additional_notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Additional Notes</div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{matter.additional_notes}</p>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="font-semibold text-gray-700 text-sm mb-2 flex items-center gap-2"><FileText size={14} /> Contact</div>
          <div className="space-y-1.5 text-sm">
            <div><span className="text-gray-400">Email:</span> <span className="text-gray-700">{matter.client_email || '—'}</span></div>
            <div><span className="text-gray-400">Phone:</span> <span className="text-gray-700">{matter.client_phone || '—'}</span></div>
          </div>
        </div>
        <div className="card p-4">
          <div className="font-semibold text-gray-700 text-sm mb-2 flex items-center gap-2"><MapPin size={14} /> Location</div>
          <div className="space-y-1.5 text-sm">
            <div><span className="text-gray-400">Court:</span> <span className="text-gray-700">{matter.court || '—'}</span></div>
            <div><span className="text-gray-400">County:</span> <span className="text-gray-700">{matter.county || '—'}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
