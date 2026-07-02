import { useState, useEffect } from 'react';
import {
  FileText, Send, Search, Filter, ChevronDown,
  CheckCircle, Clock, X, Users, AlertCircle,
  Download, Eye, Trash2, Plus, RefreshCw,
} from 'lucide-react';
import http       from '../api/http';
import formsApi   from '../api/forms.api';

const CATEGORIES = ['All', 'Intake', 'Compliance', 'Agreement', 'Authorization', 'Disclosure', 'Court'];

const CATEGORY_COLORS = {
  Intake:        { bg: 'bg-blue-50   dark:bg-blue-900/20',   text: 'text-blue-700   dark:text-blue-400',   dot: 'bg-blue-500'   },
  Compliance:    { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-400', dot: 'bg-yellow-500' },
  Agreement:     { bg: 'bg-green-50  dark:bg-green-900/20',  text: 'text-green-700  dark:text-green-400',  dot: 'bg-green-500'  },
  Authorization: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-400', dot: 'bg-purple-500' },
  Disclosure:    { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
  Court:         { bg: 'bg-red-50    dark:bg-red-900/20',    text: 'text-red-700    dark:text-red-400',    dot: 'bg-red-500'    },
};

function CategoryBadge({ category }) {
  const c = CATEGORY_COLORS[category] || { bg: 'bg-gray-50 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {category}
    </span>
  );
}

export default function LegalForms() {
  const [templates, setTemplates] = useState([]);
  const [sentForms, setSentForms] = useState([]);
  const [clients, setClients]     = useState([]);
  const [view, setView]           = useState('templates'); // 'templates' | 'sent'
  const [search, setSearch]       = useState('');
  const [category, setCategory]   = useState('All');
  const [loading, setLoading]     = useState(true);
  const [sendModal, setSendModal] = useState(null); // template object
  const [toast, setToast]         = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [tmpl, sent] = await Promise.all([
        formsApi.templates(),
        formsApi.sent(),
      ]);
      setTemplates(tmpl.data.templates || []);
      setSentForms(sent.data.forms || []);

      const cr = await http.get('/dashboard/attorney/clients');
      setClients(cr.data.clients || []);
    } catch (e) {
      showToast('error', e.response?.data?.error || 'Failed to load forms');
    } finally {
      setLoading(false);
    }
  }

  function showToast(type, message) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleRevoke(id) {
    if (!confirm('Remove this sent form record?')) return;
    try {
      await formsApi.revoke(id);
      setSentForms(prev => prev.filter(f => f.id !== id));
      showToast('success', 'Removed');
    } catch {
      showToast('error', 'Failed to remove');
    }
  }

  const filtered = templates.filter(t => {
    const matchesSearch   = search === '' || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'All' || t.category === category;
    return matchesSearch && matchesCategory;
  });

  const sentCountByTemplate = sentForms.reduce((acc, f) => {
    acc[f.template_id] = (acc[f.template_id] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-slideInRight ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Legal Forms</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Standard legal form templates — send directly to clients</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView(v => v === 'templates' ? 'sent' : 'templates')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              view === 'sent'
                ? 'bg-navy-900 text-white border-navy-900 dark:bg-navy-600'
                : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {view === 'templates' ? (
              <><Clock size={15} /> Sent Forms ({sentForms.length})</>
            ) : (
              <><FileText size={15} /> Templates</>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={32} className="animate-spin text-green-500" />
        </div>
      ) : view === 'templates' ? (
        <TemplatesView
          templates={filtered}
          categories={CATEGORIES}
          category={category}
          onCategory={setCategory}
          search={search}
          onSearch={setSearch}
          onSend={setSendModal}
          sentCounts={sentCountByTemplate}
        />
      ) : (
        <SentFormsView sentForms={sentForms} onRevoke={handleRevoke} />
      )}

      {sendModal && (
        <SendFormModal
          template={sendModal}
          clients={clients}
          onClose={() => setSendModal(null)}
          onSent={async (data) => {
            try {
              await formsApi.send(data);
              setSendModal(null);
              showToast('success', `"${sendModal.name}" sent successfully`);
              const sr = await formsApi.sent();
              setSentForms(sr.data.forms || []);
            } catch (e) {
              showToast('error', e.response?.data?.error || 'Failed to send form');
            }
          }}
        />
      )}
    </div>
  );
}

function TemplatesView({ templates, categories, category, onCategory, search, onSearch, onSend, sentCounts }) {
  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search forms…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => onCategory(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                category === c
                  ? 'bg-navy-900 text-white dark:bg-navy-700'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {templates.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <FileText size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No forms match your search</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              sentCount={sentCounts[t.id] || 0}
              onSend={() => onSend(t)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({ template: t, sentCount, onSend }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-700 transition-colors flex flex-col">
      <div className="p-5 flex-1">
        <div className="flex items-start justify-between gap-2 mb-3">
          <CategoryBadge category={t.category} />
          {sentCount > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
              <Send size={11} /> {sentCount}×
            </span>
          )}
        </div>
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug mb-1.5">{t.name}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{t.description}</p>

        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 mt-3 hover:underline"
        >
          <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
          {t.fields.length} fields
        </button>

        {expanded && (
          <ul className="mt-2 space-y-1">
            {t.fields.map(f => (
              <li key={f} className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-gray-400 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="px-5 pb-4 flex items-center justify-between">
        <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
          <Clock size={11} /> ~{t.estimatedMinutes} min
        </span>
        <button
          onClick={onSend}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <Send size={13} /> Send to Client
        </button>
      </div>
    </div>
  );
}

function SentFormsView({ sentForms, onRevoke }) {
  if (sentForms.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400 dark:text-gray-500">
        <Send size={48} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm">No forms sent yet</p>
        <p className="text-xs mt-1">Forms sent to clients will appear here</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-750">
          <tr>
            <th className="text-left px-5 py-3 font-medium text-gray-500 dark:text-gray-400">Form</th>
            <th className="text-left px-5 py-3 font-medium text-gray-500 dark:text-gray-400">Client</th>
            <th className="text-left px-5 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
            <th className="text-left px-5 py-3 font-medium text-gray-500 dark:text-gray-400">Sent</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {sentForms.map(f => (
            <tr key={f.id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
              <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{f.template_id?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</td>
              <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{f.first_name} {f.last_name}</td>
              <td className="px-5 py-3">
                <span className={`badge ${f.status === 'completed' ? 'badge-green' : f.status === 'sent' ? 'badge-blue' : 'badge-gray'}`}>
                  {f.status}
                </span>
              </td>
              <td className="px-5 py-3 text-xs text-gray-400 dark:text-gray-500">
                {f.sent_at ? new Date(f.sent_at).toLocaleDateString() : '—'}
              </td>
              <td className="px-5 py-3 text-right">
                <button onClick={() => onRevoke(f.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SendFormModal({ template, clients, onClose, onSent }) {
  const [clientId, setClientId] = useState('');
  const [note, setNote]         = useState('');
  const [sending, setSending]   = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!clientId) return;
    setSending(true);
    try {
      await onSent({ templateId: template.id, clientId: parseInt(clientId), note });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-slideUp">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Send Form</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{template.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1">
            <X size={20} />
          </button>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-4">
          <CategoryBadge category={template.category} />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{template.description}</p>
          <div className="flex items-center gap-3 mt-3 text-xs text-gray-400 dark:text-gray-500">
            <span className="flex items-center gap-1"><FileText size={11} /> {template.fields.length} fields</span>
            <span className="flex items-center gap-1"><Clock size={11} /> ~{template.estimatedMinutes} min</span>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="form-label dark:text-gray-300">Select Client <span className="text-red-500">*</span></label>
            <select
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              required
              className="form-input dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">— Choose a client —</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.email})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label dark:text-gray-300">Note to Client <span className="text-xs font-normal text-gray-400">(optional)</span></label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="Any instructions or context for the client…"
              className="form-input resize-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={!clientId || sending}
              className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2">
              {sending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
              {sending ? 'Sending…' : 'Send Form'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
