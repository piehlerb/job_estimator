import { Trash2, Check, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { localToday } from '../../lib/dateUtils';
import type { DashboardModel } from './useDashboard';

export default function OverdueRemindersBanner({ form }: { form: DashboardModel }) {
  const {
    updatingReminder,
    overdueExpanded,
    setOverdueExpanded,
    overdueReminders,
    handleCompleteReminder,
    handleDeleteReminder,
    onEditJob,
  } = form;

  return (
    <div className="border-b border-red-200 bg-red-50">
      <button
        type="button"
        onClick={() => setOverdueExpanded(p => !p)}
        className="w-full flex items-center gap-2 px-3 sm:px-6 py-2.5 text-left"
      >
        <AlertTriangle size={14} className="text-red-500 shrink-0" />
        <span className="text-sm font-semibold text-red-700 flex-1">
          {overdueReminders.length} Overdue Reminder{overdueReminders.length !== 1 ? 's' : ''}
        </span>
        {overdueExpanded
          ? <ChevronDown size={14} className="text-red-400 shrink-0" />
          : <ChevronRight size={14} className="text-red-400 shrink-0" />
        }
      </button>
      {overdueExpanded && (
        <div className="divide-y divide-red-100">
          {overdueReminders.map((reminder) => {
            const daysOverdue = Math.floor(
              (new Date(localToday() + 'T00:00:00').getTime() -
               new Date(reminder.dueAt).getTime()) / (24 * 60 * 60 * 1000)
            );
            return (
              <div key={`${reminder.jobId}-${reminder.reminderId}`}
                className="flex items-start gap-3 px-3 sm:px-6 py-2.5 hover:bg-red-100/50 transition-colors">
                <button onClick={() => onEditJob(reminder.jobId)} className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-medium text-slate-900 truncate">{reminder.subject}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {reminder.jobName}{reminder.customerName ? ` · ${reminder.customerName}` : ''}
                  </div>
                  <div className="text-xs font-medium text-red-600 mt-0.5">
                    {daysOverdue === 0 ? 'Due today' : daysOverdue === 1 ? '1 day overdue' : `${daysOverdue} days overdue`}
                    {' · '}{new Date(reminder.dueAt).toLocaleDateString()}
                  </div>
                </button>
                <div className="flex items-center gap-1 shrink-0 pt-0.5">
                  <button type="button" onClick={() => handleCompleteReminder(reminder)}
                    className="p-1.5 rounded text-green-600 hover:bg-green-100 transition-colors" title="Mark complete" disabled={updatingReminder}>
                    <Check size={14} />
                  </button>
                  <button type="button" onClick={() => handleDeleteReminder(reminder)}
                    className="p-1.5 rounded text-red-600 hover:bg-red-100 transition-colors" title="Delete reminder" disabled={updatingReminder}>
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
