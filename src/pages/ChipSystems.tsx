import { Plus, Trash2, Edit2, Star } from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  getAllSystems,
  addSystem,
  updateSystem,
  deleteSystem,
} from '../lib/db';
import { ChipSystem } from '../types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

const defaultSystemForm = {
  name: '',
  feetPerLb: '',
  boxCost: '',
  baseSpread: '',
  baseCoats: '1',
  topSpread: '',
  topCoats: '1',
  cyclo1Spread: '',
  cyclo1Coats: '1',
  verticalPricePerSqft: '',
  floorPriceMin: '',
  floorPriceMax: '',
  notes: '',
};

export default function ChipSystems() {
  const [systems, setSystems] = useState<ChipSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSystemForm, setShowSystemForm] = useState(false);
  const [editingSystem, setEditingSystem] = useState<ChipSystem | null>(null);
  const [systemForm, setSystemForm] = useState(defaultSystemForm);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const allSystems = await getAllSystems();
    setSystems(allSystems);
    setLoading(false);
  };

  const handleSaveSystem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!systemForm.name.trim()) return;

    try {
      const system: ChipSystem = {
        id: editingSystem?.id || generateId(),
        name: systemForm.name,
        feetPerLb: parseFloat(systemForm.feetPerLb) || 0,
        boxCost: parseFloat(systemForm.boxCost) || 0,
        baseSpread: parseFloat(systemForm.baseSpread) || 0,
        baseCoats: Math.max(parseInt(systemForm.baseCoats, 10) || 0, 0),
        topSpread: parseFloat(systemForm.topSpread) || 0,
        topCoats: Math.max(parseInt(systemForm.topCoats, 10) || 0, 0),
        cyclo1Spread: parseFloat(systemForm.cyclo1Spread) || 0,
        cyclo1Coats: Math.max(parseInt(systemForm.cyclo1Coats, 10) || 0, 0),
        verticalPricePerSqft: parseFloat(systemForm.verticalPricePerSqft) || 0.75,
        floorPriceMin: parseFloat(systemForm.floorPriceMin) || 6.0,
        floorPriceMax: parseFloat(systemForm.floorPriceMax) || 8.0,
        notes: systemForm.notes || undefined,
        isDefault: editingSystem?.isDefault,
        createdAt: editingSystem?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (editingSystem) {
        await updateSystem(system);
      } else {
        await addSystem(system);
      }

      await loadData();
      setShowSystemForm(false);
      setEditingSystem(null);
      setSystemForm(defaultSystemForm);
    } catch (error) {
      console.error('Error saving system:', error);
    }
  };

  const handleEditSystem = (system: ChipSystem) => {
    setEditingSystem(system);
    const fallbackTopCoats = (system as unknown as { doubleBroadcast?: boolean }).doubleBroadcast ? 2 : 1;
    setSystemForm({
      name: system.name,
      feetPerLb: system.feetPerLb.toString(),
      boxCost: system.boxCost.toString(),
      baseSpread: system.baseSpread.toString(),
      baseCoats: (system.baseCoats ?? 1).toString(),
      topSpread: system.topSpread.toString(),
      topCoats: (system.topCoats ?? fallbackTopCoats).toString(),
      cyclo1Spread: (system.cyclo1Spread || 0).toString(),
      cyclo1Coats: (system.cyclo1Coats ?? 1).toString(),
      verticalPricePerSqft: (system.verticalPricePerSqft ?? 0.75).toString(),
      floorPriceMin: (system.floorPriceMin ?? 6.0).toString(),
      floorPriceMax: (system.floorPriceMax ?? 8.0).toString(),
      notes: system.notes || '',
    });
    setShowSystemForm(true);
  };

  const handleSetDefault = async (systemId: string) => {
    try {
      for (const system of systems) {
        const wasDefault = !!system.isDefault;
        const willBeDefault = system.id === systemId;
        if (wasDefault !== willBeDefault) {
          await updateSystem({ ...system, isDefault: willBeDefault, updatedAt: new Date().toISOString() });
        }
      }
      await loadData();
    } catch (error) {
      console.error('Error setting default system:', error);
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Chip Systems</h1>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Your Systems</h3>
          <button
            onClick={() => {
              setEditingSystem(null);
              setSystemForm(defaultSystemForm);
              setShowSystemForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gf-lime text-white rounded-lg font-semibold hover:bg-gf-dark-green transition-colors"
          >
            <Plus size={18} />
            New System
          </button>
        </div>

        {systems.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-600 mb-4">No systems created yet</p>
            <button
              onClick={() => {
                setEditingSystem(null);
                setSystemForm(defaultSystemForm);
                setShowSystemForm(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gf-lime text-white rounded-lg font-semibold hover:bg-gf-dark-green transition-colors"
            >
              <Plus size={18} />
              Create System
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {systems.map((system) => (
              <div
                key={system.id}
                className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">{system.name}</p>
                    {system.isDefault && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gf-lime text-white text-xs font-semibold rounded-full">
                        <Star size={10} className="fill-white" />
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    {system.feetPerLb} ft/lb | ${system.boxCost}/box
                  </p>
                  <p className="text-sm text-slate-600">
                    Base: {system.baseSpread} @ {system.baseCoats ?? 1} coats | Top: {system.topSpread} @ {system.topCoats ?? 1} coats | Cyclo1: {system.cyclo1Spread || 0} @ {system.cyclo1Coats ?? 1} coats
                  </p>
                  {system.notes && (
                    <p className="text-sm text-slate-500 mt-1 italic">
                      {system.notes}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSetDefault(system.id)}
                    title={system.isDefault ? 'Default system' : 'Set as default'}
                    className={`p-2 rounded-lg transition-colors ${system.isDefault ? 'text-gf-lime cursor-default' : 'text-slate-400 hover:text-gf-lime hover:bg-green-50'}`}
                  >
                    <Star size={18} className={system.isDefault ? 'fill-gf-lime' : ''} />
                  </button>
                  <button
                    onClick={() => handleEditSystem(system)}
                    className="p-2 text-gf-dark-green hover:bg-green-50 rounded-lg transition-colors"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={async () => {
                      await deleteSystem(system.id);
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

      </div>
      {showSystemForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h4 className="font-semibold text-slate-900">
                {editingSystem ? 'Edit System' : 'New System'}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setShowSystemForm(false);
                  setEditingSystem(null);
                }}
                className="text-slate-500 hover:text-slate-700 text-sm font-medium"
              >
                Close
              </button>
            </div>
            <form onSubmit={handleSaveSystem} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">System Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Diamond, Silver"
                    value={systemForm.name}
                    onChange={(e) => setSystemForm({ ...systemForm, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Feet per lb</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={systemForm.feetPerLb}
                    onChange={(e) => setSystemForm({ ...systemForm, feetPerLb: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 mt-1">Enter coverage in square feet per pound (not per 40 lb box).</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Box Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={systemForm.boxCost}
                    onChange={(e) => setSystemForm({ ...systemForm, boxCost: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Base Spread</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={systemForm.baseSpread}
                    onChange={(e) => setSystemForm({ ...systemForm, baseSpread: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Base Coats</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="1"
                    value={systemForm.baseCoats}
                    onChange={(e) => setSystemForm({ ...systemForm, baseCoats: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Top Spread</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={systemForm.topSpread}
                    onChange={(e) => setSystemForm({ ...systemForm, topSpread: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Top Coats</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="1"
                    value={systemForm.topCoats}
                    onChange={(e) => setSystemForm({ ...systemForm, topCoats: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Cyclo1 Spread</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={systemForm.cyclo1Spread}
                    onChange={(e) => setSystemForm({ ...systemForm, cyclo1Spread: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Cyclo1 Coats</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="1"
                    value={systemForm.cyclo1Coats}
                    onChange={(e) => setSystemForm({ ...systemForm, cyclo1Coats: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  />
                </div>
              </div>
              <div className="border-t border-slate-200 my-4"></div>
              <h5 className="text-md font-semibold text-slate-900 mb-3">Pricing Configuration</h5>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Vertical Price per Sqft ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.75"
                    value={systemForm.verticalPricePerSqft}
                    onChange={(e) => setSystemForm({ ...systemForm, verticalPricePerSqft: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 mt-1">Price per sqft for vertical surfaces</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Floor Price Min ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="6.00"
                    value={systemForm.floorPriceMin}
                    onChange={(e) => setSystemForm({ ...systemForm, floorPriceMin: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 mt-1">Minimum suggested floor price/sqft</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Floor Price Max ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="8.00"
                    value={systemForm.floorPriceMax}
                    onChange={(e) => setSystemForm({ ...systemForm, floorPriceMax: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 mt-1">Maximum suggested floor price/sqft</p>
                </div>
              </div>
              <div className="border-t border-slate-200 my-4"></div>
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Notes</label>
                <textarea
                  placeholder="Add any notes about this chip system..."
                  value={systemForm.notes}
                  onChange={(e) => setSystemForm({ ...systemForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent resize-y"
                />
                <p className="text-xs text-slate-500 mt-1">Optional notes or comments about this system</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-4 py-2 bg-gf-lime text-white rounded-lg font-semibold hover:bg-gf-dark-green transition-colors"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSystemForm(false);
                    setEditingSystem(null);
                  }}
                  className="px-4 py-2 bg-slate-300 text-slate-900 rounded-lg font-semibold hover:bg-slate-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
