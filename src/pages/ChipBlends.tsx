import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import {
  getAllChipBlends,
  addChipBlend,
  updateChipBlend,
  deleteChipBlend,
  getAllSystems,
  ChipBlend,
} from '../lib/db';
import { ChipSystem } from '../types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export default function ChipBlends() {
  const [blends, setBlends] = useState<ChipBlend[]>([]);
  const [systems, setSystems] = useState<ChipSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    systemIds: [] as string[],
  });

  useEffect(() => {
    loadData();
  }, []);

  // Auto-refresh when sync completes
  useEffect(() => {
    const handleSyncComplete = () => {
      console.log('Sync completed, refreshing chip blends...');
      loadData();
    };

    window.addEventListener('syncComplete', handleSyncComplete);

    return () => {
      window.removeEventListener('syncComplete', handleSyncComplete);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [blendsData, systemsData] = await Promise.all([
        getAllChipBlends(),
        getAllSystems(),
      ]);
      setBlends(blendsData);
      setSystems(systemsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartAdd = () => {
    setFormData({ name: '', systemIds: [] });
    setIsAdding(true);
    setEditingId(null);
  };

  const handleStartEdit = (blend: ChipBlend) => {
    setFormData({
      name: blend.name,
      systemIds: blend.systemIds || [],
    });
    setEditingId(blend.id);
    setIsAdding(false);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ name: '', systemIds: [] });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a blend name');
      return;
    }

    try {
      const timestamp = new Date().toISOString();

      if (isAdding) {
        const newBlend: ChipBlend = {
          id: generateId(),
          name: formData.name.trim(),
          systemIds: formData.systemIds,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        await addChipBlend(newBlend);
      } else if (editingId) {
        const existingBlend = blends.find((b) => b.id === editingId);
        if (existingBlend) {
          const updatedBlend: ChipBlend = {
            ...existingBlend,
            name: formData.name.trim(),
            systemIds: formData.systemIds,
            updatedAt: timestamp,
          };
          await updateChipBlend(updatedBlend);
        }
      }

      await loadData();
      handleCancel();
    } catch (error) {
      console.error('Error saving blend:', error);
      alert('Error saving blend. Please try again.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this chip blend?')) {
      return;
    }

    try {
      await deleteChipBlend(id);
      await loadData();
    } catch (error) {
      console.error('Error deleting blend:', error);
      alert('Error deleting blend. Please try again.');
    }
  };

  const handleSystemToggle = (systemId: string) => {
    setFormData((prev) => {
      const systemIds = prev.systemIds.includes(systemId)
        ? prev.systemIds.filter((id) => id !== systemId)
        : [...prev.systemIds, systemId];
      return { ...prev, systemIds };
    });
  };

  const getSystemNames = (systemIds?: string[]) => {
    if (!systemIds || systemIds.length === 0) {
      return 'No systems';
    }
    return systemIds
      .map((id) => systems.find((s) => s.id === id)?.name || 'Unknown')
      .join(', ');
  };

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Chip Blends</h1>
          <p className="text-slate-600 mt-1">Manage your chip blend master list</p>
        </div>
        <button
          onClick={handleStartAdd}
          disabled={isAdding || editingId !== null}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
        >
          <Plus size={20} />
          <span>Add Blend</span>
        </button>
      </div>

      {/* Add/Edit Form */}
      {(isAdding || editingId !== null) && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6 mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            {isAdding ? 'Add New Blend' : 'Edit Blend'}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Blend Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Mocha Java"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Available Systems
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Select which chip systems this blend is compatible with. Leave unchecked if not system-specific.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {systems.map((system) => (
                  <label
                    key={system.id}
                    className="flex items-center gap-2 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={formData.systemIds.includes(system.id)}
                      onChange={() => handleSystemToggle(system.id)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">{system.name}</span>
                  </label>
                ))}
              </div>
              {systems.length === 0 && (
                <p className="text-sm text-slate-500 italic">
                  No chip systems available. Add systems first.
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                <Save size={18} />
                <span>Save</span>
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-6 py-2.5 bg-slate-200 text-slate-900 rounded-lg font-semibold hover:bg-slate-300 transition-colors"
              >
                <X size={18} />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Blends List */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {blends.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p>No chip blends yet.</p>
            <p className="text-sm mt-1">Click "Add Blend" to create your first one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold text-slate-900">
                    Blend Name
                  </th>
                  <th className="text-left px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold text-slate-900">
                    Available Systems
                  </th>
                  <th className="text-right px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold text-slate-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {blends.map((blend) => (
                  <tr
                    key={blend.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 sm:px-6 py-4">
                      <span className="text-sm sm:text-base font-medium text-slate-900">
                        {blend.name}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <span className="text-xs sm:text-sm text-slate-600">
                        {getSystemNames(blend.systemIds)}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleStartEdit(blend)}
                          disabled={isAdding || editingId !== null}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:text-slate-400 disabled:hover:bg-transparent"
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(blend.id)}
                          disabled={isAdding || editingId !== null}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:text-slate-400 disabled:hover:bg-transparent"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {blends.length > 0 && (
        <div className="mt-4 text-sm text-slate-500">
          Total: {blends.length} blend{blends.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
