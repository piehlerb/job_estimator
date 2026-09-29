import { Bell, ChevronLeft, ChevronRight, Calendar, Clock, Wrench, FileSearch } from 'lucide-react';
import { localToday, addDaysToLocalDate } from '../../lib/dateUtils';
import type { DashboardModel } from './useDashboard';

export default function TodayTab({ form }: { form: DashboardModel }) {
  const {
    setSelectedDay,
    dayItems,
    dayTotalCount,
    isSelectedDayToday,
    selectedDayLabel,
    getStatusColor,
    onEditJob,
  } = form;

  return (
    <div className="md:bg-white">
      {/* Day navigation */}
      <div className="flex items-center gap-2 px-3.5 md:px-6 py-2.5 bg-white border-b border-slate-200">
        <button
          type="button"
          onClick={() => setSelectedDay(d => addDaysToLocalDate(d, -1))}
          aria-label="Previous day"
          className="flex items-center justify-center w-9 h-9 rounded-[10px] border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          <ChevronLeft size={17} />
        </button>
        <div className="flex-1 text-center min-w-0">
          <div className="text-[14px] font-bold text-slate-900 truncate">
            {isSelectedDayToday ? 'Today' : selectedDayLabel}
          </div>
          {!isSelectedDayToday && (
            <button
              type="button"
              onClick={() => setSelectedDay(localToday())}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
            >
              Back to today
            </button>
          )}
          {isSelectedDayToday && (
            <div className="text-[11px] font-medium text-slate-400">{selectedDayLabel}</div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSelectedDay(d => addDaysToLocalDate(d, 1))}
          aria-label="Next day"
          className="flex items-center justify-center w-9 h-9 rounded-[10px] border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          <ChevronRight size={17} />
        </button>
      </div>
      {dayTotalCount === 0 ? (
        <div className="p-12 text-center">
          <Calendar size={24} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-500">
            Nothing scheduled for {isSelectedDayToday ? 'today' : selectedDayLabel}.
          </p>
        </div>
      ) : (
        <div className="px-3.5 md:px-0 py-3 md:py-0 space-y-3.5 md:space-y-0 md:divide-y md:divide-slate-200">
          {dayItems.installs.length > 0 && (
            <div>
              <div className="text-[11px] font-extrabold text-[#15803d] tracking-[0.5px] uppercase mb-[7px] pl-1 md:hidden">{isSelectedDayToday ? 'Installs Today' : 'Installs'}</div>
              <div className="hidden md:flex items-center gap-2 px-6 py-2 bg-green-50">
                <Wrench size={13} className="text-green-600" />
                <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Installs</span>
                <span className="text-[10px] font-bold text-green-600">({dayItems.installs.length})</span>
              </div>
              <div className="flex flex-col gap-2 md:gap-0 md:divide-y md:divide-slate-100">
                {dayItems.installs.map(({ job, dayNumber, totalDays }) => (
                  <button key={job.id} onClick={() => onEditJob(job.id)}
                    className="w-full bg-white border border-[#bbf7d0] border-l-[3px] border-l-[#22c55e] md:border-0 md:border-b md:border-slate-100 rounded-[13px] md:rounded-none px-[15px] md:px-6 py-[13px] md:py-3 flex items-center gap-3 text-left hover:bg-green-50/60 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-[14.5px] font-bold text-[#0f172a] truncate">{job.name || 'Untitled Job'}</div>
                      {job.customerName && <div className="text-xs text-slate-400 mt-0.5">{job.customerName}</div>}
                    </div>
                    {totalDays > 1 && (
                      <span className="text-xs font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded shrink-0">Day {dayNumber}/{totalDays}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          {dayItems.estimates.length > 0 && (
            <div>
              <div className="text-[11px] font-extrabold text-purple-700 tracking-[0.5px] uppercase mb-[7px] pl-1 md:hidden">{isSelectedDayToday ? 'Estimates Today' : 'Estimates'}</div>
              <div className="hidden md:flex items-center gap-2 px-6 py-2 bg-purple-50">
                <FileSearch size={13} className="text-purple-600" />
                <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Estimates</span>
                <span className="text-[10px] font-bold text-purple-600">({dayItems.estimates.length})</span>
              </div>
              <div className="flex flex-col gap-2 md:gap-0 md:divide-y md:divide-slate-100">
                {dayItems.estimates.map(({ job }) => (
                  <button key={job.id} onClick={() => onEditJob(job.id)}
                    className="w-full bg-white border border-slate-200 md:border-0 md:border-b md:border-slate-100 rounded-[13px] md:rounded-none px-[15px] md:px-6 py-[13px] md:py-3 flex items-center gap-3 text-left hover:bg-purple-50/60 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-[14.5px] font-bold text-[#0f172a] truncate">{job.name || 'Untitled Job'}</div>
                      {job.customerName && <div className="text-xs text-slate-400 mt-0.5">{job.customerName}</div>}
                    </div>
                    <span className={`shrink-0 px-[9px] py-[3px] rounded-full text-[11px] font-extrabold ${getStatusColor(job.status)}`}>{job.status}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {dayItems.reminders.length > 0 && (
            <div>
              <div className="text-[11px] font-extrabold text-[#1d4ed8] tracking-[0.5px] uppercase mb-[7px] pl-1 md:hidden">{isSelectedDayToday ? 'Reminders Today' : 'Reminders'}</div>
              <div className="hidden md:flex items-center gap-2 px-6 py-2 bg-blue-50">
                <Bell size={13} className="text-blue-600" />
                <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Reminders</span>
                <span className="text-[10px] font-bold text-blue-600">({dayItems.reminders.length})</span>
              </div>
              <div className="flex flex-col gap-2 md:gap-0 md:divide-y md:divide-slate-100">
                {dayItems.reminders.map(({ job, reminder }) => (
                  <button key={reminder.id} onClick={() => onEditJob(job.id)}
                    className="w-full bg-white border border-[#bfdbfe] border-l-[3px] border-l-[#3b82f6] md:border-0 md:border-b md:border-slate-100 rounded-[13px] md:rounded-none px-[15px] md:px-6 py-[13px] md:py-3 flex items-center gap-3 text-left hover:bg-blue-50/60 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-[14.5px] font-bold text-[#0f172a] truncate">{reminder.subject}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{job.name || 'Untitled Job'}{job.customerName ? ` · ${job.customerName}` : ''}</div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-blue-600 shrink-0">
                      <Clock size={11} />
                      <span>{reminder.dueTime}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
