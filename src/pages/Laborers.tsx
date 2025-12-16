import { Plus, Trash2, Edit2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  getAllLaborers,
  addLaborer,
  updateLaborer,
  deleteLaborer,
} from '../lib/db';
import { Laborer } from '../types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export default function Laborers() {
  const [laborers, setLaborers] = useState<Laborer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLaborerForm, setShowLaborerForm] = useState(false);
  const [editingLaborer, setEditingLaborer] = useState<Laborer | null>(null);

  const [laborerForm, setLaborerForm] = useState({
    name: '',
    fullyLoadedRate: '',
    isActive: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const allLaborers = await getAllLaborers();
    setLaborers(allLaborers);
    setLoading(false);
  };

  const handleSaveLaborer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!laborerForm.name.trim()) return;

    try {
      const laborer: Laborer = {
        id: editingLaborer?.id || generateId(),
        name: laborerForm.name,
        fullyLoadedRate: parseFloat(laborerForm.fullyLoadedRate) || 0,
        isActive: laborerForm.isActive,
        createdAt: editingLaborer?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (editingLaborer) {
        await updateLaborer(laborer);
      } else {
        await addLaborer(laborer);
      }

      await loadData();
      setShowLaborerForm(false);
      setEditingLaborer(null);
      setLaborerForm({ name: '', fullyLoadedRate: '', isActive: true });
    } catch (error) {
      console.error('Error saving laborer:', error);
    }
  };

  const handleEditLaborer = (laborer: Laborer) => {
    setEditingLaborer(laborer);
    setLaborerForm({
      name: laborer.name,
      fullyLoadedRate: laborer.fullyLoadedRate.toString(),
      isActive: laborer.isActive,
    });
    setShowLaborerForm(true);
  };

  const handleToggleLaborerActive = async (laborer: Laborer) => {
    const updated = { ...laborer, isActive: !laborer.isActive, updatedAt: new Date().toISOString() };
    await updateLaborer(updated);
    await loadData();
  };

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Laborers</h1>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Your Laborers</h3>
          <button
            onClick={() => {
              setEditingLaborer(null);
              setLaborerForm({ name: '', fullyLoadedRate: '', isActive: true });
              setShowLaborerForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            New Laborer
          </button>
        </div>

        {laborers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-600 mb-4">No laborers created yet</p>
            <button
              onClick={() => {
                setEditingLaborer(null);
                setLaborerForm({ name: '', fullyLoadedRate: '', isActive: true });
                setShowLaborerForm(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              Create Laborer
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {laborers.map((laborer) => (
              <div
                key={laborer.id}
                className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                  laborer.isActive
                    ? 'border-slate-200 hover:bg-slate-50'
                    : 'border-slate-200 bg-slate-100 opacity-60'
                }`}
              >
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleToggleLaborerActive(laborer)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      laborer.isActive ? 'bg-green-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        laborer.isActive ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                  <div>
                    <p className="font-semibold text-slate-900">{laborer.name}</p>
                    <p className="text-sm text-slate-600 mt-1">
                      ${laborer.fullyLoadedRate}/hr fully loaded
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditLaborer(laborer)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={async () => {
                      await deleteLaborer(laborer.id);
                      await loadData();
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showLaborerForm && (
          <div className="mt-6 p-6 bg-slate-50 border border-slate-200 rounded-lg">
            <h4 className="font-semibold text-slate-900 mb-4">
              {editingLaborer ? 'Edit Laborer' : 'New Laborer'}
            </h4>
            <form onSubmit={handleSaveLaborer} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Name</label>
                  <input
                    type="text"
                    placeholder="e.g., John Smith"
                    value={laborerForm.name}
                    onChange={(e) => setLaborerForm({ ...laborerForm, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Fully Loaded Rate ($/hr)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={laborerForm.fullyLoadedRate}
                    onChange={(e) => setLaborerForm({ ...laborerForm, fullyLoadedRate: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={laborerForm.isActive}
                    onChange={(e) => setLaborerForm({ ...laborerForm, isActive: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-900">Active</span>
                </label>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLaborerForm(false);
                    setEditingLaborer(null);
                  }}
                  className="px-4 py-2 bg-slate-300 text-slate-900 rounded-lg font-semibold hover:bg-slate-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
