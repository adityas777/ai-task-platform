import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import TaskCard from '../components/TaskCard';
import CreateTaskModal from '../components/CreateTaskModal';

const POLL_INTERVAL = 5000; // ms

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const intervalRef = useRef(null);

  const fetchTasks = useCallback(async () => {
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const { data } = await api.get('/tasks', { params });
      setTasks(data.tasks);
    } catch {
      // silently fail on poll
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchTasks();
    intervalRef.current = setInterval(fetchTasks, POLL_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [fetchTasks]);

  const handleCreated = (task) => setTasks((prev) => [task, ...prev]);

  const handleUpdate = (updated) =>
    setTasks((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));

  const handleDelete = (id) =>
    setTasks((prev) => prev.filter((t) => t._id !== id));

  const hasActive = tasks.some((t) => ['pending', 'running'].includes(t.status));

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navbar */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-indigo-400">AI Task Platform</span>
          {hasActive && (
            <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full animate-pulse">
              Processing...
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{user?.name}</span>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-white transition">
            Logout
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h2 className="text-xl font-semibold">Tasks</h2>
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-gray-800 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="running">Running</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
            <button
              onClick={() => setShowModal(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
            >
              + New Task
            </button>
          </div>
        </div>

        {/* Task list */}
        {loading ? (
          <p className="text-gray-500 text-center py-16">Loading tasks...</p>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg">No tasks yet.</p>
            <p className="text-sm mt-1">Create one to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <CreateTaskModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
