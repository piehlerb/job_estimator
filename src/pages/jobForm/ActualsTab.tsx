import ActualDayScheduleComponent from '../../components/ActualDaySchedule';
import type { JobFormModel } from './useJobForm';

export default function ActualsTab({ form }: { form: JobFormModel }) {
  const {
    pricing,
    activeLaborers,
    calculation,
    existingJob,
    actualInstallSchedule,
    setActualInstallSchedule,
    actualMaterials,
    setActualMaterials,
    actualCalculation,
    formData,
    formatCurrency,
  } = form;

  return (
    <div className="space-y-6">
      {/* Section A: Actual Labor */}
      <div className="rounded-lg border border-slate-200 p-4 sm:p-5 bg-slate-50">
        <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-1">Actual Labor</h3>
        <p className="text-xs text-slate-500 mb-4">Record actual hours and crew for each install day. Add or remove days if the job ran long or finished early.</p>
        <ActualDayScheduleComponent
          schedule={actualInstallSchedule}
          availableLaborers={existingJob
            ? [...activeLaborers, ...existingJob.laborersSnapshot.filter(sl => !activeLaborers.some(al => al.id === sl.id))]
            : activeLaborers
          }
          onChange={setActualInstallSchedule}
          defaultDayHours={pricing.defaultDayHours ?? 8}
          plannedDays={parseFloat(formData.installDays) || 1}
        />
      </div>

      {/* Section B: Actual Materials */}
      <div className="rounded-lg border border-slate-200 p-4 sm:p-5 bg-slate-50">
        <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-1">Actual Materials Used</h3>
        <p className="text-xs text-slate-500 mb-4">Enter quantities actually consumed. Estimated amounts shown as reference.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Base Coat (gal)
              {calculation && <span className="ml-1 text-slate-400 font-normal">est. {calculation.baseGallons.toFixed(1)}</span>}
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              placeholder={calculation ? calculation.baseGallons.toFixed(1) : '0'}
              value={actualMaterials.actualBaseCoatGallons}
              onChange={(e) => setActualMaterials(prev => ({ ...prev, actualBaseCoatGallons: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Top Coat (gal)
              {calculation && <span className="ml-1 text-slate-400 font-normal">est. {calculation.topGallons.toFixed(1)}</span>}
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              placeholder={calculation ? calculation.topGallons.toFixed(1) : '0'}
              value={actualMaterials.actualTopCoatGallons}
              onChange={(e) => setActualMaterials(prev => ({ ...prev, actualTopCoatGallons: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cyclo1 (gal)
              {calculation && <span className="ml-1 text-slate-400 font-normal">est. {calculation.cyclo1Needed.toFixed(1)}</span>}
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              placeholder={calculation ? calculation.cyclo1Needed.toFixed(1) : '0'}
              value={actualMaterials.actualCyclo1Gallons}
              onChange={(e) => setActualMaterials(prev => ({ ...prev, actualCyclo1Gallons: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tint (oz)
              {calculation && <span className="ml-1 text-slate-400 font-normal">est. {calculation.tintNeeded.toFixed(1)}</span>}
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder={calculation ? calculation.tintNeeded.toFixed(1) : '0'}
              value={actualMaterials.actualTintOz}
              onChange={(e) => setActualMaterials(prev => ({ ...prev, actualTintOz: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Chip Boxes
              {calculation && <span className="ml-1 text-slate-400 font-normal">est. {calculation.chipNeeded}</span>}
            </label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder={calculation ? calculation.chipNeeded.toString() : '0'}
              value={actualMaterials.actualChipBoxes}
              onChange={(e) => setActualMaterials(prev => ({ ...prev, actualChipBoxes: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Crack Repair (oz)
              {calculation && <span className="ml-1 text-slate-400 font-normal">est. {(calculation.crackFillGallons * 128).toFixed(0)}</span>}
            </label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder={calculation ? (calculation.crackFillGallons * 128).toFixed(0) : '0'}
              value={actualMaterials.actualCrackRepairOz}
              onChange={(e) => setActualMaterials(prev => ({ ...prev, actualCrackRepairOz: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              MVB (gal)
              {calculation && <span className="ml-1 text-slate-400 font-normal">est. {calculation.moistureMitigationGallons.toFixed(1)}</span>}
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              placeholder={calculation ? calculation.moistureMitigationGallons.toFixed(1) : '0'}
              value={actualMaterials.actualMoistureMitigationGallons}
              onChange={(e) => setActualMaterials(prev => ({ ...prev, actualMoistureMitigationGallons: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Slab Temp (deg F)
            </label>
            <input
              type="number"
              step="0.1"
              placeholder="0"
              value={actualMaterials.actualSlabTemp}
              onChange={(e) => setActualMaterials(prev => ({ ...prev, actualSlabTemp: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
            />
          </div>
        </div>
      </div>

      {/* Section C: Expense Adjustments */}
      <div className="rounded-lg border border-slate-200 p-4 sm:p-5 bg-slate-50">
        <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-1">Expense Adjustment</h3>
        <p className="text-xs text-slate-500 mb-4">Add or subtract an adjustment to actual costs (e.g., equipment rental, subcontractor fees, credits).</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Amount ($)</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={actualMaterials.actualExpenseAdjustment}
              onChange={(e) => setActualMaterials(prev => ({ ...prev, actualExpenseAdjustment: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
            />
            <p className="mt-1 text-xs text-slate-400">Positive = additional expense, negative = credit/savings.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
            <textarea
              placeholder="Justification for this adjustment..."
              value={actualMaterials.actualExpenseAdjustmentNotes}
              onChange={(e) => setActualMaterials(prev => ({ ...prev, actualExpenseAdjustmentNotes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime resize-y"
            />
          </div>
        </div>
      </div>

      {/* Section D: Actual vs Estimated Cost Comparison */}
      {actualCalculation && calculation && (
        <div className="rounded-lg border border-slate-200 p-4 sm:p-5 bg-white">
          <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-4">Estimated vs. Actual Costs</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 pr-4 text-xs font-semibold text-slate-600 w-32">Category</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-slate-600">Estimated</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-slate-600">Actual</th>
                  <th className="text-right py-2 pl-3 text-xs font-semibold text-slate-600">Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { label: 'Chip', est: calculation.chipCost, act: actualCalculation.actualChipCost },
                  { label: 'Base Coat', est: calculation.baseCost, act: actualCalculation.actualBaseCost },
                  { label: 'Top Coat', est: calculation.topCost, act: actualCalculation.actualTopCost },
                  { label: 'Cyclo1', est: calculation.cyclo1Cost, act: actualCalculation.actualCyclo1Cost },
                  { label: 'Tint', est: calculation.tintCost, act: actualCalculation.actualTintCost },
                  { label: 'Crack Repair', est: calculation.crackFillCost, act: actualCalculation.actualCrackRepairCost },
                  { label: 'MVB', est: calculation.moistureMitigationMaterialCost, act: actualCalculation.actualMoistureMitigationCost },
                  {
                    label: 'Gas',
                    est: calculation.gasGeneratorCost + calculation.gasHeaterCost + calculation.gasTravelCost,
                    act: actualCalculation.actualGasGeneratorCost + actualCalculation.actualGasHeaterCost + actualCalculation.actualGasTravelCost,
                  },
                  { label: 'Labor', est: calculation.laborCost, act: actualCalculation.actualLaborCost },
                  { label: 'Consumables', est: calculation.consumablesCost, act: actualCalculation.actualConsumablesCost },
                  { label: 'Royalty', est: calculation.royaltyCost, act: actualCalculation.actualRoyaltyCost },
                  ...(actualCalculation.actualExpenseAdjustment !== 0 ? [{ label: 'Expense Adj.', est: 0, act: actualCalculation.actualExpenseAdjustment }] : []),
                ].map(({ label, est, act }) => {
                  const diff = act - est;
                  return (
                    <tr key={label}>
                      <td className="py-2 pr-4 text-xs text-slate-700">{label}</td>
                      <td className="py-2 px-3 text-right text-xs text-slate-600">{formatCurrency(est)}</td>
                      <td className="py-2 px-3 text-right text-xs text-slate-800 font-medium">{formatCurrency(act)}</td>
                      <td className={`py-2 pl-3 text-right text-xs font-medium ${diff > 0.01 ? 'text-red-600' : diff < -0.01 ? 'text-green-700' : 'text-slate-500'}`}>
                        {diff > 0.01 ? '+' : ''}{formatCurrency(diff)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-slate-300 font-semibold">
                  <td className="py-2.5 pr-4 text-sm text-slate-900">Total</td>
                  <td className="py-2.5 px-3 text-right text-sm text-slate-700">{formatCurrency(calculation.totalCosts)}</td>
                  <td className="py-2.5 px-3 text-right text-sm text-slate-900">{formatCurrency(actualCalculation.actualTotalCosts)}</td>
                  <td className={`py-2.5 pl-3 text-right text-sm font-semibold ${(actualCalculation.actualTotalCosts - calculation.totalCosts) > 0.01 ? 'text-red-600' : 'text-green-700'}`}>
                    {(actualCalculation.actualTotalCosts - calculation.totalCosts) > 0.01 ? '+' : ''}{formatCurrency(actualCalculation.actualTotalCosts - calculation.totalCosts)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Margin summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-4 border-t border-slate-200">
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-xs text-slate-500 mb-1">Estimated Margin</p>
              <p className="text-lg font-bold text-slate-800">{formatCurrency(calculation.jobMargin)}</p>
              <p className="text-xs text-slate-500">{calculation.totalCosts > 0 ? ((calculation.jobMargin / (parseFloat(formData.totalPrice) || 1)) * 100).toFixed(1) : '0.0'}%</p>
            </div>
            <div className={`rounded-lg p-3 border ${actualCalculation.actualMargin >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-xs text-slate-500 mb-1">Actual Margin</p>
              <p className={`text-lg font-bold ${actualCalculation.actualMargin >= 0 ? 'text-green-800' : 'text-red-700'}`}>
                {formatCurrency(actualCalculation.actualMargin)}
              </p>
              <p className="text-xs text-slate-500">{actualCalculation.actualMarginPct.toFixed(1)}%</p>
            </div>
            <div className={`rounded-lg p-3 border ${(actualCalculation.actualMargin - calculation.jobMargin) >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-xs text-slate-500 mb-1">Margin Difference</p>
              <p className={`text-lg font-bold ${(actualCalculation.actualMargin - calculation.jobMargin) >= 0 ? 'text-green-800' : 'text-red-700'}`}>
                {(actualCalculation.actualMargin - calculation.jobMargin) >= 0 ? '+' : ''}{formatCurrency(actualCalculation.actualMargin - calculation.jobMargin)}
              </p>
              <p className="text-xs text-slate-500">vs. estimated</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
