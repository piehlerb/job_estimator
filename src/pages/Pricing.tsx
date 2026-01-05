import { useState, useEffect } from 'react';
import {
  getPricing,
  savePricing,
  getDefaultPricing,
} from '../lib/db';
import { Pricing as PricingType } from '../types';

export default function Pricing() {
  const [pricing, setPricing] = useState<PricingType>(getDefaultPricing());
  const [loading, setLoading] = useState(true);
  const [pricingSaving, setPricingSaving] = useState(false);

  const [pricingForm, setPricingForm] = useState({
    verticalPricePerSqft: '',
    antiSlipPricePerSqft: '',
    coatingRemovalPaintPerSqft: '',
    coatingRemovalEpoxyPerSqft: '',
    moistureMitigationPerSqft: '',
    floorPriceMin: '',
    floorPriceMax: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const storedPricing = await getPricing();

    if (storedPricing) {
      // Merge with defaults to ensure new fields have values
      const mergedPricing = {
        ...getDefaultPricing(),
        ...storedPricing,
      };
      setPricing(mergedPricing);
      setPricingForm({
        verticalPricePerSqft: storedPricing.verticalPricePerSqft.toString(),
        antiSlipPricePerSqft: storedPricing.antiSlipPricePerSqft.toString(),
        coatingRemovalPaintPerSqft: storedPricing.coatingRemovalPaintPerSqft.toString(),
        coatingRemovalEpoxyPerSqft: storedPricing.coatingRemovalEpoxyPerSqft.toString(),
        moistureMitigationPerSqft: storedPricing.moistureMitigationPerSqft.toString(),
        floorPriceMin: (storedPricing.floorPriceMin ?? 6.00).toString(),
        floorPriceMax: (storedPricing.floorPriceMax ?? 8.00).toString(),
      });
    }

    setLoading(false);
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    setPricingSaving(true);

    try {
      const updatedPricing: PricingType = {
        ...pricing,
        verticalPricePerSqft: parseFloat(pricingForm.verticalPricePerSqft) || 0,
        antiSlipPricePerSqft: parseFloat(pricingForm.antiSlipPricePerSqft) || 0,
        coatingRemovalPaintPerSqft: parseFloat(pricingForm.coatingRemovalPaintPerSqft) || 0,
        coatingRemovalEpoxyPerSqft: parseFloat(pricingForm.coatingRemovalEpoxyPerSqft) || 0,
        moistureMitigationPerSqft: parseFloat(pricingForm.moistureMitigationPerSqft) || 0,
        floorPriceMin: parseFloat(pricingForm.floorPriceMin) || 6.00,
        floorPriceMax: parseFloat(pricingForm.floorPriceMax) || 8.00,
        updatedAt: new Date().toISOString(),
      };

      console.log('[Pricing] Saving pricing:', updatedPricing);
      await savePricing(updatedPricing);
      console.log('[Pricing] Pricing saved successfully');
      setPricing(updatedPricing);
    } catch (error) {
      console.error('Error saving pricing:', error);
    } finally {
      setPricingSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Pricing Settings</h1>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <p className="text-sm text-slate-600 mb-6">
          These pricing values are used for suggested pricing calculations in new jobs. Existing jobs retain their original pricing values.
        </p>
        <form onSubmit={handleSavePricing} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Vertical Price per Sqft ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={pricingForm.verticalPricePerSqft}
                onChange={(e) => setPricingForm({ ...pricingForm, verticalPricePerSqft: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">Multiplied by vertical square footage</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Anti-Slip Price per Sqft ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={pricingForm.antiSlipPricePerSqft}
                onChange={(e) => setPricingForm({ ...pricingForm, antiSlipPricePerSqft: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">Multiplied by floor square footage (when anti-slip is selected)</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Paint Removal Price per Sqft ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={pricingForm.coatingRemovalPaintPerSqft}
                onChange={(e) => setPricingForm({ ...pricingForm, coatingRemovalPaintPerSqft: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">Multiplied by floor square footage (when paint removal is selected)</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Epoxy Removal Price per Sqft ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={pricingForm.coatingRemovalEpoxyPerSqft}
                onChange={(e) => setPricingForm({ ...pricingForm, coatingRemovalEpoxyPerSqft: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">Multiplied by floor square footage (when epoxy removal is selected)</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Moisture Mitigation Price per Sqft ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={pricingForm.moistureMitigationPerSqft}
                onChange={(e) => setPricingForm({ ...pricingForm, moistureMitigationPerSqft: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">Multiplied by floor square footage (when moisture mitigation is selected)</p>
            </div>
          </div>
          <div className="border-t border-slate-200 my-6"></div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Floor Price Constraints</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Minimum Floor Price per Sqft ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="6.00"
                value={pricingForm.floorPriceMin}
                onChange={(e) => setPricingForm({ ...pricingForm, floorPriceMin: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">Minimum suggested floor price per square foot</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Maximum Floor Price per Sqft ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="8.00"
                value={pricingForm.floorPriceMax}
                onChange={(e) => setPricingForm({ ...pricingForm, floorPriceMax: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">Maximum suggested floor price per square foot</p>
            </div>
          </div>
          <div className="pt-4">
            <button
              type="submit"
              disabled={pricingSaving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {pricingSaving ? 'Saving...' : 'Save Pricing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
