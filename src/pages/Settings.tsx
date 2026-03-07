import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import {
  getPricing,
  savePricing,
  getDefaultPricing,
  getAllBaseCoatColors,
  addBaseCoatColor,
  updateBaseCoatColor,
  deleteBaseCoatColor,
} from '../lib/db';
import { Pricing, BaseCoatColor } from '../types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export default function Settings() {
  const [pricing, setPricing] = useState<Pricing>(getDefaultPricing());
  const [baseCoatColors, setBaseCoatColors] = useState<BaseCoatColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAddingColor, setIsAddingColor] = useState(false);
  const [editingColorId, setEditingColorId] = useState<string | null>(null);
  const [colorName, setColorName] = useState('');

  const [form, setForm] = useState({
    minimumMarginBuffer: '',
    minimumJobPrice: '',
  });

  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [storedPricing, storedBaseCoatColors] = await Promise.all([
      getPricing(),
      getAllBaseCoatColors(),
    ]);

    if (storedPricing) {
      const mergedPricing = {
        ...getDefaultPricing(),
        ...storedPricing,
      };
      setPricing(mergedPricing);
      setForm({
        minimumMarginBuffer: (mergedPricing.minimumMarginBuffer ?? 2000).toString(),
        minimumJobPrice: (mergedPricing.minimumJobPrice ?? 2500).toString(),
      });
    } else {
      setForm({
        minimumMarginBuffer: '2000',
        minimumJobPrice: '2500',
      });
    }

    const normalizeName = (name: string) => name.trim().toLowerCase();
    const byName = new Map<string, BaseCoatColor>();
    const duplicates: BaseCoatColor[] = [];

    for (const color of storedBaseCoatColors) {
      const key = normalizeName(color.name);
      if (!key) continue;

      if (byName.has(key)) {
        duplicates.push(color);
      } else {
        byName.set(key, color);
      }
    }

    if (duplicates.length > 0) {
      for (const duplicate of duplicates) {
        await deleteBaseCoatColor(duplicate.id);
      }
    }

    const dedupedColors = Array.from(byName.values());
    const defaultNames = ['Grey', 'Tan', 'Clear'];
    const existingNames = new Set(dedupedColors.map((color) => normalizeName(color.name)));
    const missingDefaults = defaultNames.filter((name) => !existingNames.has(normalizeName(name)));

    if (missingDefaults.length > 0) {
      const now = new Date().toISOString();
      for (const name of missingDefaults) {
        await addBaseCoatColor({
          id: generateId(),
          name,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    setBaseCoatColors(await getAllBaseCoatColors());

    setLoading(false);
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updatedPricing: Pricing = {
        ...pricing,
        minimumMarginBuffer: parseFloat(form.minimumMarginBuffer) || 2000,
        minimumJobPrice: parseFloat(form.minimumJobPrice) || 2500,
        updatedAt: new Date().toISOString(),
      };

      await savePricing(updatedPricing);
      setPricing(updatedPricing);
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const resetColorForm = () => {
    setColorName('');
    setIsAddingColor(false);
    setEditingColorId(null);
  };

  const handleStartAddColor = () => {
    setColorName('');
    setIsAddingColor(true);
    setEditingColorId(null);
  };

  const handleStartEditColor = (color: BaseCoatColor) => {
    setColorName(color.name);
    setEditingColorId(color.id);
    setIsAddingColor(false);
  };

  const handleSaveColor = async () => {
    const trimmedName = colorName.trim();
    if (!trimmedName) {
      alert('Please enter a base coat color name');
      return;
    }

    const duplicate = baseCoatColors.find(
      (c) => c.name.toLowerCase() === trimmedName.toLowerCase() && c.id !== editingColorId
    );
    if (duplicate) {
      alert('That base coat color already exists');
      return;
    }

    const now = new Date().toISOString();

    try {
      if (isAddingColor) {
        await addBaseCoatColor({
          id: generateId(),
          name: trimmedName,
          createdAt: now,
          updatedAt: now,
        });
      } else if (editingColorId) {
        const existing = baseCoatColors.find((c) => c.id === editingColorId);
        if (existing) {
          await updateBaseCoatColor({
            ...existing,
            name: trimmedName,
            updatedAt: now,
          });
        }
      }

      setBaseCoatColors(await getAllBaseCoatColors());
      resetColorForm();
    } catch (error) {
      console.error('Error saving base coat color:', error);
      alert('Error saving base coat color. Please try again.');
    }
  };

  const handleDeleteColor = async (id: string) => {
    if (!confirm('Are you sure you want to delete this base coat color?')) {
      return;
    }

    try {
      await deleteBaseCoatColor(id);
      setBaseCoatColors(await getAllBaseCoatColors());
    } catch (error) {
      console.error('Error deleting base coat color:', error);
      alert('Error deleting base coat color. Please try again.');
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Settings</h1>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Pricing Controls</h3>
        <p className="text-sm text-slate-600 mb-6">
          These values control the suggested pricing calculations. They are soft limits and visual warnings appear when actual pricing falls outside these thresholds.
        </p>
        <form onSubmit={handleSavePricing} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Minimum Margin Buffer ($)</label>
              <input
                type="number"
                step="1"
                placeholder="2000"
                value={form.minimumMarginBuffer}
                onChange={(e) => setForm({ ...form, minimumMarginBuffer: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">Added to total costs when calculating suggested floor price per sqft</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Minimum Job Price ($)</label>
              <input
                type="number"
                step="1"
                placeholder="2500"
                value={form.minimumJobPrice}
                onChange={(e) => setForm({ ...form, minimumJobPrice: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">Suggested total will be adjusted upward if it falls below this amount</p>
            </div>
          </div>
          <div className="pt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Base Coat Colors</h3>
            <p className="text-sm text-slate-600 mt-1">Manage the base coat color list used by chip blends and jobs.</p>
          </div>
          <button
            onClick={handleStartAddColor}
            disabled={isAddingColor || editingColorId !== null}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
          >
            <Plus size={18} />
            <span>Add Color</span>
          </button>
        </div>

        {(isAddingColor || editingColorId !== null) && (
          <div className="border border-slate-200 rounded-lg p-4 mb-4">
            <label className="block text-sm font-semibold text-slate-900 mb-2">Color Name</label>
            <input
              type="text"
              value={colorName}
              onChange={(e) => setColorName(e.target.value)}
              placeholder="e.g., Grey"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSaveColor}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                <Save size={16} />
                <span>Save</span>
              </button>
              <button
                onClick={resetColorForm}
                className="flex items-center gap-2 px-5 py-2 bg-slate-200 text-slate-900 rounded-lg font-semibold hover:bg-slate-300 transition-colors"
              >
                <X size={16} />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        )}

        {baseCoatColors.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No base coat colors configured.</p>
        ) : (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-slate-900">Color Name</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-slate-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {baseCoatColors.map((color) => (
                  <tr key={color.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-900">{color.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleStartEditColor(color)}
                          disabled={isAddingColor || editingColorId !== null}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:text-slate-400 disabled:hover:bg-transparent"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteColor(color.id)}
                          disabled={isAddingColor || editingColorId !== null}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:text-slate-400 disabled:hover:bg-transparent"
                          title="Delete"
                        >
                          <Trash2 size={16} />
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
    </div>
  );
}

