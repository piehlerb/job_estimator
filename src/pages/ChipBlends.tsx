import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import {
  getAllChipBlends,
  addChipBlend,
  updateChipBlend,
  deleteChipBlend,
  getAllSystems,
  getAllBaseCoatColors,
  ChipBlend,
} from '../lib/db';
import { ChipSystem, BaseCoatColor } from '../types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export default function ChipBlends() {
  const [blends, setBlends] = useState<ChipBlend[]>([]);
  const [systems, setSystems] = useState<ChipSystem[]>([]);
  const [baseCoatColors, setBaseCoatColors] = useState<BaseCoatColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    systemIds: [] as string[],
    baseCoatColorIds: [] as string[],
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleSyncComplete = () => {
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
      const [blendsData, systemsData, baseCoatColorsData] = await Promise.all([
        getAllChipBlends(),
        getAllSystems(),
        getAllBaseCoatColors(),
      ]);
      setBlends(blendsData);
      setSystems(systemsData);
      setBaseCoatColors(baseCoatColorsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setFormData({ name: '', systemIds: [], baseCoatColorIds: [] });
    setIsAdding(true);
    setEditingId(null);
  };

  const openEditModal = (blend: ChipBlend) => {
    setFormData({
      name: blend.name,
      systemIds: blend.systemIds || [],
      baseCoatColorIds: blend.baseCoatColorIds || [],
    });
    setEditingId(blend.id);
    setIsAdding(false);
  };

  const closeModal = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ name: '', systemIds: [], baseCoatColorIds: [] });
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
          baseCoatColorIds: formData.baseCoatColorIds,
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
            baseCoatColorIds: formData.baseCoatColorIds,
            updatedAt: timestamp,
          };
          await updateChipBlend(updatedBlend);
        }
      }

      await loadData();
      closeModal();
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

  const handleBaseCoatColorToggle = (baseCoatColorId: string) => {
    setFormData((prev) => {
      const baseCoatColorIds = prev.baseCoatColorIds.includes(baseCoatColorId)
        ? prev.baseCoatColorIds.filter((id) => id !== baseCoatColorId)
        : [...prev.baseCoatColorIds, baseCoatColorId];
      return { ...prev, baseCoatColorIds };
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

  const getBaseCoatColorNames = (baseCoatColorIds?: string[]) => {
    if (!baseCoatColorIds || baseCoatColorIds.length === 0) {
      return 'No base coat colors';
    }
    return baseCoatColorIds
      .map((id) => baseCoatColors.find((c) => c.id === id)?.name || 'Unknown')
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
          onClick={openAddModal}
          disabled={isAdding || editingId !== null}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gf-lime text-white rounded-lg font-semibold hover:bg-gf-dark-green transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
        >
          <Plus size={20} />
          <span>Add Blend</span>
        </button>
      </div>

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
                  <th className="text-left px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold text-slate-900">
                    Base Coat Colors
                  </th>
                  <th className="text-right px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold text-slate-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {blends.map((blend) => (
                  <tr key={blend.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 sm:px-6 py-4">
                      <span className="text-sm sm:text-base font-medium text-slate-900">{blend.name}</span>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <span className="text-xs sm:text-sm text-slate-600">{getSystemNames(blend.systemIds)}</span>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <span className="text-xs sm:text-sm text-slate-600">{getBaseCoatColorNames(blend.baseCoatColorIds)}</span>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(blend)}
                          disabled={isAdding || editingId !== null}
                          className="p-2 text-gf-dark-green hover:bg-green-50 rounded-lg transition-colors disabled:text-slate-400 disabled:hover:bg-transparent"
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

      {(isAdding || editingId !== null) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                {isAdding ? 'Add New Blend' : 'Edit Blend'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Blend Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Mocha Java"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Available Systems</label>
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
                        className="w-4 h-4 text-gf-dark-green border-slate-300 rounded focus:ring-gf-lime"
                      />
                      <span className="text-sm text-slate-700">{system.name}</span>
                    </label>
                  ))}
                </div>
                {systems.length === 0 && (
                  <p className="text-sm text-slate-500 italic">No chip systems available. Add systems first.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Available Base Coat Colors</label>
                <p className="text-xs text-slate-500 mb-3">
                  Select one or many base coat colors that this blend can be used with.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {baseCoatColors.map((color) => (
                    <label
                      key={color.id}
                      className="flex items-center gap-2 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={formData.baseCoatColorIds.includes(color.id)}
                        onChange={() => handleBaseCoatColorToggle(color.id)}
                        className="w-4 h-4 text-gf-dark-green border-slate-300 rounded focus:ring-gf-lime"
                      />
                      <span className="text-sm text-slate-700">{color.name}</span>
                    </label>
                  ))}
                </div>
                {baseCoatColors.length === 0 && (
                  <p className="text-sm text-slate-500 italic">No base coat colors available. Add colors first in Settings.</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 text-sm font-medium text-white bg-gf-lime rounded-lg hover:bg-gf-dark-green transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    <Save size={14} />
                    {isAdding ? 'Add Blend' : 'Save Changes'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
