import { X } from 'lucide-react';
import SaveButton from '../../components/SaveButton';
import type { JobFormModel } from './useJobForm';

export default function ReminderModal({ form }: { form: JobFormModel }) {
  const {
    reminderFlash,
    editingReminderId,
    savingReminder,
    reminderForm,
    setReminderForm,
    commTemplates,
    formData,
    closeReminderModal,
    handleSaveReminder,
  } = form;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {editingReminderId ? 'Edit Reminder' : 'Add Reminder'}
          </h2>
          <button
            type="button"
            onClick={closeReminderModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subject *</label>
            <input
              type="text"
              value={reminderForm.subject}
              onChange={(e) => setReminderForm({ ...reminderForm, subject: e.target.value })}
              placeholder="Reminder subject"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
            />
          </div>
          {commTemplates.length > 0 && !editingReminderId && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Template (optional)</label>
              <select
                defaultValue=""
                onChange={(e) => {
                  const tpl = commTemplates.find(t => t.id === e.target.value);
                  if (tpl) {
                    const firstName = (formData.customerName || '').trim().split(' ')[0] || '[Name]';
                    const resolved = tpl.body.replace(/\[Name\]/gi, firstName);
                    setReminderForm(f => ({ ...f, details: resolved }));
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
              >
                <option value="">— Select a template —</option>
                {commTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Message / Details</label>
            <textarea
              value={reminderForm.details}
              onChange={(e) => setReminderForm({ ...reminderForm, details: e.target.value })}
              placeholder="Optional details"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
              <input
                type="date"
                value={reminderForm.dueDate}
                onChange={(e) => setReminderForm({ ...reminderForm, dueDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Time *</label>
              <input
                type="time"
                value={reminderForm.dueTime}
                onChange={(e) => setReminderForm({ ...reminderForm, dueTime: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeReminderModal}
              disabled={savingReminder}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <SaveButton
              type="button"
              onClick={handleSaveReminder}
              saving={savingReminder}
              saved={reminderFlash.saved}
              label={editingReminderId ? 'Save Reminder' : 'Add Reminder'}
              icon={null}
              className="px-4 py-2 text-sm font-medium rounded-lg disabled:bg-slate-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
