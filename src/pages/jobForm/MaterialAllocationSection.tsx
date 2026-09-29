import { ChevronDown, ChevronUp, X, Plus } from 'lucide-react';
import type { JobFormModel } from './useJobForm';

export default function MaterialAllocationSection({ form }: { form: JobFormModel }) {
  const {
    calculation,
    showAllocationSection,
    setShowAllocationSection,
    allocationOverrideEnabled,
    setAllocationOverrideEnabled,
    topAllocation,
    setTopAllocation,
    baseAllocation,
    setBaseAllocation,
    allocationError,
    setAllocationError,
    formData,
    enableAllocationOverride,
    resetAllocationToDefaults,
    applyMochaPreset,
    allocationTintColorOptions,
    allocationVariantOptions,
    resolvedMaterials,
    topAllocationTotalPct,
    baseAllocationTotalPct,
  } = form;
  if (resolvedMaterials == null) return null;

  return (
    <div className="rounded-lg border border-slate-200 mt-4">
      <button
        type="button"
        onClick={() => setShowAllocationSection(!showAllocationSection)}
        className={`w-full flex items-center justify-between px-3 sm:px-4 py-3 text-left bg-gf-lime/15 hover:bg-gf-lime/25 transition-colors ${showAllocationSection ? 'rounded-t-lg' : 'rounded-lg'}`}
      >
        <div className="flex items-center gap-2">
          <h4 className="text-xs sm:text-sm font-semibold text-gf-dark-green uppercase tracking-wide">Material Allocation</h4>
          {allocationOverrideEnabled && (
            <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
              Override
            </span>
          )}
        </div>
        {showAllocationSection ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>

      {showAllocationSection && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-slate-200">
          <label className="flex items-center gap-2 cursor-pointer mt-3 mb-3">
            <input
              type="checkbox"
              checked={allocationOverrideEnabled}
              onChange={(e) => {
                if (e.target.checked) {
                  enableAllocationOverride();
                } else {
                  setAllocationOverrideEnabled(false);
                  setAllocationError('');
                }
              }}
              className="w-4 h-4 text-gf-dark-green border-slate-300 rounded focus:ring-gf-lime"
            />
            <span className="text-xs sm:text-sm font-semibold text-slate-900">Override default allocation</span>
          </label>

          {allocationOverrideEnabled && (
            <div className="space-y-4 mb-4">
              {/* Topcoat flavors editor */}
              {calculation && calculation.topGallons > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Topcoat Flavors</p>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${Math.abs(topAllocationTotalPct - 100) <= 0.1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {topAllocationTotalPct.toFixed(1).replace(/\.0$/, '')}%
                    </span>
                  </div>
                  {topAllocation.map((row, idx) => (
                    <div key={idx} className="flex items-center gap-2 mb-2">
                      <select
                        value={row.variant}
                        onChange={(e) => setTopAllocation(topAllocation.map((r, i) => (i === idx ? { ...r, variant: e.target.value } : r)))}
                        className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                      >
                        <option value="">Variant...</option>
                        {allocationVariantOptions(['Original', 'Slow Cure'], row.variant).map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={row.sharePct}
                          onChange={(e) => setTopAllocation(topAllocation.map((r, i) => (i === idx ? { ...r, sharePct: parseFloat(e.target.value) || 0 } : r)))}
                          className="w-20 px-2 py-2 text-sm text-right border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                        />
                        <span className="text-xs text-slate-500">%</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTopAllocation(topAllocation.filter((_, i) => i !== idx))}
                        className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setTopAllocation([...topAllocation, { variant: '', sharePct: 0 }])}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gf-dark-green hover:bg-slate-50 rounded transition-colors"
                  >
                    <Plus size={12} />
                    Add flavor
                  </button>
                </div>
              )}

              {/* Base B components editor */}
              {calculation && calculation.baseGallons > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Base B Components</p>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${Math.abs(baseAllocationTotalPct - 100) <= 0.1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {baseAllocationTotalPct.toFixed(1).replace(/\.0$/, '')}%
                    </span>
                  </div>

                  {formData.baseColor === 'Mocha' && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => applyMochaPreset([
                          { variant: 'Normal', color: 'Grey', sharePct: 50, tintColor: '' },
                          { variant: 'Normal', color: 'Tan', sharePct: 50, tintColor: '' },
                        ])}
                        className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 text-slate-700 transition-colors"
                      >
                        Grey B + Tan B
                      </button>
                      <button
                        type="button"
                        onClick={() => applyMochaPreset([
                          { variant: 'Normal', color: 'Grey', sharePct: 50, tintColor: '' },
                          { variant: 'Normal', color: 'Clear', sharePct: 50, tintColor: 'Tan' },
                        ])}
                        className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 text-slate-700 transition-colors"
                      >
                        Grey B + Clear B (Tan tint)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyMochaPreset([
                          { variant: 'Normal', color: 'Tan', sharePct: 50, tintColor: '' },
                          { variant: 'Normal', color: 'Clear', sharePct: 50, tintColor: 'Grey' },
                        ])}
                        className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 text-slate-700 transition-colors"
                      >
                        Tan B + Clear B (Grey tint)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyMochaPreset([
                          { variant: 'Normal', color: 'Clear', sharePct: 50, tintColor: 'Grey' },
                          { variant: 'Normal', color: 'Clear', sharePct: 50, tintColor: 'Tan' },
                        ])}
                        className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 text-slate-700 transition-colors"
                      >
                        All Clear (Grey + Tan tint)
                      </button>
                    </div>
                  )}

                  {baseAllocation.map((row, idx) => (
                    <div key={idx} className="flex items-center gap-2 mb-2">
                      <select
                        value={row.variant}
                        onChange={(e) => setBaseAllocation(baseAllocation.map((r, i) => (i === idx ? { ...r, variant: e.target.value } : r)))}
                        className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                      >
                        <option value="">Variant...</option>
                        {allocationVariantOptions(['Normal', 'Extended'], row.variant).map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                      <select
                        value={row.color}
                        onChange={(e) => setBaseAllocation(baseAllocation.map((r, i) => (i === idx ? { ...r, color: e.target.value, tintColor: e.target.value === 'Clear' ? r.tintColor : '' } : r)))}
                        className="w-24 px-2 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                      >
                        <option value="">Color...</option>
                        <option value="Grey">Grey</option>
                        <option value="Tan">Tan</option>
                        <option value="Clear">Clear</option>
                      </select>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={row.sharePct}
                          onChange={(e) => setBaseAllocation(baseAllocation.map((r, i) => (i === idx ? { ...r, sharePct: parseFloat(e.target.value) || 0 } : r)))}
                          className="w-20 px-2 py-2 text-sm text-right border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                        />
                        <span className="text-xs text-slate-500">%</span>
                      </div>
                      <select
                        value={row.tintColor}
                        disabled={row.color !== 'Clear'}
                        onChange={(e) => setBaseAllocation(baseAllocation.map((r, i) => (i === idx ? { ...r, tintColor: e.target.value } : r)))}
                        className="w-28 px-2 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <option value="">No tint</option>
                        {allocationTintColorOptions(row.tintColor).map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setBaseAllocation(baseAllocation.filter((_, i) => i !== idx))}
                        className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setBaseAllocation([...baseAllocation, { variant: 'Normal', color: '', sharePct: 0, tintColor: '' }])}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gf-dark-green hover:bg-slate-50 rounded transition-colors"
                  >
                    <Plus size={12} />
                    Add component
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={resetAllocationToDefaults}
                className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 text-slate-600 transition-colors"
              >
                Reset to defaults
              </button>
            </div>
          )}

          {allocationError && (
            <p className="text-xs text-red-600 mb-2">{allocationError}</p>
          )}

          {/* Resolved allocation (read-only) */}
          <div>
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Resolved Materials</p>
            <table className="w-full text-sm">
              <tbody>
                {resolvedMaterials.coating.map((line) => (
                  <tr key={line.key} className="border-b border-slate-100">
                    <td className="py-1.5 text-slate-900">{line.label}</td>
                    <td className="py-1.5 text-right text-slate-900 font-medium">{line.gallons.toFixed(2)} gal</td>
                  </tr>
                ))}
                {resolvedMaterials.tint.map((line) => (
                  <tr key={line.key} className="border-b border-slate-100">
                    <td className="py-1.5 text-slate-900">{line.label}</td>
                    <td className="py-1.5 text-right text-slate-900 font-medium">{line.oz.toFixed(1)} oz</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {resolvedMaterials.warnings.map((warning, idx) => (
              <p key={idx} className="text-xs text-amber-600 mt-1">{warning}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
