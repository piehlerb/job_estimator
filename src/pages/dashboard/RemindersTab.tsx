import { Trash2, Bell, Check } from 'lucide-react';
import type { DashboardModel } from './useDashboard';

export default function RemindersTab({ form }: { form: DashboardModel }) {
  const {
    updatingReminder,
    remindersByDue,
    handleCompleteReminder,
    handleDeleteReminder,
    onEditJob,
  } = form;

  return (
    <div className="md:bg-white">
      {remindersByDue.length === 0 ? (
        <div className="p-12 text-center">
          <Bell size={24} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-500">No pending reminders.</p>
        </div>
      ) : (
        <div className="px-3.5 md:px-0 py-2.5 md:py-0 flex flex-col gap-2 md:gap-0 md:divide-y md:divide-slate-100">
          {remindersByDue.map((reminder) => {
            const now = Date.now();
            const dueAtTime = new Date(reminder.dueAt).getTime();
            const startOfTomorrow = new Date();
            startOfTomorrow.setHours(24, 0, 0, 0);
            const isPastDue = dueAtTime < now;
            const isDueTodayOrPast = dueAtTime < startOfTomorrow.getTime();
            return (
              <div key={`${reminder.jobId}-${reminder.reminderId}`}
                className={`bg-white border border-slate-200 md:border-0 md:border-b md:border-slate-100 rounded-[14px] md:rounded-none px-4 md:px-6 py-3.5 md:py-3 flex items-start gap-3 ${
                  isPastDue ? 'md:bg-red-50' : isDueTodayOrPast ? 'md:bg-amber-50' : ''
                }`}>
                <button onClick={() => onEditJob(reminder.jobId)} className="flex-1 min-w-0 text-left">
                  <div className="text-[14.5px] font-bold text-[#0f172a] truncate">{reminder.subject}</div>
                  <div className="text-xs text-slate-400 mt-0.5 truncate">{reminder.jobName}</div>
                  {reminder.details && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{reminder.details}</p>}
                  <p className={`num text-xs font-bold mt-1.5 ${isPastDue ? 'text-[#dc2626]' : isDueTodayOrPast ? 'text-[#a16207]' : 'text-slate-500'}`}>
                    {new Date(reminder.dueAt).toLocaleString()}
                  </p>
                </button>
                <div className="flex items-center gap-1 shrink-0 pt-0.5">
                  <button type="button" onClick={() => handleCompleteReminder(reminder)}
                    className="p-1.5 rounded text-green-600 hover:bg-green-50 transition-colors" title="Mark complete" disabled={updatingReminder}>
                    <Check size={14} />
                  </button>
                  <button type="button" onClick={() => handleDeleteReminder(reminder)}
                    className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors" title="Delete reminder" disabled={updatingReminder}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
