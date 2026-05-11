import { useState, useEffect } from 'react';
import { tasksApi } from '../api';
import { CheckSquare, Clock, AlertTriangle, Check } from 'lucide-react';
import Spinner from '../components/ui/Spinner';

export default function CareTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = () => tasksApi.list().then(r => setTasks(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  async function complete(id) {
    await tasksApi.update(id, { status: 'completed' });
    setTasks(t => t.map(x => x.id === id ? { ...x, status: 'completed' } : x));
  }

  const filtered = tasks.filter(t => filter === 'all' || t.status === filter);

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

  const counts = { all: tasks.length, pending: tasks.filter(t => t.status === 'pending').length, overdue: tasks.filter(t => t.status === 'overdue').length, completed: tasks.filter(t => t.status === 'completed').length };

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Care Tasks</h1>
        <p className="text-gray-500 text-sm">Track and complete your required actions</p>
      </div>

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
              <div key={task.id} className={`card p-4 flex items-start gap-4 ${done ? 'opacity-60' : ''}`}>
                <button onClick={() => !done && complete(task.id)}
                  className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center mt-0.5 transition-colors ${done ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-500'}`}>
                  {done && <Check size={12} className="text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`font-medium text-sm ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.title}</div>
                  {task.description && <div className="text-xs text-gray-500 mt-0.5">{task.description}</div>}
                  <div className={`text-xs font-medium mt-1 ${color}`}>{text}</div>
                </div>
                {!done && task.action_label && (
                  <button className="flex items-center gap-1.5 text-xs bg-navy-900 text-white px-3 py-1.5 rounded-lg hover:bg-navy-800 flex-shrink-0">
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
