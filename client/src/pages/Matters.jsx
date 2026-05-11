import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mattersApi } from '../api';
import { Plus, Search, Filter } from 'lucide-react';
import Spinner from '../components/ui/Spinner';

const stageLabel = s => s?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '—';

export default function Matters() {
  const [matters, setMatters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    mattersApi.list().then(r => setMatters(r.data)).finally(() => setLoading(false));
  }, []);

  const filtered = matters.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || (m.description || '').toLowerCase().includes(q) || (m.client_name || '').toLowerCase().includes(q) || (m.case_number || '').includes(q);
    const matchFilter = filter === 'all' || m.status === filter || m.matter_type === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Matters</h1>
          <p className="text-gray-500 text-sm">{matters.length} total matters</p>
        </div>
        <button onClick={() => navigate('/intake')} className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          <Plus size={16} /> New Matter
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by client, case number, description..."
            className="form-input pl-9 text-sm" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="form-input w-auto text-sm">
          <option value="all">All Types</option>
          <option value="active">Active</option>
          <option value="at_risk">At Risk</option>
          <option value="complete">Complete</option>
          <option value="guardianship">Guardianship</option>
          <option value="conservatorship">Conservatorship</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={8} /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">📁</div>
          <div className="text-gray-600 font-medium">No matters found</div>
          <div className="text-gray-400 text-sm mt-1">Try adjusting your search or filters</div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Case #', 'Description', 'Client', 'Attorney', 'Type', 'Stage', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => navigate(`/matters/${m.id}`)}>
                    <td className="px-4 py-3 font-mono font-medium text-navy-900 text-xs">{m.case_number}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800 truncate max-w-[200px]">{m.description || '—'}</div>
                      <div className="text-xs text-gray-400">{m.court || ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-navy-900 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
                          {m.client_initials || m.client_name?.[0] || '?'}
                        </div>
                        <span className="text-gray-700 truncate max-w-[100px]">{m.client_name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{m.attorney_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="badge badge-blue capitalize">{m.matter_type?.replace(/_/g,' ') || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge badge-gray">{stageLabel(m.stage)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${m.status === 'active' ? 'badge-green' : m.status === 'at_risk' ? 'badge-red' : m.status === 'complete' ? 'badge-gray' : 'badge-yellow'}`}>
                        {m.status === 'at_risk' ? 'At Risk' : m.status === 'active' ? 'On Track' : m.status === 'complete' ? 'Complete' : m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-xs text-green-600 hover:text-green-700 font-medium whitespace-nowrap">View →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
