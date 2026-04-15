import { useState } from 'react';
import api from '../api/axios';

const STATUS_STYLES = {
  pending:  'bg-yellow-500/20 text-yellow-300',
  running:  'bg-blue-500/20 text-blue-300',
  success:  'bg-green-500/20 text-green-300',
  failed:   'bg-red-500/20 text-red-300',
};

export default function TaskCard({ task, onUpdate, onDelete }) {
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleRun = async () => {
    setRunning(true);
    try {
      const { data } = await api.post(`/tasks/${task._id}/run`);
      onUpdate(data.task);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to run task');
    } finally {
      setRunning(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this task?')) return;
    await api.delete(`/tasks/${task._id}`);
    onDelete(task._id);
  };

  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-gray-700 transition">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold truncate">{task.title}</h3>
          <p className="text-gray-400 text-sm mt-0.5">
            <span className="capitalize">{task.operation}</span>
            {' · '}
            <span className="text-gray-500">{new Date(task.createdAt).toLocaleString()}</span>
          </p>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLES[task.status]}`}>
          {task.status}
        </span>
      </div>

      {task.result && (
        <div className="mt-3 bg-gray-800 rounded-lg px-3 py-2 text-sm text-green-300 font-mono break-all">
          {task.result}
        </div>
      )}

      {task.logs?.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-gray-500 hover:text-gray-300 transition"
          >
            {expanded ? 'Hide logs' : `Show logs (${task.logs.length})`}
          </button>
          {expanded && (
            <div className="mt-2 bg-gray-950 rounded-lg p-3 text-xs text-gray-400 font-mono space-y-1 max-h-40 overflow-y-auto">
              {task.logs.map((l, i) => (
                <div key={i}>
                  <span className="text-gray-600">{new Date(l.timestamp).toLocaleTimeString()} </span>
                  {l.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={handleRun}
          disabled={running || task.status === 'running'}
          className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg transition"
        >
          {running ? 'Queuing...' : 'Run Task'}
        </button>
        <button
          onClick={handleDelete}
          className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 transition"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
