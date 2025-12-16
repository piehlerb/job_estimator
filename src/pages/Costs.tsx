import { useState, useEffect } from 'react';
import {
  getCosts,
  saveCosts,
  getDefaultCosts,
} from '../lib/db';
import { Costs as CostsType } from '../types';

export default function Costs() {
  const [costs, setCosts] = useState<CostsType>(getDefaultCosts());
  const [loading, setLoading] = useState(true);
  const [costsSaving, setCostsSaving] = useState(false);

  const [costsForm, setCostsForm] = useState({
    baseCostPerGal: '',
    topCostPerGal: '',
    crackFillCost: '',
    gasCost: '',
    consumablesCost: '',
    cyclo1CostPerGal: '',
    tintCostPerQuart: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const storedCosts = await getCosts();

    if (storedCosts) {
      setCosts(storedCosts);
      setCostsForm({
        baseCostPerGal: storedCosts.baseCostPerGal.toString(),
        topCostPerGal: storedCosts.topCostPerGal.toString(),
        crackFillCost: storedCosts.crackFillCost.toString(),
        gasCost: storedCosts.gasCost.toString(),
        consumablesCost: storedCosts.consumablesCost.toString(),
        cyclo1CostPerGal: (storedCosts.cyclo1CostPerGal || 0).toString(),
        tintCostPerQuart: (storedCosts.tintCostPerQuart || 0).toString(),
      });
    }

    setLoading(false);
  };

  const handleSaveCosts = async (e: React.FormEvent) => {
    e.preventDefault();
    setCostsSaving(true);

    try {
      const updatedCosts: CostsType = {
        ...costs,
        baseCostPerGal: parseFloat(costsForm.baseCostPerGal) || 0,
        topCostPerGal: parseFloat(costsForm.topCostPerGal) || 0,
        crackFillCost: parseFloat(costsForm.crackFillCost) || 0,
        gasCost: parseFloat(costsForm.gasCost) || 0,
        consumablesCost: parseFloat(costsForm.consumablesCost) || 0,
        cyclo1CostPerGal: parseFloat(costsForm.cyclo1CostPerGal) || 0,
        tintCostPerQuart: parseFloat(costsForm.tintCostPerQuart) || 0,
        updatedAt: new Date().toISOString(),
      };

      await saveCosts(updatedCosts);
      setCosts(updatedCosts);
    } catch (error) {
      console.error('Error saving costs:', error);
    } finally {
      setCostsSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Cost Settings</h1>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <p className="text-sm text-slate-600 mb-6">
          These costs are used for new job calculations. Existing jobs retain their original cost values.
        </p>
        <form onSubmit={handleSaveCosts} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Base Cost per Gallon ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={costsForm.baseCostPerGal}
                onChange={(e) => setCostsForm({ ...costsForm, baseCostPerGal: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Top Cost per Gallon ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={costsForm.topCostPerGal}
                onChange={(e) => setCostsForm({ ...costsForm, topCostPerGal: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Crack Fill Cost ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={costsForm.crackFillCost}
                onChange={(e) => setCostsForm({ ...costsForm, crackFillCost: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Gas Cost ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={costsForm.gasCost}
                onChange={(e) => setCostsForm({ ...costsForm, gasCost: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Consumables Cost ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={costsForm.consumablesCost}
                onChange={(e) => setCostsForm({ ...costsForm, consumablesCost: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Cyclo1 Cost per Gallon ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={costsForm.cyclo1CostPerGal}
                onChange={(e) => setCostsForm({ ...costsForm, cyclo1CostPerGal: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Tint Cost per Quart ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={costsForm.tintCostPerQuart}
                onChange={(e) => setCostsForm({ ...costsForm, tintCostPerQuart: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="pt-4">
            <button
              type="submit"
              disabled={costsSaving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {costsSaving ? 'Saving...' : 'Save Costs'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
