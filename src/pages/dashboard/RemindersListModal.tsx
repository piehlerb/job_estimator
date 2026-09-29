import { Trash2, Check, X } from 'lucide-react';
import type { DashboardModel } from './useDashboard';

export default function RemindersListModal({ form }: { form: DashboardModel }) {
  const {
    setShowReminders,
    setSelectedReminder,
    updatingReminder,
    remindersByDue,
    remindersNeedingAttentionCount,
    handleCompleteReminder,
    handleDeleteReminder,
  } = form;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Reminders</h3>
            <p className="text-xs text-slate-500">{remindersByDue.length} total, {remindersNeedingAttentionCount} due today or earlier</p>
          </div>
          <button type="button" onClick={() => setShowReminders(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">
          {remindersByDue.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No reminders found.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {remindersByDue.map((reminder) => {
                const now = Date.now();
                const dueAtTime = new Date(reminder.dueAt).getTime();
                const startOfTomorrow = new Date();
                startOfTomorrow.setHours(24, 0, 0, 0);
                const isPastDue = dueAtTime < now;
                const isDueTodayOrPast = dueAtTime < startOfTomorrow.getTime();
                return (
                  <div key={`${reminder.jobId}-${reminder.reminderId}`}
                    className={`w-full text-left p-3 border rounded-lg transition-colors hover:bg-white ${
                      isPastDue ? 'border-red-200 bg-red-50' : isDueTodayOrPast ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'
                    }`}>
                    <div className="flex items-start justify-between gap-3">
                      <button type="button" onClick={() => setSelectedReminder(reminder)} className="flex-1 text-left">
                        <p className="text-sm font-semibold text-slate-900">{reminder.subject}</p>
                        <p className="text-xs text-slate-600 mt-0.5">{reminder.jobName}</p>
                        {reminder.details && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{reminder.details}</p>}
                        <p className={`text-xs font-medium mt-1 ${isPastDue ? 'text-red-700' : isDueTodayOrPast ? 'text-amber-700' : 'text-slate-600'}`}>
                          {new Date(reminder.dueAt).toLocaleString()}
                        </p>
                      </button>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleCompleteReminder(reminder); }}
                          className="p-1.5 rounded text-green-600 hover:bg-green-50 transition-colors" title="Mark complete" disabled={updatingReminder}>
                          <Check size={14} />
                        </button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteReminder(reminder); }}
                          className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors" title="Delete reminder" disabled={updatingReminder}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
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
