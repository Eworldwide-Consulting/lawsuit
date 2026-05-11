import { useState, useEffect } from 'react';
import { appointmentsApi } from '../api';
import { Calendar, Plus, Video, Building2, Phone } from 'lucide-react';
import Spinner from '../components/ui/Spinner';

const typeIcon = type => {
  if (type === 'teleconference') return <Video size={14} className="text-blue-500" />;
  if (type === 'in_person') return <Building2 size={14} className="text-green-500" />;
  return <Phone size={14} className="text-gray-500" />;
};

export default function Appointments() {
  const [appts, setAppts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'teleconference', startTime: '', location: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = () => appointmentsApi.list().then(r => setAppts(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.title || !form.startTime) return;
    setSaving(true);
    try {
      await appointmentsApi.create({ ...form, startTime: form.startTime });
      setShowForm(false);
      setForm({ title: '', type: 'teleconference', startTime: '', location: '', notes: '' });
      load();
    } finally { setSaving(false); }
  }

  const upcoming = appts.filter(a => new Date(a.start_time) >= new Date());
  const past = appts.filter(a => new Date(a.start_time) < new Date());

  const AppointmentCard = ({ appt }) => (
    <div className="card p-4 flex items-start gap-4">
      <div className="bg-navy-50 border border-navy-100 rounded-xl px-3 py-2 text-center flex-shrink-0 min-w-[60px]">
        <div className="text-xs font-semibold text-navy-600">{new Date(appt.start_time).toLocaleDateString('en', { month: 'short' }).toUpperCase()}</div>
        <div className="text-2xl font-bold text-navy-900">{new Date(appt.start_time).getDate()}</div>
        <div className="text-xs text-gray-500">{new Date(appt.start_time).toLocaleDateString('en', { weekday: 'short' })}</div>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          {typeIcon(appt.type)}
          <h3 className="font-semibold text-gray-800">{appt.title}</h3>
        </div>
        <div className="text-sm text-gray-500">{new Date(appt.start_time).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}{appt.end_time && ` – ${new Date(appt.end_time).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}`}</div>
        {appt.location && <div className="text-sm text-gray-500">{appt.location}</div>}
        {appt.notes && <div className="text-xs text-gray-400 mt-1">{appt.notes}</div>}
      </div>
      <button onClick={() => appointmentsApi.delete(appt.id).then(load)} className="text-xs text-red-400 hover:text-red-600 mt-1">Remove</button>
    </div>
  );

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
