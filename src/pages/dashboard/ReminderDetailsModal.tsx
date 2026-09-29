import { X } from 'lucide-react';
import type { DashboardModel } from './useDashboard';

export default function ReminderDetailsModal({ form }: { form: DashboardModel }) {
  const {
    selectedReminder,
    setSelectedReminder,
    updatingReminder,
    selectedReminderDetails,
    handleCompleteReminder,
    handleDeleteReminder,
  } = form;
  if (selectedReminderDetails == null) return null;
  if (selectedReminder == null) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Reminder</h3>
          <button type="button" onClick={() => setSelectedReminder(null)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div>
            <p className="text-xs text-slate-500">Job</p>
            <p className="text-sm font-medium text-slate-900">{selectedReminderDetails.job.name || 'Untitled Job'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Subject</p>
            <p className="text-sm font-medium text-slate-900">{selectedReminderDetails.reminder.subject}</p>
          </div>
          {selectedReminderDetails.reminder.details && (
            <div>
              <p className="text-xs text-slate-500">Details</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedReminderDetails.reminder.details}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-500">Due</p>
            <p className="text-sm text-slate-700">{new Date(selectedReminderDetails.reminder.dueAt).toLocaleString()}</p>
          </div>
          <div className="pt-2 flex items-center justify-end gap-2">
            <button type="button" onClick={() => handleCompleteReminder(selectedReminder)} disabled={updatingReminder}
              className="px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed">
              Mark Complete
            </button>
            <button type="button" onClick={() => handleDeleteReminder(selectedReminder)} disabled={updatingReminder}
              className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed">
              Delete
            </button>
            <button type="button" onClick={() => setSelectedReminder(null)}
              className="px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
