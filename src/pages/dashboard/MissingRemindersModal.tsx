import { X } from 'lucide-react';
import type { DashboardModel } from './useDashboard';

export default function MissingRemindersModal({ form }: { form: DashboardModel }) {
  const {
    setShowMissingRemindersModal,
    pendingJobsWithoutReminders,
    onEditJob,
  } = form;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="missing-reminders-modal-title"
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 id="missing-reminders-modal-title" className="text-lg font-semibold text-slate-900">
            Pending Estimates Without Reminders
          </h2>
          <button
            type="button"
            onClick={() => setShowMissingRemindersModal(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">
          {pendingJobsWithoutReminders.length === 0 ? (
            <p className="text-sm text-slate-600">All pending estimates have an active reminder.</p>
          ) : (
            <div className="max-h-[60vh] overflow-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {pendingJobsWithoutReminders.map((missingJob) => {
                const estimateDate = missingJob.estimateDate || missingJob.createdAt.slice(0, 10);
                return (
                  <div key={missingJob.id} className="flex flex-col gap-3 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{missingJob.name}</p>
                      <p className="text-xs text-slate-600">
                        {missingJob.customerName || 'No customer'} - Estimate {new Date(`${estimateDate}T12:00:00`).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setShowMissingRemindersModal(false); onEditJob(missingJob.id); }}
                      className="inline-flex items-center justify-center rounded-lg bg-gf-lime px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gf-dark-green"
                    >
                      Open
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
