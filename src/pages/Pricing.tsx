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
    antiSlipPricePerSqft: '',
    abrasionResistancePricePerSqft: '',
    crackFillFactorUnitsPerGallon: '',
    suggestedCrackFillPriceMultiplier: '',
    coatingRemovalPaintPerSqft: '',
    coatingRemovalEpoxyPerSqft: '',
    moistureMitigationPerSqft: '',
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
        antiSlipPricePerSqft: mergedPricing.antiSlipPricePerSqft.toString(),
        abrasionResistancePricePerSqft: mergedPricing.abrasionResistancePricePerSqft?.toString() || '0',
        crackFillFactorUnitsPerGallon: (mergedPricing.crackFillFactorUnitsPerGallon ?? 5).toString(),
        suggestedCrackFillPriceMultiplier: (mergedPricing.suggestedCrackFillPriceMultiplier ?? 3).toString(),
        coatingRemovalPaintPerSqft: mergedPricing.coatingRemovalPaintPerSqft.toString(),
        coatingRemovalEpoxyPerSqft: mergedPricing.coatingRemovalEpoxyPerSqft.toString(),
        moistureMitigationPerSqft: mergedPricing.moistureMitigationPerSqft.toString(),
      });
    } else {
      const defaults = getDefaultPricing();
      setPricing(defaults);
      setPricingForm({
        antiSlipPricePerSqft: defaults.antiSlipPricePerSqft.toString(),
        abrasionResistancePricePerSqft: defaults.abrasionResistancePricePerSqft.toString(),
        crackFillFactorUnitsPerGallon: (defaults.crackFillFactorUnitsPerGallon ?? 5).toString(),
        suggestedCrackFillPriceMultiplier: (defaults.suggestedCrackFillPriceMultiplier ?? 3).toString(),
        coatingRemovalPaintPerSqft: defaults.coatingRemovalPaintPerSqft.toString(),
        coatingRemovalEpoxyPerSqft: defaults.coatingRemovalEpoxyPerSqft.toString(),
        moistureMitigationPerSqft: defaults.moistureMitigationPerSqft.toString(),
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
        antiSlipPricePerSqft: parseFloat(pricingForm.antiSlipPricePerSqft) || 0,
        abrasionResistancePricePerSqft: parseFloat(pricingForm.abrasionResistancePricePerSqft) || 0,
        crackFillFactorUnitsPerGallon: parseFloat(pricingForm.crackFillFactorUnitsPerGallon) || 5,
        suggestedCrackFillPriceMultiplier: parseFloat(pricingForm.suggestedCrackFillPriceMultiplier) || 3,
        coatingRemovalPaintPerSqft: parseFloat(pricingForm.coatingRemovalPaintPerSqft) || 0,
        coatingRemovalEpoxyPerSqft: parseFloat(pricingForm.coatingRemovalEpoxyPerSqft) || 0,
        moistureMitigationPerSqft: parseFloat(pricingForm.moistureMitigationPerSqft) || 0,
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
        <p className="text-sm text-slate-600 mb-4">
          These pricing values are used for suggested pricing calculations in new jobs. Existing jobs retain their original pricing values.
        </p>
        <p className="text-sm text-gf-dark-green mb-6 bg-green-50 p-3 rounded-lg border border-green-200">
          <strong>Note:</strong> Vertical pricing and floor price constraints are now configured per chip system in the Chip Systems page.
        </p>
        <form onSubmit={handleSavePricing} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Anti-Slip Price per Sqft ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={pricingForm.antiSlipPricePerSqft}
                onChange={(e) => setPricingForm({ ...pricingForm, antiSlipPricePerSqft: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">Multiplied by floor square footage (when anti-slip is selected)</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Abrasion Resistance Price per Sqft ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={pricingForm.abrasionResistancePricePerSqft}
                onChange={(e) => setPricingForm({ ...pricingForm, abrasionResistancePricePerSqft: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">Multiplied by floor square footage (when abrasion resistance is selected)</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Crack Fill Factor Units per Gallon</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                placeholder="5"
                value={pricingForm.crackFillFactorUnitsPerGallon}
                onChange={(e) => setPricingForm({ ...pricingForm, crackFillFactorUnitsPerGallon: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">How many crack-fill factor units equals 1 gallon (default: 5)</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Suggested Crack Fill Price Multiplier</label>
              <input
                type="number"
                step="0.1"
                min="0"
                placeholder="3"
                value={pricingForm.suggestedCrackFillPriceMultiplier}
                onChange={(e) => setPricingForm({ ...pricingForm, suggestedCrackFillPriceMultiplier: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">Suggested crack-fill price = crack-fill cost × this multiplier (default: 3)</p>
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
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
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
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
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
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">Multiplied by floor square footage (when moisture mitigation is selected)</p>
            </div>
          </div>
          <div className="pt-4">
            <button
              type="submit"
              disabled={pricingSaving}
              className="px-6 py-2 bg-gf-lime text-white rounded-lg font-semibold hover:bg-gf-dark-green transition-colors disabled:opacity-50"
            >
              {pricingSaving ? 'Saving...' : 'Save Pricing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
