import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usersApi } from '../api';
import { Users, Search, Mail, Phone, Briefcase, ArrowRight } from 'lucide-react';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import Badge from '../components/ui/Badge';

const STAGE_VARIANT = {
  intake:       'info',
  discovery:    'info',
  hearing_prep: 'warning',
  active:       'success',
  closed:       'default',
};

const fmtType = t => t ? t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—';

export default function Clients() {
  const [clients, setClients]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [error, setError]       = useState(null);

  useEffect(() => {
    usersApi.myClients()
      .then(r => setClients(r.data))
      .catch(() => setError('Could not load clients.'))
      .finally(() => setLoading(false));
  }, []);

  // De-duplicate: one client can have multiple matters; show each row
  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    return !q
      || `${c.first_name} ${c.last_name}`.toLowerCase().includes(q)
      || (c.email || '').toLowerCase().includes(q)
      || (c.case_number || '').toLowerCase().includes(q)
      || (c.matter_type || '').toLowerCase().includes(q);
  });

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">My Clients</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Clients with matters assigned to you</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, case #…"
          className="form-input pl-9 text-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={8} /></div>
      ) : error ? (
        <div className="card p-8 text-center text-red-500 dark:text-red-400">{error}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? 'No matching clients' : 'No clients yet'}
          description={search ? 'Try a different search.' : 'Clients will appear here once matters are assigned to you.'}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table" aria-label="Clients">
              <thead className="bg-gray-50 dark:bg-gray-700/40 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  {['Client', 'Contact', 'Case #', 'Type', 'Stage', 'Status', ''].map(h => (
                    <th key={h} scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((c, idx) => (
                  <tr key={`${c.user_id}-${c.matter_id ?? idx}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#0f2057] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {c.avatar_initials || `${c.first_name?.[0] ?? ''}${c.last_name?.[0] ?? ''}`}
                        </div>
                        <div>
                          <div className="font-medium text-gray-800 dark:text-gray-100">{c.first_name} {c.last_name}</div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">{new Date(c.created_at).toLocaleDateString('en', { month: 'short', year: 'numeric' })}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {c.email && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                            <Mail size={12} className="text-gray-400 dark:text-gray-500" />{c.email}
                          </div>
                        )}
                        {c.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <Phone size={12} className="text-gray-400 dark:text-gray-500" />{c.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {c.case_number ? (
                        <span className="font-mono text-xs text-[#0f2057] dark:text-blue-400 font-semibold">{c.case_number}</span>
                      ) : <span className="text-gray-400 dark:text-gray-500">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                        <Briefcase size={12} className="text-gray-400 dark:text-gray-500" />
                        {fmtType(c.matter_type)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STAGE_VARIANT[c.stage] || 'default'}>
                        {fmtType(c.stage) || '—'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={c.status === 'on_track' ? 'success' : c.status === 'at_risk' ? 'error' : 'default'}>
                        {fmtType(c.status) || '—'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {c.matter_id && (
                        <Link
                          to={`/matters/${c.matter_id}`}
                          className="flex items-center gap-1 text-xs font-medium text-[#0f2057] dark:text-blue-400 hover:underline"
                        >
                          View Case <ArrowRight size={12} />
                        </Link>
                      )}
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