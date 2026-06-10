import { useState, useEffect } from 'react';
import { messagesApi, usersApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { Send, Inbox, Send as SendIcon } from 'lucide-react';
import Spinner from '../components/ui/Spinner';

const isStaff = role => ['attorney', 'partner', 'itsupport'].includes(role);

export default function Messages() {
  const { user } = useAuth();
  const [inbox, setInbox] = useState([]);
  const [tab, setTab] = useState('inbox');
  const [selected, setSelected] = useState(null);
  const [compose, setCompose] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recipients, setRecipients] = useState([]);
  const [form, setForm] = useState({ toUserId: '', subject: '', body: '' });
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      // Attorneys/partners can message their clients + other staff.
      // Clients can only message attorneys.
      const recipientFetch = isStaff(user?.role)
        ? Promise.all([usersApi.attorneys(), usersApi.myClients()])
            .then(([attyRes, clientRes]) => {
              const atty    = attyRes.data || [];
              const clients = (clientRes.data || []).map(c => ({
                id:         c.user_id ?? c.id,
                first_name: c.first_name,
                last_name:  c.last_name,
                role:       'client',
              }));
              // Deduplicate by id
              const seen = new Set();
              return [...atty, ...clients].filter(u => {
                if (seen.has(u.id)) return false;
                seen.add(u.id);
                return u.id !== user?.id;
              });
            })
        : usersApi.attorneys().then(r => r.data.filter(u => u.id !== user?.id));

      const [inboxRes, recipientList] = await Promise.all([messagesApi.inbox(), recipientFetch]);
      setInbox(inboxRes.data);
      setRecipients(recipientList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  async function markRead(msg) {
    if (!msg.read_at) {
      await messagesApi.markRead(msg.id);
      setInbox(m => m.map(x => x.id === msg.id ? { ...x, read_at: new Date().toISOString() } : x));
    }
    setSelected(msg);
  }

  async function send() {
    if (!form.toUserId || !form.body) return;
    setSending(true);
    try {
      await messagesApi.send(form);
      setCompose(false);
      setForm({ toUserId: '', subject: '', body: '' });
      load();
    } finally {
      setSending(false);
    }
  }

  const unread = inbox.filter(m => !m.read_at).length;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between mb-5 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Messages</h1>
          {unread > 0 && <p className="text-sm text-green-600">{unread} unread message{unread !== 1 ? 's' : ''}</p>}
        </div>
        <button onClick={() => { setCompose(true); setSelected(null); }}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          <Send size={14} /> Compose
        </button>
      </div>

      <div className="flex gap-5 flex-1 min-h-0">
        {/* Message list */}
        <div className="w-full lg:w-80 flex-shrink-0 card overflow-hidden flex flex-col">
          <div className="flex border-b border-gray-200">
            {[{ id: 'inbox', label: 'Inbox', icon: Inbox }, { id: 'sent', label: 'Sent', icon: SendIcon }].map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${tab === id ? 'text-navy-900 border-b-2 border-navy-900' : 'text-gray-500 hover:text-gray-700'}`}>
                <Icon size={15} />{label}
                {id === 'inbox' && unread > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{unread}</span>
                )}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {loading ? (
              <div className="flex justify-center p-8"><Spinner /></div>
            ) : inbox.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No messages</div>
            ) : inbox.map(msg => (
              <button key={msg.id} onClick={() => markRead(msg)}
                className={`w-full flex items-start gap-3 p-3 text-left hover:bg-gray-50 transition-colors ${selected?.id === msg.id ? 'bg-blue-50' : ''}`}>
                <div className="w-8 h-8 rounded-full bg-navy-900 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {msg.from_initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between">
                    <span className={`text-sm ${!msg.read_at ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>{msg.from_name}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{new Date(msg.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
                  </div>
                  <div className={`text-xs truncate ${!msg.read_at ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>{msg.subject || '(no subject)'}</div>
                  <div className="text-xs text-gray-400 truncate">{msg.body}</div>
                </div>
                {!msg.read_at && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />}
              </button>
            ))}
          </div>
        </div>

        {/* Message detail / compose */}
        <div className="flex-1 card p-5 flex flex-col overflow-hidden">
          {compose ? (
            <div className="flex flex-col h-full">
              <div className="font-semibold text-gray-800 mb-4">New Message</div>
              <div className="space-y-3 flex-1">
                <div>
                  <label className="form-label">To</label>
                  <select value={form.toUserId} onChange={e => setForm(f => ({ ...f, toUserId: e.target.value }))} className="form-input">
                    <option value="">Select recipient</option>
                    {recipients.map(r => (<option key={r.id} value={r.id}>{r.first_name} {r.last_name}{r.role === 'client' ? ' (Client)' : ''}</option>))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Subject</label>
                  <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Message subject" className="form-input" />
                </div>
                <div className="flex-1">
                  <label className="form-label">Message</label>
                  <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={8} placeholder="Write your message..." className="form-input resize-none" />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setCompose(false)} className="btn-secondary flex-shrink-0 w-auto px-5 text-sm">Cancel</button>
                <button onClick={send} disabled={sending || !form.toUserId || !form.body} className="btn-primary">
                  {sending ? <Spinner size={4} color="text-white" /> : <><Send size={14} /> Send Message</>}
                </button>
              </div>
            </div>
          ) : selected ? (
            <div>
              <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-100">
                <div>
                  <h2 className="font-bold text-gray-900">{selected.subject || '(no subject)'}</h2>
                  <div className="text-sm text-gray-500 mt-1">From: <span className="font-medium text-gray-700">{selected.from_name}</span></div>
                  <div className="text-xs text-gray-400">{new Date(selected.created_at).toLocaleString()}</div>
                </div>
                <button onClick={() => { setCompose(true); setForm(f => ({ ...f, subject: `Re: ${selected.subject || ''}`, toUserId: selected.from_user_id })); }}
                  className="text-sm text-green-600 hover:text-green-700 font-medium">Reply</button>
              </div>
              <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{selected.body}</div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
              <Inbox size={48} className="mb-3 text-gray-300" />
              <div className="font-medium">Select a message to read</div>
              <div className="text-sm mt-1">Or compose a new message</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
