import type { JobFormModel } from './useJobForm';

export default function SuggestedPricingSection({ form }: { form: JobFormModel }) {
  const {
    systems,
    calculation,
    usedPricing,
    formData,
    formatCurrency,
  } = form;
  if (calculation == null) return null;

  return (
    <div className="bg-green-50 rounded-lg p-3 sm:p-4 border border-green-200">
      <h4 className="text-xs sm:text-sm font-semibold text-gf-dark-green mb-2 sm:mb-3 uppercase tracking-wide">Suggested Pricing</h4>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4">
        <div>
          <p className="text-xs text-gf-dark-green">Discount</p>
          <p className="text-sm sm:text-base md:text-lg font-semibold text-gf-dark-green">{formatCurrency(calculation.suggestedDiscount)}</p>
        </div>
        <div>
          <p className="text-xs text-gf-dark-green">Crack Price</p>
          <p className="text-sm sm:text-base md:text-lg font-semibold text-gf-dark-green">{formatCurrency(calculation.suggestedCrackPrice)}</p>
        </div>
        <div>
          <p className="text-xs text-gf-dark-green">Floor $/sqft</p>
          <p className={`text-sm sm:text-base md:text-lg font-semibold ${(() => {
            const selectedSystem = systems.find(s => s.id === formData.system);
            const min = selectedSystem?.floorPriceMin ?? 6;
            const max = selectedSystem?.floorPriceMax ?? 8;
            return (calculation.suggestedFloorPricePerSqft < min || calculation.suggestedFloorPricePerSqft > max) ? 'text-red-600' : 'text-gf-dark-green';
          })()}`}>
            {formatCurrency(calculation.suggestedFloorPricePerSqft)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gf-dark-green">Floor Price</p>
          <p className="text-sm sm:text-base md:text-lg font-semibold text-gf-dark-green">{formatCurrency(calculation.suggestedFloorPrice)}</p>
        </div>
        <div>
          <p className="text-xs text-gf-dark-green">Vertical Price - {formatCurrency(usedPricing.verticalPricePerSqft)}/sqft</p>
          <p className="text-sm sm:text-base md:text-lg font-semibold text-gf-dark-green">{formatCurrency(calculation.suggestedVerticalPrice)}</p>
        </div>
        <div>
          <p className="text-xs text-gf-dark-green">Anti-Slip Price - {formatCurrency(usedPricing.antiSlipPricePerSqft)}/sqft</p>
          <p className="text-sm sm:text-base md:text-lg font-semibold text-gf-dark-green">{formatCurrency(calculation.suggestedAntiSlipPrice)}</p>
        </div>
        <div>
          <p className="text-xs text-gf-dark-green">Abrasion Resistance - {formatCurrency(usedPricing.abrasionResistancePricePerSqft)}/sqft</p>
          <p className="text-sm sm:text-base md:text-lg font-semibold text-gf-dark-green">{formatCurrency(calculation.suggestedAbrasionResistancePrice)}</p>
        </div>
        <div>
          <p className="text-xs text-gf-dark-green">
            Coating Removal - {formData.coatingRemoval}
            {formData.coatingRemoval === 'Paint' && ` - ${formatCurrency(usedPricing.coatingRemovalPaintPerSqft)}/sqft`}
            {formData.coatingRemoval === 'Epoxy' && ` - ${formatCurrency(usedPricing.coatingRemovalEpoxyPerSqft)}/sqft`}
          </p>
          <p className="text-sm sm:text-base md:text-lg font-semibold text-gf-dark-green">{formatCurrency(calculation.suggestedCoatingRemovalPrice)}</p>
        </div>
        <div>
          <p className="text-xs text-gf-dark-green">Moisture Mitigation - {formatCurrency(usedPricing.moistureMitigationPerSqft)}/sqft</p>
          <p className="text-sm sm:text-base md:text-lg font-semibold text-gf-dark-green">{formatCurrency(calculation.suggestedMoistureMitigationPrice)}</p>
          {calculation.moistureMitigationGallons > 0 && (
            <p className="text-xs text-gf-grey mt-0.5">{calculation.moistureMitigationGallons} gal · material {formatCurrency(calculation.moistureMitigationMaterialCost)}</p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-green-200">
        <div>
          <p className="text-xs sm:text-sm text-gf-dark-green">Effective $/Sqft</p>
          <p className="text-xl sm:text-2xl font-bold text-gf-dark-green">{formatCurrency(calculation.suggestedEffectivePricePerSqft)}</p>
        </div>
        <div>
          <p className="text-xs sm:text-sm text-gf-dark-green">Suggested Total</p>
          <p className="text-xl sm:text-2xl font-bold text-gf-dark-green">{formatCurrency(calculation.suggestedTotal)}</p>
        </div>
        <div>
          <p className="text-xs sm:text-sm text-gf-dark-green">Suggested Margin</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600">{formatCurrency(calculation.suggestedMargin)}</p>
        </div>
        <div>
          <p className="text-xs sm:text-sm text-gf-dark-green">Margin %</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600">{calculation.suggestedMarginPct.toFixed(1)}%</p>
        </div>
      </div>
    </div>
  );
}
