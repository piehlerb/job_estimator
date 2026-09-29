import { X } from 'lucide-react';
import type { DashboardModel } from './useDashboard';

export default function NextReminderModal({ form }: { form: DashboardModel }) {
  const {
    updatingReminder,
    nextReminderFor,
    setNextReminderFor,
    nextReminderForm,
    setNextReminderForm,
    commTemplates,
    handleCreateNextReminder,
  } = form;
  if (nextReminderFor == null) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Create Next Reminder</h3>
          <button type="button" onClick={() => setNextReminderFor(null)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-600">
            Reminder completed for <span className="font-medium text-slate-900">{nextReminderFor.jobName || 'this job'}</span>. Schedule a follow-up?
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
            <input type="text" value={nextReminderForm.subject}
              onChange={(e) => setNextReminderForm((f) => ({ ...f, subject: e.target.value }))}
              placeholder="e.g. Follow up call"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
              <input type="date" value={nextReminderForm.dueDate}
                onChange={(e) => setNextReminderForm((f) => ({ ...f, dueDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Time</label>
              <input type="time" value={nextReminderForm.dueTime}
                onChange={(e) => setNextReminderForm((f) => ({ ...f, dueTime: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime" />
            </div>
          </div>
          {commTemplates.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Template (optional)</label>
              <select defaultValue=""
                onChange={(e) => {
                  const tpl = commTemplates.find(t => t.id === e.target.value);
                  if (tpl) {
                    const firstName = (nextReminderFor?.customerName || '').trim().split(' ')[0] || '[Name]';
                    setNextReminderForm((f) => ({ ...f, details: tpl.body.replace(/\[Name\]/gi, firstName) }));
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime">
                <option value="">— Select a template —</option>
                {commTemplates.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Message / Details (optional)</label>
            <textarea value={nextReminderForm.details}
              onChange={(e) => setNextReminderForm((f) => ({ ...f, details: e.target.value }))}
              rows={2} placeholder="Additional notes..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime resize-none" />
          </div>
          <div className="pt-1 flex items-center justify-end gap-2">
            <button type="button" onClick={handleCreateNextReminder} disabled={updatingReminder}
              className="px-3 py-2 text-sm font-medium text-white bg-gf-lime rounded-lg hover:bg-gf-dark-green transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed">
              Create Reminder
            </button>
            <button type="button" onClick={() => setNextReminderFor(null)}
              className="px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
              No Thanks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
