import type { JobFormModel } from './useJobForm';

export default function MeasureStepBasics({ form }: { form: JobFormModel }) {
  const {
    currentStep,
    formData,
    setFormData,
    handleFloorFootageChange,
    handleVerticalFootageChange,
  } = form;

  return (
    <div className={`${currentStep === 1 ? 'block' : 'hidden'} md:block`}>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      <div>
        <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Floor Sq Footage</label>
        <input
          type="number"
          placeholder="0"
          value={formData.floorFootage}
          onChange={(e) => handleFloorFootageChange(e.target.value)}
          className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Vertical Sq Footage</label>
        <input
          type="number"
          placeholder="0"
          value={formData.verticalFootage}
          onChange={(e) => handleVerticalFootageChange(e.target.value)}
          className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Crack Fill Factor</label>
        <input
          type="number"
          step="0.1"
          placeholder="0"
          value={formData.crackFillFactor}
          onChange={(e) => setFormData({ ...formData, crackFillFactor: e.target.value })}
          className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Install Date</label>
        <input
          type="date"
          value={formData.installDate}
          onChange={(e) => setFormData({ ...formData, installDate: e.target.value })}
          className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
        />
      </div>
    </div>
    </div>
  );
}
