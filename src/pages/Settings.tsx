import { ArrowLeft, Plus, Trash2, Edit2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  getAllSystems,
  getAllPricingVariables,
  addSystem,
  updateSystem,
  deleteSystem,
  addPricingVariable,
  updatePricingVariable,
  deletePricingVariable,
} from '../lib/db';
import { ChipSystem, PricingVariable } from '../types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

interface SettingsProps {
  onBack: () => void;
}

export default function Settings({ onBack }: SettingsProps) {
  const [tab, setTab] = useState<'systems' | 'pricing'>('systems');
  const [systems, setSystems] = useState<ChipSystem[]>([]);
  const [pricingVars, setPricingVars] = useState<PricingVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSystemForm, setShowSystemForm] = useState(false);
  const [showPricingForm, setShowPricingForm] = useState(false);
  const [editingSystem, setEditingSystem] = useState<ChipSystem | null>(null);
  const [editingPricing, setEditingPricing] = useState<PricingVariable | null>(null);

  const [systemForm, setSystemForm] = useState({
    name: '',
    chipPrice: '',
    installPrice: '',
  });

  const [pricingForm, setPricingForm] = useState({
    name: '',
    value: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const allSystems = await getAllSystems();
    const allPricing = await getAllPricingVariables();
    setSystems(allSystems);
    setPricingVars(allPricing);
    setLoading(false);
  };

  const handleSaveSystem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!systemForm.name.trim()) return;

    try {
      const system: ChipSystem = {
        id: editingSystem?.id || generateId(),
        name: systemForm.name,
        chipPrice: parseFloat(systemForm.chipPrice) || 0,
        installPrice: parseFloat(systemForm.installPrice) || 0,
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
      setSystemForm({ name: '', chipPrice: '', installPrice: '' });
    } catch (error) {
      console.error('Error saving system:', error);
    }
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pricingForm.name.trim()) return;

    try {
      const variable: PricingVariable = {
        id: editingPricing?.id || generateId(),
        name: pricingForm.name,
        value: parseFloat(pricingForm.value) || 0,
        createdAt: editingPricing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (editingPricing) {
        await updatePricingVariable(variable);
      } else {
        await addPricingVariable(variable);
      }

      await loadData();
      setShowPricingForm(false);
      setEditingPricing(null);
      setPricingForm({ name: '', value: '' });
    } catch (error) {
      console.error('Error saving pricing variable:', error);
    }
  };

  const handleEditSystem = (system: ChipSystem) => {
    setEditingSystem(system);
    setSystemForm({
      name: system.name,
      chipPrice: system.chipPrice.toString(),
      installPrice: system.installPrice.toString(),
    });
    setShowSystemForm(true);
  };

  const handleEditPricing = (variable: PricingVariable) => {
    setEditingPricing(variable);
    setPricingForm({
      name: variable.name,
      value: variable.value.toString(),
    });
    setShowPricingForm(true);
  };

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft size={20} />
        <span className="font-medium">Back</span>
      </button>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200 flex">
          <button
            onClick={() => setTab('systems')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              tab === 'systems'
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            Chip Systems
          </button>
          <button
            onClick={() => setTab('pricing')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              tab === 'pricing'
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            Pricing Variables
          </button>
        </div>

        <div className="p-6">
          {tab === 'systems' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Chip Systems</h3>
                <button
                  onClick={() => {
                    setEditingSystem(null);
                    setSystemForm({ name: '', chipPrice: '', installPrice: '' });
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
                      setSystemForm({ name: '', chipPrice: '', installPrice: '' });
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
                          Chip: ${system.chipPrice} | Install: ${system.installPrice}
                        </p>
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
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-2">Chip Price ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={systemForm.chipPrice}
                          onChange={(e) => setSystemForm({ ...systemForm, chipPrice: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-2">Install Price ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={systemForm.installPrice}
                          onChange={(e) => setSystemForm({ ...systemForm, installPrice: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
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
          )}

          {tab === 'pricing' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Pricing Variables</h3>
                <button
                  onClick={() => {
                    setEditingPricing(null);
                    setPricingForm({ name: '', value: '' });
                    setShowPricingForm(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  <Plus size={18} />
                  New Variable
                </button>
              </div>

              {pricingVars.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-600 mb-4">No pricing variables yet</p>
                  <button
                    onClick={() => {
                      setEditingPricing(null);
                      setPricingForm({ name: '', value: '' });
                      setShowPricingForm(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                  >
                    <Plus size={18} />
                    Create Variable
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {pricingVars.map((variable) => (
                    <div
                      key={variable.id}
                      className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{variable.name}</p>
                        <p className="text-sm text-slate-600 mt-1">Value: {variable.value}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditPricing(variable)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={async () => {
                            await deletePricingVariable(variable.id);
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

              {showPricingForm && (
                <div className="mt-6 p-6 bg-slate-50 border border-slate-200 rounded-lg">
                  <h4 className="font-semibold text-slate-900 mb-4">
                    {editingPricing ? 'Edit Variable' : 'New Variable'}
                  </h4>
                  <form onSubmit={handleSavePricing} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-2">Variable Name</label>
                      <input
                        type="text"
                        placeholder="e.g., Hourly Rate, Gas Cost"
                        value={pricingForm.name}
                        onChange={(e) => setPricingForm({ ...pricingForm, name: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-2">Value</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={pricingForm.value}
                        onChange={(e) => setPricingForm({ ...pricingForm, value: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
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
                          setShowPricingForm(false);
                          setEditingPricing(null);
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
          )}
        </div>
      </div>
    </div>
  );
}
