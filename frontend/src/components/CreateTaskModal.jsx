import { useState } from 'react';
import api from '../api/axios';

const OPERATIONS = ['uppercase', 'lowercase', 'reverse', 'wordcount'];

export default function CreateTaskModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', inputText: '', operation: 'uppercase' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/tasks', form);
      onCreated(data.task);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-4">New Task</h2>
        {error && <p className="mb-3 text-sm text-red-400 bg-red-900/30 rounded p-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Task title"
            required
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <textarea
            placeholder="Input text"
            required
            rows={4}
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            value={form.inputText}
            onChange={(e) => setForm({ ...form, inputText: e.target.value })}
          />
          <select
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
            value={form.operation}
            onChange={(e) => setForm({ ...form, operation: e.target.value })}
          >
            {OPERATIONS.map((op) => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-gray-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg transition"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
