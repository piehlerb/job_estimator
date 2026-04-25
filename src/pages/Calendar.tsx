import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getAllJobs } from '../lib/db';
import { Job, JobStatus, JobReminder } from '../types';
import { useAuth } from '../contexts/AuthContext';

type FilterType = 'All' | 'Won' | 'Verbal' | 'Pending';
type DateMode = 'install' | 'estimate';

interface CalendarProps {
  onEditJob: (id: string) => void;
}

interface ReminderCalendarItem {
  job: Job;
  reminder: JobReminder;
}

export default function Calendar({ onEditJob }: CalendarProps) {
  const { permissions } = useAuth();
  const installOnly = permissions.calendar === 'install';
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filter, setFilter] = useState<FilterType>(installOnly ? 'Won' : 'All');
  const [dateMode, setDateMode] = useState<DateMode>('install');

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const allJobs = await getAllJobs();
      setJobs(allJobs);
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter jobs based on status (All = Won + Verbal + Pending, excludes Lost)
  // Install-only permission forces Won regardless of state.
  const effectiveFilter: FilterType = installOnly ? 'Won' : filter;
  const filteredJobs = jobs.filter((job) => {
    if (effectiveFilter === 'All') {
      return job.status === 'Won' || job.status === 'Verbal' || job.status === 'Pending';
    }
    return job.status === effectiveFilter;
  });

  // Get current month info
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  // Get jobs for a specific date
  const getJobsForDate = (day: number): Job[] => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (dateMode === 'install') {
      return filteredJobs.filter((job) => job.installDate === dateStr);
    } else {
      return filteredJobs.filter((job) => {
        const estimateDate = job.estimateDate || job.createdAt?.slice(0, 10);
        return estimateDate === dateStr;
      });
    }
  };

  const getRemindersForDate = (day: number): ReminderCalendarItem[] => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const items: ReminderCalendarItem[] = [];

    filteredJobs.forEach((job) => {
      (job.reminders || [])
        .filter((reminder) => !reminder.completed && reminder.dueDate === dateStr)
        .forEach((reminder) => {
          items.push({ job, reminder });
        });
    });

    return items.sort((a, b) => new Date(a.reminder.dueAt).getTime() - new Date(b.reminder.dueAt).getTime());
  };

  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Month name
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Days of week headers
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Generate calendar grid
  const calendarDays: (number | null)[] = [];

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }

  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Get status color for job badge
  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case 'Won':
        return 'bg-green-500 text-white border-green-600';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Verbal':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  // Check if a day is today
  const today = new Date();
  const isToday = (day: number) => {
    return day === today.getDate() &&
           month === today.getMonth() &&
           year === today.getFullYear();
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Calendar</h2>
          <p className="text-slate-600 mt-1">View jobs by {dateMode === 'install' ? 'install' : 'estimate'} date</p>
        </div>
      </div>

      {/* Date mode toggle + Filter buttons */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button
            onClick={() => setDateMode('install')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              dateMode === 'install' ? 'bg-gf-lime text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Install Date
          </button>
          <button
            onClick={() => setDateMode('estimate')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-l border-slate-200 ${
              dateMode === 'estimate' ? 'bg-gf-lime text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Estimate Date
          </button>
        </div>
        <div className="w-px h-6 bg-slate-200" />
      </div>

      {/* Filter buttons */}
      {!installOnly && (
      <div className="flex gap-2 mb-6">
        {(['All', 'Won', 'Verbal', 'Pending'] as FilterType[]).map((filterOption) => (
          <button
            key={filterOption}
            onClick={() => setFilter(filterOption)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === filterOption
                ? filterOption === 'Won'
                  ? 'bg-green-600 text-white'
                  : filterOption === 'Pending'
                  ? 'bg-yellow-500 text-white'
                  : filterOption === 'Verbal'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gf-lime text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {filterOption}
          </button>
        ))}
      </div>
      )}

      {/* Calendar navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <button
            onClick={goToPreviousMonth}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-slate-900">{monthName}</h3>
            <button
              onClick={goToToday}
              className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Today
            </button>
          </div>
          <button
            onClick={goToNextMonth}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <p className="text-slate-600">Loading calendar...</p>
          </div>
        ) : (
          <div className="p-4">
            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {daysOfWeek.map((day) => (
                <div
                  key={day}
                  className="text-center text-sm font-semibold text-slate-600 py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} className="min-h-[100px] bg-slate-50 rounded-lg" />;
                }

                const dayJobs = getJobsForDate(day);
                const dayReminders = getRemindersForDate(day);

                return (
                  <div
                    key={day}
                    className={`min-h-[100px] p-2 rounded-lg border ${
                      isToday(day)
                        ? 'border-gf-lime bg-green-50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      isToday(day) ? 'text-gf-dark-green' : 'text-slate-700'
                    }`}>
                      {day}
                    </div>
                    <div className="space-y-1">
                      {dayJobs.map((job) => (
                        <button
                          key={job.id}
                          onClick={() => onEditJob(job.id)}
                          className={`w-full text-left p-1.5 rounded border text-xs transition-colors hover:opacity-80 ${getStatusColor(job.status)}`}
                        >
                          <div className="font-medium truncate">{job.name || 'Untitled Job'}</div>
                        </button>
                      ))}
                      {dateMode === 'install' && dayReminders.map(({ job, reminder }) => (
                        <button
                          key={`${job.id}-${reminder.id}`}
                          onClick={() => onEditJob(job.id)}
                          className="w-full text-left p-1.5 rounded border text-xs transition-colors hover:opacity-80 bg-yellow-100 text-yellow-800 border-yellow-200"
                        >
                          <div className="font-medium truncate">{reminder.subject}</div>
                          <div className="text-[10px] opacity-75 truncate">
                            {reminder.dueTime} - {job.name || 'Untitled Job'}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}