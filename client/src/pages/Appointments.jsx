import { useState, useEffect } from 'react';
import { appointmentsApi, mattersApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { Calendar, Plus, Video, Building2, Phone } from 'lucide-react';
import Spinner from '../components/ui/Spinner';

const typeIcon = type => {
  if (type === 'teleconference') return <Video size={14} className="text-blue-500" />;
  if (type === 'in_person') return <Building2 size={14} className="text-green-500" />;
  return <Phone size={14} className="text-gray-500" />;
};

export default function Appointments() {
  const { user } = useAuth();
  const [appts, setAppts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'teleconference', startTime: '', location: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [matters, setMatters] = useState([]);
  const [matterId, setMatterId] = useState(null);
  const [reschedulingId, setReschedulingId] = useState(null);
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  const load = () => appointmentsApi.list().then(r => setAppts(r.data)).finally(() => setLoading(false));
  useEffect(() => {
    load();
    if (user?.role === 'client') {
      mattersApi.list().then(r => {
        const list = r.data?.matters || r.data || [];
        setMatters(list);
        if (list.length > 0) setMatterId(list[0].id);
      }).catch(() => {});
    }
  }, [user?.role]);

  async function save() {
    if (!form.title || !form.startTime) return;
    setSaving(true);
    try {
      await appointmentsApi.create({ ...form, startTime: form.startTime, matterId });
      setShowForm(false);
      setForm({ title: '', type: 'teleconference', startTime: '', location: '', notes: '' });
      load();
    } finally { setSaving(false); }
  }

  const upcoming = appts.filter(a => new Date(a.start_time) >= new Date());
  const past = appts.filter(a => new Date(a.start_time) < new Date());

  async function markNoShow(id) {
    await appointmentsApi.markNoShow(id);
    load();
  }

  function startReschedule(appt) {
    setReschedulingId(appt.id);
    setRescheduleTime('');
  }

  async function confirmReschedule() {
    if (!rescheduleTime) return;
    setRescheduling(true);
    try {
      await appointmentsApi.reschedule(reschedulingId, { startTime: rescheduleTime });
      setReschedulingId(null);
      setRescheduleTime('');
      load();
    } finally {
      setRescheduling(false);
    }
  }

  const AppointmentCard = ({ appt }) => {
    const isPast = new Date(appt.start_time) < new Date();
    const isRescheduling = reschedulingId === appt.id;
    return (
      <div className="card p-4">
        <div className="flex items-start gap-4">
          <div className="bg-navy-50 border border-navy-100 rounded-xl px-3 py-2 text-center flex-shrink-0 min-w-[60px]">
            <div className="text-xs font-semibold text-navy-600">{new Date(appt.start_time).toLocaleDateString('en', { month: 'short' }).toUpperCase()}</div>
            <div className="text-2xl font-bold text-navy-900">{new Date(appt.start_time).getDate()}</div>
            <div className="text-xs text-gray-500">{new Date(appt.start_time).toLocaleDateString('en', { weekday: 'short' })}</div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {typeIcon(appt.type)}
              <h3 className="font-semibold text-gray-800">{appt.title}</h3>
              {appt.status === 'no_show' && <span className="badge badge-red text-[10px]">No Show</span>}
              {appt.status === 'rescheduled' && <span className="badge badge-gray text-[10px]">Rescheduled</span>}
            </div>
            <div className="text-sm text-gray-500">{new Date(appt.start_time).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}{appt.end_time && ` – ${new Date(appt.end_time).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}`}</div>
            {appt.location && <div className="text-sm text-gray-500">{appt.location}</div>}
            {appt.notes && <div className="text-xs text-gray-400 mt-1">{appt.notes}</div>}
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            {isPast && appt.status === 'scheduled' && (
              <button onClick={() => markNoShow(appt.id)} className="text-xs font-medium text-amber-600 hover:text-amber-700">Mark No Show</button>
            )}
            {appt.status === 'no_show' && (
              <button onClick={() => startReschedule(appt)} className="text-xs font-medium text-white bg-[#0f2057] hover:bg-[#1a3476] px-2.5 py-1 rounded-lg transition-colors">
                Reschedule
              </button>
            )}
            <button onClick={() => appointmentsApi.delete(appt.id).then(load)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
          </div>
        </div>

        {isRescheduling && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-end gap-3">
            <div>
              <label className="form-label">New Date & Time</label>
              <input type="datetime-local" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)} className="form-input" />
            </div>
            <button onClick={confirmReschedule} disabled={!rescheduleTime || rescheduling} className="btn-primary w-auto px-4">
              {rescheduling ? <Spinner size={4} color="text-white" /> : 'Confirm Reschedule'}
            </button>
            <button onClick={() => setReschedulingId(null)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Appointments</h1>
          <p className="text-gray-500 text-sm">{upcoming.length} upcoming</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg">
          <Plus size={16} /> Schedule
        </button>
      </div>

      {showForm && (
        <div className="card p-5 mb-5">
          <h2 className="font-semibold text-gray-800 mb-4">Schedule Appointment</h2>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="form-label">Title</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Appointment title" className="form-input" />
            </div>
            <div>
              <label className="form-label">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="form-input">
                <option value="teleconference">Teleconference</option>
                <option value="in_person">In Person</option>
                <option value="phone">Phone</option>
              </select>
            </div>
            <div>
              <label className="form-label">Date & Time</label>
              <input type="datetime-local" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className="form-input" />
            </div>
            <div>
              <label className="form-label">Location</label>
              <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Location or video link" className="form-input" />
            </div>
            {matters.length > 1 && (
              <div>
                <label className="form-label">Case</label>
                <select value={matterId || ''} onChange={e => setMatterId(Number(e.target.value))} className="form-input">
                  {matters.map(m => (
                    <option key={m.id} value={m.id}>{m.case_number} — {m.matter_type?.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="mb-4">
            <label className="form-label">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="form-input resize-none" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)} className="btn-secondary flex-shrink-0 w-auto px-5">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving ? <Spinner size={4} color="text-white" /> : <><Calendar size={14} /> Schedule</>}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={8} /></div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="mb-6">
              <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-3">Upcoming</h2>
              <div className="space-y-3">{upcoming.map(a => <AppointmentCard key={a.id} appt={a} />)}</div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="font-semibold text-gray-400 text-sm uppercase tracking-wide mb-3">Past</h2>
              <div className="space-y-3 opacity-60">{past.slice(0, 5).map(a => <AppointmentCard key={a.id} appt={a} />)}</div>
            </div>
          )}
          {appts.length === 0 && (
            <div className="card p-12 text-center">
              <Calendar size={40} className="mx-auto text-gray-300 mb-3" />
              <div className="text-gray-600 font-medium">No appointments scheduled</div>
              <div className="text-gray-400 text-sm mt-1">Click "Schedule" to add one</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
