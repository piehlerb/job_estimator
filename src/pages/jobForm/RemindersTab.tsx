import { Plus, Trash2, Check, Copy } from 'lucide-react';
import { localToday } from '../../lib/dateUtils';
import type { JobFormModel } from './useJobForm';

export default function RemindersTab({ form }: { form: JobFormModel }) {
  const {
    reminders,
    followUps,
    showFollowUpForm,
    setShowFollowUpForm,
    copiedReminderId,
    setCopiedReminderId,
    followUpForm,
    setFollowUpForm,
    openAddReminder,
    openEditReminder,
    handleDeleteReminder,
    handleCompleteReminder,
    handleLogFollowUp,
    handleDeleteFollowUp,
  } = form;

  return (
    <div className="rounded-lg border border-slate-200 p-4 sm:p-5 bg-slate-50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-slate-900">Reminders</h3>
          <p className="text-xs text-slate-500 mt-1">Task reminders related to this job.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={openAddReminder}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium bg-gf-lime text-white rounded-lg hover:bg-gf-dark-green transition-colors"
          >
            <Plus size={14} />
            Add Reminder
          </button>
        </div>
      </div>

      {reminders.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No reminders added.</p>
      ) : (
        <div className="space-y-2">
          {[...reminders]
            .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
            .map((reminder) => (
              <div key={reminder.id} className={`flex items-start justify-between gap-3 p-3 bg-white border rounded-lg ${reminder.completed ? 'border-slate-100 opacity-60' : 'border-slate-200'}`}>
                <button
                  type="button"
                  onClick={() => !reminder.completed && openEditReminder(reminder)}
                  className="text-left flex-1"
                  disabled={reminder.completed}
                >
                  <p className={`text-sm font-semibold ${reminder.completed ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                    {reminder.subject}
                    {reminder.autoRuleId && (
                      <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-600 rounded align-middle">Auto</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-600">Due {new Date(reminder.dueAt).toLocaleString()}</p>
                  {reminder.details && (
                    <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">{reminder.details}</p>
                  )}
                  {reminder.completed && <p className="text-xs text-green-600 mt-0.5">Completed</p>}
                </button>
                <div className="flex items-center gap-1">
                  {reminder.details && (
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(reminder.details!);
                        setCopiedReminderId(reminder.id);
                        setTimeout(() => setCopiedReminderId(null), 2000);
                      }}
                      className="p-1.5 text-slate-400 hover:text-gf-dark-green hover:bg-green-50 rounded-lg transition-colors"
                      title="Copy message"
                    >
                      {copiedReminderId === reminder.id ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                    </button>
                  )}
                  {!reminder.completed && (
                    <button
                      type="button"
                      onClick={() => handleCompleteReminder(reminder.id)}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Mark complete"
                    >
                      <Check size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteReminder(reminder.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete reminder"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Follow-ups section */}
      <div className="mt-5 pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-900">Follow-ups</h3>
            <p className="text-xs text-slate-500 mt-0.5">Log contacts and interactions with this customer.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setFollowUpForm({ date: localToday(), notes: '' });
              setShowFollowUpForm(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium bg-gf-lime text-white rounded-lg hover:bg-gf-dark-green transition-colors"
          >
            <Plus size={14} />
            Log Follow-up
          </button>
        </div>

        {showFollowUpForm && (
          <div className="mb-3 p-3 bg-white border border-gf-lime rounded-lg space-y-2">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={followUpForm.date}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, date: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={followUpForm.notes}
                onChange={(e) => setFollowUpForm({ ...followUpForm, notes: e.target.value })}
                placeholder="What happened? (optional)"
                rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowFollowUpForm(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogFollowUp}
                className="px-3 py-1.5 text-xs font-medium text-white bg-gf-lime rounded-lg hover:bg-gf-dark-green transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {followUps.length === 0 && !showFollowUpForm ? (
          <p className="text-sm text-slate-500 italic">No follow-ups logged.</p>
        ) : (
          <div className="space-y-2">
            {[...followUps]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((fu) => (
                <div key={fu.id} className="flex items-start justify-between gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{new Date(fu.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    {fu.notes && <p className="text-xs text-slate-500 mt-0.5 whitespace-pre-wrap">{fu.notes}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteFollowUp(fu.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete follow-up"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
