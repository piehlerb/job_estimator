import ProductsSection from './ProductsSection';
import SuggestedPricingSection from './SuggestedPricingSection';
import type { JobFormModel } from './useJobForm';

export default function PriceStep({ form }: { form: JobFormModel }) {
  const {
    selectedLaborers,
    systems,
    pricing,
    calculation,
    currentStep,
    formData,
    setFormData,
    recalcActualTotal,
    handleTotalPriceChange,
    formatCurrency,
    getInventoryStatus,
    noLaborersSelected,
    relevantActuals,
  } = form;

  return (
    <div className={`${currentStep === 3 ? 'block' : 'hidden'} md:block`}>

    {/* Calculation Results */}
    {calculation && (
      <div className="bg-slate-50 rounded-lg p-3 sm:p-4 md:p-6 border border-slate-200">
        <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-3 sm:mb-4">Calculated Outputs</h3>

        {/* Material Costs */}
        <div className="mb-4 sm:mb-6">
          <h4 className="text-xs sm:text-sm font-semibold text-slate-700 mb-2 sm:mb-3 uppercase tracking-wide">Material Costs</h4>

          {/* Inventory Status */}
          {(() => {
            const inventoryStatus = getInventoryStatus();
            if (!inventoryStatus) return null;

            return (
              <div className={`mb-3 sm:mb-4 p-3 sm:p-4 rounded-lg border-2 ${
                inventoryStatus.hasInventory
                  ? inventoryStatus.partial
                    ? 'bg-yellow-50 border-yellow-400'
                    : 'bg-green-50 border-green-400'
                  : 'bg-slate-50 border-slate-300'
              }`}>
                <p className={`text-sm sm:text-base font-semibold ${
                  inventoryStatus.hasInventory
                    ? inventoryStatus.partial
                      ? 'text-yellow-800'
                      : 'text-green-800'
                    : 'text-slate-700'
                }`}>
                  {inventoryStatus.message}
                </p>
              </div>
            );
          })()}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
            <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
              <p className="text-xs text-slate-500">Chip Needed</p>
              <p className="text-sm sm:text-base md:text-lg font-semibold">{calculation.chipNeeded} boxes</p>
            </div>
            <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
              <p className="text-xs text-slate-500">Chip Cost</p>
              <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.chipCost)}</p>
            </div>
            <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
              <p className="text-xs text-slate-500">Base Gallons</p>
              <p className="text-sm sm:text-base md:text-lg font-semibold">{calculation.baseGallons.toFixed(2)}</p>
            </div>
            <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
              <p className="text-xs text-slate-500">Base Cost</p>
              <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.baseCost)}</p>
            </div>
            <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
              <p className="text-xs text-slate-500">Top Gallons</p>
              <p className="text-sm sm:text-base md:text-lg font-semibold">{calculation.topGallons.toFixed(2)}</p>
            </div>
            <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
              <p className="text-xs text-slate-500">Top Cost</p>
              <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.topCost)}</p>
            </div>
            <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
              <p className="text-xs text-slate-500">Crack Fill Gallons</p>
              <p className="text-sm sm:text-base md:text-lg font-semibold">{calculation.crackFillGallons.toFixed(2)}</p>
            </div>
            <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
              <p className="text-xs text-slate-500">Crack Fill Cost</p>
              <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.crackFillCost)}</p>
            </div>
            <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
              <p className="text-xs text-slate-500">Cyclo1 Needed</p>
              <p className="text-sm sm:text-base md:text-lg font-semibold">{calculation.cyclo1Needed.toFixed(2)} gal</p>
            </div>
            <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
              <p className="text-xs text-slate-500">Cyclo1 Cost</p>
              <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.cyclo1Cost)}</p>
            </div>
            <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
              <p className="text-xs text-slate-500">Tint Needed</p>
              <p className="text-sm sm:text-base md:text-lg font-semibold">{calculation.tintNeeded.toFixed(2)} oz</p>
            </div>
            <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
              <p className="text-xs text-slate-500">Tint Cost</p>
              <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.tintCost)}</p>
            </div>
            <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
              <p className="text-xs text-slate-500">Anti-Slip Cost</p>
              <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.antiSlipCost)}</p>
            </div>
            <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
              <p className="text-xs text-slate-500">Abrasion Resistance Cost</p>
              <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.abrasionResistanceCost)}</p>
            </div>
            {formData.moistureMitigation && (
              <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
                <p className="text-xs text-slate-500">Moisture Mitigation ({calculation.moistureMitigationGallons} gal)</p>
                <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.moistureMitigationMaterialCost)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Operating Costs */}
        <div className="mb-4 sm:mb-6">
          <h4 className="text-xs sm:text-sm font-semibold text-slate-700 mb-2 sm:mb-3 uppercase tracking-wide">Operating Costs</h4>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
            <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
              <p className="text-xs text-slate-500">Gas Generator</p>
              <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.gasGeneratorCost)}</p>
            </div>
            <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
              <p className="text-xs text-slate-500">Gas Heater</p>
              <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.gasHeaterCost)}</p>
              <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={formData.disableGasHeater}
                  onChange={(e) => setFormData({ ...formData, disableGasHeater: e.target.checked })}
                  className="w-3.5 h-3.5 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
                />
                Disable (force $0)
              </label>
            </div>
            <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
              <p className="text-xs text-slate-500">Gas Travel</p>
              <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.gasTravelCost)}</p>
            </div>
            <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
              <p className="text-xs text-slate-500">Labor ({selectedLaborers.length} workers)</p>
              <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.laborCost)}</p>
            </div>
            <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
              <p className="text-xs text-slate-500">Consumables</p>
              <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.consumablesCost)}</p>
            </div>
            <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
              <p className="text-xs text-slate-500">Royalty (5%)</p>
              <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.royaltyCost)}</p>
            </div>
          </div>
        </div>

        {/* Job Totals */}
        <div className="mb-4 sm:mb-6">
          <h4 className="text-xs sm:text-sm font-semibold text-slate-700 mb-2 sm:mb-3 uppercase tracking-wide">Job Totals</h4>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4">
            <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
              <p className="text-xs text-slate-500">Total Costs</p>
              <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.totalCosts)}</p>
            </div>
            <div className={`bg-white p-2 sm:p-3 rounded border ${calculation.marginPerDay >= 0 ? 'border-green-300' : 'border-red-300'}`}>
              <p className="text-xs text-slate-500">Margin per Day</p>
              <p className={`text-sm sm:text-base md:text-lg font-semibold ${calculation.marginPerDay >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(calculation.marginPerDay)}
              </p>
            </div>
            <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
              <p className="text-xs text-slate-500">Cost per Sqft</p>
              <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.totalCostsPerSqft)}</p>
            </div>
          </div>
        </div>

        {/* Actual Pricing - editable */}
        <div className="bg-green-50 rounded-lg p-3 sm:p-4 border border-green-200 mb-4 sm:mb-6">
          <h4 className="text-xs sm:text-sm font-semibold text-green-800 mb-2 sm:mb-3 uppercase tracking-wide">Actual Pricing</h4>
          {noLaborersSelected && (
            <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-300 rounded-lg text-xs text-yellow-800">
              <span className="font-semibold">⚠ No laborers assigned.</span>
              <span>Labor costs will be $0. Assign laborers in the Daily Schedule above.</span>
            </div>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4">
            <div>
              <label className="text-xs text-green-600">Discount</label>
              <input type="number" step="0.01" value={formData.actualDiscount}
                onChange={(e) => recalcActualTotal('actualDiscount', e.target.value)}
                className="w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b border-green-300 focus:outline-none focus:border-green-600 p-0" />
            </div>
            <div className={relevantActuals?.crackPrice ? 'rounded px-1 -mx-1 bg-orange-50' : ''}>
              <label className="text-xs text-green-600">Crack Price</label>
              <input type="number" step="0.01" value={formData.actualCrackPrice}
                onChange={(e) => recalcActualTotal('actualCrackPrice', e.target.value)}
                className={`w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b focus:outline-none p-0 ${relevantActuals?.crackPrice ? 'border-orange-400 focus:border-orange-500' : 'border-green-300 focus:border-green-600'}`} />
            </div>
            <div className={relevantActuals?.floorPrice ? 'rounded px-1 -mx-1 bg-orange-50' : ''}>
              <label className="text-xs text-green-600">Floor $/sqft</label>
              <input type="number" step="0.01" value={formData.actualFloorPricePerSqft}
                onChange={(e) => recalcActualTotal('actualFloorPricePerSqft', e.target.value)}
                className={`w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b focus:outline-none p-0 ${relevantActuals?.floorPrice ? 'border-orange-400 focus:border-orange-500' : 'border-green-300 focus:border-green-600'}`} />
            </div>
            <div className={relevantActuals?.floorPrice ? 'rounded px-1 -mx-1 bg-orange-50' : ''}>
              <label className="text-xs text-green-600">Floor Price</label>
              <input type="number" step="0.01" value={formData.actualFloorPrice}
                onChange={(e) => recalcActualTotal('actualFloorPrice', e.target.value)}
                className={`w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b focus:outline-none p-0 ${relevantActuals?.floorPrice ? 'border-orange-400 focus:border-orange-500' : 'border-green-300 focus:border-green-600'}`} />
            </div>
            <div className={relevantActuals?.verticalPrice ? 'rounded px-1 -mx-1 bg-orange-50' : ''}>
              <label className="text-xs text-green-600">Vertical $/sqft</label>
              <input type="number" step="0.01" value={formData.actualVerticalPricePerSqft}
                onChange={(e) => recalcActualTotal('actualVerticalPricePerSqft', e.target.value)}
                className={`w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b focus:outline-none p-0 ${relevantActuals?.verticalPrice ? 'border-orange-400 focus:border-orange-500' : 'border-green-300 focus:border-green-600'}`} />
            </div>
            <div className={relevantActuals?.verticalPrice ? 'rounded px-1 -mx-1 bg-orange-50' : ''}>
              <label className="text-xs text-green-600">Vertical Price</label>
              <input type="number" step="0.01" value={formData.actualVerticalPrice}
                onChange={(e) => recalcActualTotal('actualVerticalPrice', e.target.value)}
                className={`w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b focus:outline-none p-0 ${relevantActuals?.verticalPrice ? 'border-orange-400 focus:border-orange-500' : 'border-green-300 focus:border-green-600'}`} />
            </div>
            <div className={relevantActuals?.antiSlipPrice ? 'rounded px-1 -mx-1 bg-orange-50' : ''}>
              <label className="text-xs text-green-600">Anti-Slip Price</label>
              <input type="number" step="0.01" value={formData.actualAntiSlipPrice}
                onChange={(e) => recalcActualTotal('actualAntiSlipPrice', e.target.value)}
                className={`w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b focus:outline-none p-0 ${relevantActuals?.antiSlipPrice ? 'border-orange-400 focus:border-orange-500' : 'border-green-300 focus:border-green-600'}`} />
            </div>
            <div className={relevantActuals?.abrasionResistancePrice ? 'rounded px-1 -mx-1 bg-orange-50' : ''}>
              <label className="text-xs text-green-600">Abrasion Resistance</label>
              <input type="number" step="0.01" value={formData.actualAbrasionResistancePrice}
                onChange={(e) => recalcActualTotal('actualAbrasionResistancePrice', e.target.value)}
                className={`w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b focus:outline-none p-0 ${relevantActuals?.abrasionResistancePrice ? 'border-orange-400 focus:border-orange-500' : 'border-green-300 focus:border-green-600'}`} />
            </div>
            <div className={relevantActuals?.coatingRemovalPrice ? 'rounded px-1 -mx-1 bg-orange-50' : ''}>
              <label className="text-xs text-green-600">Coating Removal</label>
              <input type="number" step="0.01" value={formData.actualCoatingRemovalPrice}
                onChange={(e) => recalcActualTotal('actualCoatingRemovalPrice', e.target.value)}
                className={`w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b focus:outline-none p-0 ${relevantActuals?.coatingRemovalPrice ? 'border-orange-400 focus:border-orange-500' : 'border-green-300 focus:border-green-600'}`} />
            </div>
            <div className={relevantActuals?.moistureMitigationPrice ? 'rounded px-1 -mx-1 bg-orange-50' : ''}>
              <label className="text-xs text-green-600">Moisture Mitigation</label>
              <input type="number" step="0.01" value={formData.actualMoistureMitigationPrice}
                onChange={(e) => recalcActualTotal('actualMoistureMitigationPrice', e.target.value)}
                className={`w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b focus:outline-none p-0 ${relevantActuals?.moistureMitigationPrice ? 'border-orange-400 focus:border-orange-500' : 'border-green-300 focus:border-green-600'}`} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-green-200">
            {(() => {
              const totalPrice = parseFloat(formData.totalPrice) || 0;
              const floorFootage = parseFloat(formData.floorFootage) || 0;
              const effectivePricePerSqft = floorFootage > 0 ? totalPrice / floorFootage : 0;
              const actualMargin = totalPrice - calculation.totalCosts;
              const actualMarginPct = totalPrice > 0 ? (actualMargin / totalPrice) * 100 : 0;
              const minimumMarginBuffer = pricing.minimumMarginBuffer ?? 2000;
              const selectedSystem = systems.find(s => s.id === formData.system);
              const floorPriceMin = selectedSystem?.floorPriceMin ?? 6;
              const floorPriceMax = selectedSystem?.floorPriceMax ?? 8;
              const actualFloorPerSqft = parseFloat(formData.actualFloorPricePerSqft) || 0;
              const floorOutOfRange = actualFloorPerSqft < floorPriceMin || actualFloorPerSqft > floorPriceMax;
              const marginBelowMin = actualMargin < minimumMarginBuffer;

              return (
                <>
                  <div>
                    <p className="text-xs sm:text-sm text-green-600">Effective $/Sqft</p>
                    <p className={`text-xl sm:text-2xl font-bold ${floorOutOfRange ? 'text-red-600' : 'text-green-900'}`}>{formatCurrency(effectivePricePerSqft)}</p>
                  </div>
                  <div>
                    <label className="text-xs sm:text-sm text-green-600">Total Price</label>
                    <input type="number" step="0.01" value={formData.totalPrice}
                      onChange={(e) => handleTotalPriceChange(e.target.value)}
                      className="w-full text-xl sm:text-2xl font-bold text-green-900 bg-transparent border-b border-green-300 focus:outline-none focus:border-green-600 p-0" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-green-600">Actual Margin</p>
                    <p className={`text-xl sm:text-2xl font-bold ${marginBelowMin ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(actualMargin)}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-green-600">Margin %</p>
                    <p className={`text-xl sm:text-2xl font-bold ${marginBelowMin ? 'text-red-600' : 'text-green-600'}`}>{actualMarginPct.toFixed(1)}%</p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Products (collapsible) */}
        <ProductsSection form={form} />

        {/* Suggested Pricing */}
        <SuggestedPricingSection form={form} />
      </div>
    )}
    </div>
  );
}
