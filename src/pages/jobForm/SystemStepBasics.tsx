import type { JobFormModel } from './useJobForm';

export default function SystemStepBasics({ form }: { form: JobFormModel }) {
  const {
    systems,
    currentStep,
    formData,
    handleSystemChange,
  } = form;

  return (
    <div className={`${currentStep === 2 ? 'block' : 'hidden'} md:block`}>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      <div>
        <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Chip System *</label>
        <select
          value={formData.system}
          onChange={(e) => handleSystemChange(e.target.value)}
          className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent bg-white"
        >
          <option value="">Select a system...</option>
          {systems.map((sys) => (
            <option key={sys.id} value={sys.id}>
              {sys.name}
            </option>
          ))}
        </select>
      </div>
    </div>
    </div>
  );
}
