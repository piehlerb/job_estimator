import { useState, useEffect } from 'react';
import {
  getPricing,
  savePricing,
  getDefaultPricing,
} from '../lib/db';
import { Pricing } from '../types';

export default function Settings() {
  const [pricing, setPricing] = useState<Pricing>(getDefaultPricing());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    minimumMarginBuffer: '',
    minimumJobPrice: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const storedPricing = await getPricing();

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

    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
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

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Settings</h1>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Pricing Controls</h3>
        <p className="text-sm text-slate-600 mb-6">
          These values control the suggested pricing calculations. They are soft limits — you'll see visual warnings when actual pricing falls outside these thresholds.
        </p>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
    </div>
  );
}
