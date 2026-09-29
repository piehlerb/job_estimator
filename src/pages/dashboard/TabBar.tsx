import { localToday } from '../../lib/dateUtils';
import type { DashboardModel } from './useDashboard';

export default function TabBar({ form }: { form: DashboardModel }) {
  const {
    viewMode,
    setViewMode,
    setSelectedDay,
    filteredAndSortedJobs,
    remindersByDue,
    remindersNeedingAttentionCount,
    needsContactJobs,
    dayTotalCount,
  } = form;

  return (
    <div className="scrollbar-hide flex gap-1 bg-white border-b border-slate-200 px-2 overflow-x-auto">
      <button
        onClick={() => setViewMode('jobs')}
        className={`flex-1 min-w-[78px] flex items-center justify-center gap-1.5 py-3 text-[13.5px] font-bold whitespace-nowrap transition-colors border-b-[2.5px] ${
          viewMode === 'jobs'
            ? 'text-gf-dark-green border-gf-lime'
            : 'text-slate-400 border-transparent hover:text-slate-600'
        }`}
      >
        Jobs
        <span className={`num px-1.5 py-0.5 rounded-full text-[11px] font-extrabold ${
          viewMode === 'jobs' ? 'bg-gf-lime/15 text-gf-dark-green' : 'bg-slate-100 text-slate-400'
        }`}>{filteredAndSortedJobs.length}</span>
      </button>
      <button
        onClick={() => setViewMode('needs-contact')}
        className={`flex-1 min-w-[78px] flex items-center justify-center gap-1.5 py-3 text-[13.5px] font-bold whitespace-nowrap transition-colors border-b-[2.5px] ${
          viewMode === 'needs-contact'
            ? 'text-orange-600 border-orange-400'
            : 'text-slate-400 border-transparent hover:text-slate-600'
        }`}
      >
        Contact
        {needsContactJobs.length > 0 && (
          <span className={`num px-1.5 py-0.5 rounded-full text-[11px] font-extrabold ${
            viewMode === 'needs-contact' ? 'bg-orange-100 text-orange-700' : 'bg-orange-50 text-orange-500'
          }`}>{needsContactJobs.length}</span>
        )}
      </button>
      <button
        onClick={() => { setViewMode('today'); setSelectedDay(localToday()); }}
        className={`flex-1 min-w-[78px] flex items-center justify-center gap-1.5 py-3 text-[13.5px] font-bold whitespace-nowrap transition-colors border-b-[2.5px] ${
          viewMode === 'today'
            ? 'text-blue-600 border-blue-400'
            : 'text-slate-400 border-transparent hover:text-slate-600'
        }`}
      >
        Today
        {dayTotalCount > 0 && (
          <span className={`num px-1.5 py-0.5 rounded-full text-[11px] font-extrabold ${
            viewMode === 'today' ? 'bg-blue-100 text-blue-700' : 'bg-blue-50 text-blue-500'
          }`}>{dayTotalCount}</span>
        )}
      </button>
      <button
        onClick={() => setViewMode('reminders')}
        className={`flex-1 min-w-[78px] flex items-center justify-center gap-1.5 py-3 text-[13.5px] font-bold whitespace-nowrap transition-colors border-b-[2.5px] ${
          viewMode === 'reminders'
            ? 'text-red-600 border-red-400'
            : 'text-slate-400 border-transparent hover:text-slate-600'
        }`}
      >
        Reminders
        {remindersByDue.length > 0 && (
          <span className={`num min-w-[20px] px-1.5 py-0.5 rounded-full text-[11px] font-extrabold text-center ${
            remindersNeedingAttentionCount > 0
              ? (viewMode === 'reminders' ? 'bg-red-100 text-red-700' : 'bg-red-50 text-red-500')
              : (viewMode === 'reminders' ? 'bg-slate-200 text-slate-600' : 'bg-slate-100 text-slate-400')
          }`}>{remindersByDue.length}</span>
        )}
      </button>
    </div>
  );
}
