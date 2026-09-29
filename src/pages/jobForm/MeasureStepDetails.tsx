import { X, Plus } from 'lucide-react';
import InstallDayScheduleComponent from '../../components/InstallDaySchedule';
import type { JobFormModel } from './useJobForm';

export default function MeasureStepDetails({ form }: { form: JobFormModel }) {
  const {
    pricing,
    activeLaborers,
    installSchedule,
    setInstallSchedule,
    existingJob,
    currentStep,
    evaluation,
    setEvaluation,
    evalInputs,
    setEvalInputs,
    formData,
    setFormData,
  } = form;

  return (
    <div className={`${currentStep === 1 ? 'block' : 'hidden'} md:block`}>

    {/* Evaluation Section */}
    <div className="mt-4">
      <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-3 border-b border-slate-200 pb-1">Evaluation</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(['moisture', 'ph', 'hardness', 'cacl'] as const).map((field) => {
          const labels: Record<string, string> = { moisture: 'Moisture', ph: 'pH', hardness: 'Hardness', cacl: 'CaCl' };
          return (
            <div key={field}>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">{labels[field]}</label>
              <div className="flex gap-1.5 mb-1.5">
                <input
                  type="number"
                  step="any"
                  placeholder="Value"
                  value={evalInputs[field]}
                  onChange={(e) => setEvalInputs({ ...evalInputs, [field]: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = parseFloat(evalInputs[field]);
                      if (!isNaN(val)) {
                        setEvaluation({ ...evaluation, [field]: [...evaluation[field], val] });
                        setEvalInputs({ ...evalInputs, [field]: '' });
                      }
                    }
                  }}
                  className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = parseFloat(evalInputs[field]);
                    if (!isNaN(val)) {
                      setEvaluation({ ...evaluation, [field]: [...evaluation[field], val] });
                      setEvalInputs({ ...evalInputs, [field]: '' });
                    }
                  }}
                  className="px-2 py-1.5 bg-gf-lime text-white rounded-lg hover:bg-gf-dark-green text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {evaluation[field].length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {evaluation[field].map((val, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs">
                      {val}
                      <button
                        type="button"
                        onClick={() => setEvaluation({ ...evaluation, [field]: evaluation[field].filter((_, i) => i !== idx) })}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>

    {/* Install Days - below evaluation */}
    <div className="mt-4">
      <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Install Days</label>
      <input
        type="number"
        placeholder="1"
        min="1"
        value={formData.installDays}
        onChange={(e) => setFormData({ ...formData, installDays: e.target.value })}
        className="w-full sm:w-48 px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
      />
    </div>

    {/* Daily Schedule Section */}
    <div className="border border-slate-200 rounded-lg p-3 sm:p-4 bg-slate-50">
      <InstallDayScheduleComponent
        installDays={parseInt(formData.installDays) || 1}
        schedule={installSchedule}
        availableLaborers={(() => {
          return existingJob
            ? [...activeLaborers, ...existingJob.laborersSnapshot.filter(
                (sl) => !activeLaborers.some((al) => al.id === sl.id)
              )]
            : activeLaborers;
        })()}
        onChange={setInstallSchedule}
        defaultDayHours={pricing.defaultDayHours ?? 8}
      />
    </div>
    </div>
  );
}
