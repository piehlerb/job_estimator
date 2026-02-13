import { Plus, Trash2, Edit2 } from 'lucide-react';
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

export default function ChipSystems() {
  const [systems, setSystems] = useState<ChipSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSystemForm, setShowSystemForm] = useState(false);
  const [editingSystem, setEditingSystem] = useState<ChipSystem | null>(null);

  const [systemForm, setSystemForm] = useState({
    name: '',
    feetPerLb: '',
    boxCost: '',
    baseSpread: '',
    topSpread: '',
    cyclo1Spread: '',
    doubleBroadcast: false,
    verticalPricePerSqft: '',
    floorPriceMin: '',
    floorPriceMax: '',
    notes: '',
  });

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
        topSpread: parseFloat(systemForm.topSpread) || 0,
        cyclo1Spread: parseFloat(systemForm.cyclo1Spread) || 0,
        doubleBroadcast: systemForm.doubleBroadcast,
        verticalPricePerSqft: parseFloat(systemForm.verticalPricePerSqft) || 0.75,
        floorPriceMin: parseFloat(systemForm.floorPriceMin) || 6.00,
        floorPriceMax: parseFloat(systemForm.floorPriceMax) || 8.00,
        notes: systemForm.notes || undefined,
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
      setSystemForm({ name: '', feetPerLb: '', boxCost: '', baseSpread: '', topSpread: '', cyclo1Spread: '', doubleBroadcast: false, verticalPricePerSqft: '', floorPriceMin: '', floorPriceMax: '', targetEffectivePricePerSqft: '', notes: '' });
    } catch (error) {
      console.error('Error saving system:', error);
    }
  };

  const handleEditSystem = (system: ChipSystem) => {
    setEditingSystem(system);
    setSystemForm({
      name: system.name,
      feetPerLb: system.feetPerLb.toString(),
      boxCost: system.boxCost.toString(),
      baseSpread: system.baseSpread.toString(),
      topSpread: system.topSpread.toString(),
      cyclo1Spread: (system.cyclo1Spread || 0).toString(),
      doubleBroadcast: system.doubleBroadcast || false,
      verticalPricePerSqft: (system.verticalPricePerSqft ?? 0.75).toString(),
      floorPriceMin: (system.floorPriceMin ?? 6.00).toString(),
      floorPriceMax: (system.floorPriceMax ?? 8.00).toString(),
      notes: system.notes || '',
    });
    setShowSystemForm(true);
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
              setSystemForm({ name: '', feetPerLb: '', boxCost: '', baseSpread: '', topSpread: '', cyclo1Spread: '', doubleBroadcast: false, verticalPricePerSqft: '', floorPriceMin: '', floorPriceMax: '', targetEffectivePricePerSqft: '', notes: '' });
              setShowSystemForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
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
                setSystemForm({ name: '', feetPerLb: '', boxCost: '', baseSpread: '', topSpread: '', cyclo1Spread: '', doubleBroadcast: false, verticalPricePerSqft: '', floorPriceMin: '', floorPriceMax: '', targetEffectivePricePerSqft: '', notes: '' });
                setShowSystemForm(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
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
                  <p className="font-semibold text-slate-900">{system.name}</p>
                  <p className="text-sm text-slate-600 mt-1">
                    {system.feetPerLb} ft/lb | ${system.boxCost}/box
                  </p>
                  <p className="text-sm text-slate-600">
                    Base: {system.baseSpread} | Top: {system.topSpread} | Cyclo1: {system.cyclo1Spread || 0}
                    {system.doubleBroadcast && <span className="ml-2 text-blue-600 font-semibold">• Double Broadcast</span>}
                  </p>
                  {system.notes && (
                    <p className="text-sm text-slate-500 mt-1 italic">
                      {system.notes}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditSystem(system)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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

        {showSystemForm && (
          <div className="mt-6 p-6 bg-slate-50 border border-slate-200 rounded-lg">
            <h4 className="font-semibold text-slate-900 mb-4">
              {editingSystem ? 'Edit System' : 'New System'}
            </h4>
            <form onSubmit={handleSaveSystem} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">System Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Diamond, Silver"
                    value={systemForm.name}
                    onChange={(e) => setSystemForm({ ...systemForm, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
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
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Top Spread</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={systemForm.topSpread}
                    onChange={(e) => setSystemForm({ ...systemForm, topSpread: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={systemForm.doubleBroadcast}
                    onChange={(e) => setSystemForm({ ...systemForm, doubleBroadcast: e.target.checked })}
                    className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-semibold text-slate-900">Double Broadcast</span>
                    <p className="text-xs text-slate-500 mt-0.5">Topcoat requirements will be doubled for this system</p>
                  </div>
                </label>
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
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                />
                <p className="text-xs text-slate-500 mt-1">Optional notes or comments about this system</p>
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
        )}
      </div>
    </div>
  );
}
