import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tasksApi, mattersApi, checklistApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { CheckSquare, AlertTriangle, Check, Upload, ClipboardList } from 'lucide-react';
import Spinner from '../components/ui/Spinner';

export default function CareTasks() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const [tasks, setTasks]           = useState([]);
  const [checklistTasks, setChecklistTasks] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState('all');
  const [matters, setMatters]       = useState([]);
  const [creating, setCreating]     = useState(false);
  const [title, setTitle]           = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate]       = useState('');
  const [priority, setPriority]     = useState('normal');
  const [matterId, setMatterId]     = useState('');

  const load        = () => tasksApi.list().then(r => setTasks(r.data)).finally(() => setLoading(false));
  const loadMatters = () => mattersApi.list().then(r => {
    const list = r.data?.matters || r.data || [];
    setMatters(list);
    if (user?.role === 'client' && list.length > 0) {
      checklistApi.getByMatter(list[0].id).then(cr => {
        const items = cr.data?.sections?.flatMap(s => s.items) || [];
        const pending = items.filter(i =>
          i.default_status === 'needed_now' &&
          !['submitted', 'accepted', 'not_applicable'].includes(i.status)
        );
        setChecklistTasks(pending.map(i => ({
          id:            `cl-${i.id}`,
          title:         i.label,
          description:   `Section: ${i.section}`,
          status:        i.status === 'needs_correction' ? 'overdue' : 'pending',
          due_date:      null,
          action_label:  i.status === 'needs_correction' ? 'Fix & Re-upload' : 'Upload',
          _isChecklist:  true,
          priority:      i.status === 'needs_correction' ? 'high' : 'normal',
        })));
      }).catch(() => {});
    }
  }).catch(() => setMatters([]));

  useEffect(() => { load(); loadMatters(); }, []);

  async function complete(id) {
    await tasksApi.update(id, { status: 'completed' });
    setTasks(t => t.map(x => x.id === id ? { ...x, status: 'completed' } : x));
  }

  const allTasks = [...checklistTasks, ...tasks];
  const filtered = allTasks.filter(t => filter === 'all' || t.status === filter);

  const daysLeft = d => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null;
  const dueLabel = task => {
    if (task.status === 'completed') return { text: 'Completed', color: 'text-green-600' };
    if (task.status === 'overdue') return { text: 'Overdue', color: 'text-red-600' };
    const d = daysLeft(task.due_date);
    if (d === null) return { text: 'No due date', color: 'text-gray-400' };
    if (d < 0) return { text: 'Overdue', color: 'text-red-600' };
    if (d === 0) return { text: 'Due today', color: 'text-red-500' };
    return { text: `Due in ${d} day${d !== 1 ? 's' : ''}`, color: d <= 3 ? 'text-amber-600' : 'text-gray-500' };
  };

  const normalizeTitle = title => title === 'Review doctor appointment notes'
    ? 'Review attorney appointment notes'
    : title;

  const counts = {
    all:       allTasks.length,
    pending:   allTasks.filter(t => t.status === 'pending').length,
    overdue:   allTasks.filter(t => t.status === 'overdue').length,
    completed: allTasks.filter(t => t.status === 'completed').length,
  };

  const selectedMatter = matters.find(m => String(m.id) === String(matterId));
  const assignedTo = user?.role === 'attorney' ? selectedMatter?.client_id : user?.id;

  const createTask = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const created = await tasksApi.create({
        matterId: matterId || null,
        assignedTo: assignedTo || undefined,
        title: title.trim(),
        description: description.trim() || null,
        dueDate: dueDate || null,
        priority,
        actionLabel: 'Review',
      });
      setTasks(prev => [created.data, ...prev]);
      setTitle('');
      setDescription('');
      setDueDate('');
      setPriority('normal');
      setMatterId('');
      setCreating(false);
    } catch (err) {
      setCreating(false);
      console.error(err);
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Open Tasks</h1>
          <p className="text-gray-500 text-sm">Track and complete your required actions</p>
        </div>
        <button onClick={() => setCreating(prev => !prev)}
          className="inline-flex items-center justify-center rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800">
          Create Task
        </button>
      </div>
      {creating && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 text-sm font-semibold text-gray-800">Add a new task</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-gray-700">
              Title
              <input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border-gray-300 bg-gray-50 px-3 py-2 text-sm" placeholder="Task title" />
            </label>
            <label className="block text-sm text-gray-700">
              Due date
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="mt-1 w-full rounded-lg border-gray-300 bg-gray-50 px-3 py-2 text-sm" />
            </label>
            <label className="block text-sm text-gray-700 sm:col-span-2">
              Description
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border-gray-300 bg-gray-50 px-3 py-2 text-sm" placeholder="Task details" />
            </label>
            <label className="block text-sm text-gray-700">
              Priority
              <select value={priority} onChange={e => setPriority(e.target.value)} className="mt-1 w-full rounded-lg border-gray-300 bg-gray-50 px-3 py-2 text-sm">
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            {matters.length > 0 && (
              <label className="block text-sm text-gray-700 sm:col-span-2">
                Matter
                <select value={matterId} onChange={e => setMatterId(e.target.value)} className="mt-1 w-full rounded-lg border-gray-300 bg-gray-50 px-3 py-2 text-sm">
                  <option value="">Select matter (optional)</option>
                  {matters.map(m => (
                    <option key={m.id} value={m.id}>{m.case_number || `Matter #${m.id}`} - {m.client_name || m.attorney_name || m.matter_type}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button onClick={createTask} disabled={!title.trim() || creating}
              className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50">
              {creating ? 'Saving...' : 'Save Task'}
            </button>
            <button onClick={() => setCreating(false)} className="text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          </div>
          {user?.role === 'attorney' && selectedMatter && (
            <div className="mt-3 text-xs text-gray-500">This task will be assigned to the client for the selected matter.</div>
          )}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {[
          { id: 'all', label: 'All', count: counts.all },
          { id: 'pending', label: 'Pending', count: counts.pending },
          { id: 'overdue', label: 'Overdue', count: counts.overdue },
          { id: 'completed', label: 'Completed', count: counts.completed },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f.id ? 'bg-navy-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {f.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${filter === f.id ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>{f.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={8} /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckSquare size={40} className="mx-auto text-gray-300 mb-3" />
          <div className="text-gray-600 font-medium">{filter === 'completed' ? 'No completed tasks yet' : 'No tasks found'}</div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => {
            const { text, color } = dueLabel(task);
            const done = task.status === 'completed';
            return (
              <div key={task.id} className={`card p-4 flex items-start gap-4 ${done ? 'opacity-60' : ''} ${task._isChecklist ? 'border-l-4 border-blue-300' : ''}`}>
                {task._isChecklist ? (
                  <div className="w-6 h-6 rounded-full bg-blue-100 border-2 border-blue-300 flex-shrink-0 flex items-center justify-center mt-0.5">
                    <ClipboardList size={11} className="text-blue-600" />
                  </div>
                ) : (
                  <button onClick={() => !done && complete(task.id)}
                    className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center mt-0.5 transition-colors ${done ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-500'}`}>
                    {done && <Check size={12} className="text-white" />}
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className={`font-medium text-sm ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{normalizeTitle(task.title)}</div>
                    {task._isChecklist && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Checklist</span>}
                  </div>
                  {task.description && <div className="text-xs text-gray-500 mt-0.5">{task.description}</div>}
                  <div className={`text-xs font-medium mt-1 ${color}`}>{text}</div>
                </div>
                {!done && task.action_label && (
                  <button
                    onClick={() => task._isChecklist ? navigate('/checklist') : undefined}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg flex-shrink-0 text-white transition-colors ${
                      task._isChecklist ? 'bg-blue-600 hover:bg-blue-700' : 'bg-navy-900 hover:bg-navy-800'
                    }`}
                  >
                    {task._isChecklist && <Upload size={12} />}
                    {task.action_label}
                  </button>
                )}
                {task.status === 'overdue' && !done && (
                  <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
