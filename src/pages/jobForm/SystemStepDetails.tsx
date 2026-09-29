import { BaseColor, CoatingRemovalType } from '../../types';
import MaterialAllocationSection from './MaterialAllocationSection';
import type { JobFormModel } from './useJobForm';

export default function SystemStepDetails({ form }: { form: JobFormModel }) {
  const {
    chipBlendInput,
    showBlendDropdown,
    setShowBlendDropdown,
    tintInventory,
    showTintColorDropdown,
    setShowTintColorDropdown,
    currentStep,
    formData,
    setFormData,
    resolvedMaterials,
    applicableChipBlends,
    selectedBlend,
    availableBaseCoatColors,
    handleChipBlendSelect,
    handleChipBlendInputChange,
  } = form;

  return (
    <div className={`${currentStep === 2 ? 'block' : 'hidden'} md:block`}>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      <div className="relative">
        <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Chip Blend</label>
        <input
          type="text"
          placeholder="Type or select a blend..."
          value={chipBlendInput}
          onChange={(e) => handleChipBlendInputChange(e.target.value)}
          onFocus={() => setShowBlendDropdown(true)}
          onBlur={() => setTimeout(() => setShowBlendDropdown(false), 200)}
          className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
        />
        {showBlendDropdown && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {applicableChipBlends
              .filter((b) => b.name.toLowerCase().includes(chipBlendInput.toLowerCase()))
              .map((blend) => (
                <button
                  key={blend.id}
                  type="button"
                  onClick={() => handleChipBlendSelect(blend)}
                  className="w-full px-3 sm:px-4 py-2 text-left hover:bg-slate-100 text-xs sm:text-sm"
                >
                  {blend.name}
                </button>
              ))}
            {applicableChipBlends.filter((b) => b.name.toLowerCase().includes(chipBlendInput.toLowerCase())).length === 0 && (
              <p className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-500 italic">
                No applicable chip blends for this system.
              </p>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Base Coat Color</label>
        <select
          value={formData.baseColor}
          onChange={(e) => setFormData({ ...formData, baseColor: e.target.value as BaseColor })}
          className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
        >
          <option value="">Select a base coat color...</option>
          {availableBaseCoatColors.map((color) => (
            <option key={color.id} value={color.name}>
              {color.name}
            </option>
          ))}
        </select>
        {selectedBlend && selectedBlend.baseCoatColorIds && selectedBlend.baseCoatColorIds.length > 0 && availableBaseCoatColors.length === 0 && (
          <p className="text-xs text-amber-600 mt-1">This blend has no active base coat colors assigned.</p>
        )}
      </div>

      <div>
        <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Include Basecoat Tint</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="includeBasecoatTint"
              checked={!formData.includeBasecoatTint}
              onChange={() => setFormData({ ...formData, includeBasecoatTint: false })}
              className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
            />
            <span className="text-xs sm:text-sm text-slate-700">No</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="includeBasecoatTint"
              checked={formData.includeBasecoatTint}
              onChange={() => setFormData({ ...formData, includeBasecoatTint: true })}
              className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
            />
            <span className="text-xs sm:text-sm text-slate-700">Yes</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Include Topcoat Tint</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="includeTopcoatTint"
              checked={!formData.includeTopcoatTint}
              onChange={() => setFormData({ ...formData, includeTopcoatTint: false })}
              className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
            />
            <span className="text-xs sm:text-sm text-slate-700">No</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="includeTopcoatTint"
              checked={formData.includeTopcoatTint}
              onChange={() => setFormData({ ...formData, includeTopcoatTint: true })}
              className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
            />
            <span className="text-xs sm:text-sm text-slate-700">Yes</span>
          </label>
        </div>
      </div>

      {(formData.includeBasecoatTint || formData.includeTopcoatTint) && (
        <div>
          <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Tint Color</label>
          <div className="relative">
            <input
              type="text"
              value={formData.tintColor}
              onChange={(e) => {
                setFormData({ ...formData, tintColor: e.target.value });
                setShowTintColorDropdown(true);
              }}
              onFocus={() => setShowTintColorDropdown(true)}
              onBlur={() => setTimeout(() => setShowTintColorDropdown(false), 200)}
              placeholder="Select or type a new color..."
              className="w-full px-3 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
            />
            {showTintColorDropdown && tintInventory.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {tintInventory
                  .filter((t) => t.color.toLowerCase().includes(formData.tintColor.toLowerCase()))
                  .map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, tintColor: t.color });
                        setShowTintColorDropdown(false);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-slate-100 text-sm"
                    >
                      {t.color}
                      <span className="ml-2 text-slate-400 text-xs">{t.ounces} oz on hand</span>
                    </button>
                  ))}
                {formData.tintColor && !tintInventory.some((t) => t.color.toLowerCase() === formData.tintColor.toLowerCase()) && (
                  <div className="px-3 py-2 text-sm text-slate-500 border-t border-slate-200">
                    New color — add to inventory to track usage
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>

    {/* Material Allocation (collapsible) */}
    {resolvedMaterials && (
      <MaterialAllocationSection form={form} />
    )}

    <h3 className="text-sm sm:text-base font-semibold text-slate-900 mt-4 mb-3 border-b border-slate-200 pb-1">Add-ons</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      <div>
        <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Anti-Slip</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="antiSlip"
              checked={!formData.antiSlip}
              onChange={() => setFormData({ ...formData, antiSlip: false })}
              className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
            />
            <span className="text-xs sm:text-sm text-slate-700">No</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="antiSlip"
              checked={formData.antiSlip}
              onChange={() => setFormData({ ...formData, antiSlip: true })}
              className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
            />
            <span className="text-xs sm:text-sm text-slate-700">Yes</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Abrasion Resistance</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="abrasionResistance"
              checked={!formData.abrasionResistance}
              onChange={() => setFormData({ ...formData, abrasionResistance: false })}
              className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
            />
            <span className="text-xs sm:text-sm text-slate-700">No</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="abrasionResistance"
              checked={formData.abrasionResistance}
              onChange={() => setFormData({ ...formData, abrasionResistance: true })}
              className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
            />
            <span className="text-xs sm:text-sm text-slate-700">Yes</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Cyclo1 Topcoat</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="cyclo1Topcoat"
              checked={!formData.cyclo1Topcoat}
              onChange={() => setFormData({ ...formData, cyclo1Topcoat: false })}
              className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
            />
            <span className="text-xs sm:text-sm text-slate-700">No</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="cyclo1Topcoat"
              checked={formData.cyclo1Topcoat}
              onChange={() => setFormData({ ...formData, cyclo1Topcoat: true })}
              className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
            />
            <span className="text-xs sm:text-sm text-slate-700">Yes</span>
          </label>
        </div>
      </div>

      {formData.cyclo1Topcoat && (
        <div>
          <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Additional Cyclo1 Coats (Job)</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="cyclo1Coats"
                checked={formData.cyclo1Coats === '0'}
                onChange={() => setFormData({ ...formData, cyclo1Coats: '0' })}
                className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
              />
              <span className="text-xs sm:text-sm text-slate-700">0</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="cyclo1Coats"
                checked={formData.cyclo1Coats === '1'}
                onChange={() => setFormData({ ...formData, cyclo1Coats: '1' })}
                className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
              />
              <span className="text-xs sm:text-sm text-slate-700">1</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="cyclo1Coats"
                checked={formData.cyclo1Coats === '2'}
                onChange={() => setFormData({ ...formData, cyclo1Coats: '2' })}
                className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
              />
              <span className="text-xs sm:text-sm text-slate-700">2</span>
            </label>
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Coating Removal</label>
        <div className="flex flex-wrap gap-3 sm:gap-4">
          {(['None', 'Paint', 'Epoxy'] as CoatingRemovalType[]).map((type) => (
            <label key={type} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="coatingRemoval"
                value={type}
                checked={formData.coatingRemoval === type}
                onChange={(e) => setFormData({ ...formData, coatingRemoval: e.target.value as CoatingRemovalType })}
                className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
              />
              <span className="text-xs sm:text-sm text-slate-700">{type}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Moisture Mitigation</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="moistureMitigation"
              checked={!formData.moistureMitigation}
              onChange={() => setFormData({ ...formData, moistureMitigation: false })}
              className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
            />
            <span className="text-xs sm:text-sm text-slate-700">No</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="moistureMitigation"
              checked={formData.moistureMitigation}
              onChange={() => setFormData({ ...formData, moistureMitigation: true })}
              className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
            />
            <span className="text-xs sm:text-sm text-slate-700">Yes</span>
          </label>
        </div>
      </div>

    </div>
    </div>
  );
}
