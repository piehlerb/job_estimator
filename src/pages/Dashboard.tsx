import { Plus, Search, ChevronDown } from 'lucide-react';
import { Star } from 'lucide-react';
import { JobStatus } from '../types';
import { useDashboard, DashboardProps } from './dashboard/useDashboard';
import RemindersListModal from './dashboard/RemindersListModal';
import NextReminderModal from './dashboard/NextReminderModal';
import ReminderDetailsModal from './dashboard/ReminderDetailsModal';
import MissingRemindersModal from './dashboard/MissingRemindersModal';
import NeedsContactTab from './dashboard/NeedsContactTab';
import TodayTab from './dashboard/TodayTab';
import RemindersTab from './dashboard/RemindersTab';
import JobCardList from './dashboard/JobCardList';
import JobTable from './dashboard/JobTable';
import OverdueRemindersBanner from './dashboard/OverdueRemindersBanner';
import FilterPanel from './dashboard/FilterPanel';
import MobileFilterSheet from './dashboard/MobileFilterSheet';
import DesktopToolbar from './dashboard/DesktopToolbar';
import MobileToolbar from './dashboard/MobileToolbar';
import TabBar from './dashboard/TabBar';

export default function Dashboard(props: DashboardProps) {
  const form = useDashboard(props);
  const {
    canWriteJobs,
    isReadOnlyJobs,
    jobsWithCalc,
    loading,
    hotJobsExpanded,
    setHotJobsExpanded,
    starError,
    hotJobs,
    starButton,
    searchQuery,
    setSearchQuery,
    viewMode,
    showFilters,
    showReminders,
    selectedReminder,
    checkingMissingReminders,
    showMissingRemindersModal,
    nextReminderFor,
    showFilterSheet,
    loadingOlderJobs,
    hasMoreOlderJobs,
    olderJobsMessage,
    handleLoadOlderJobs,
    filteredAndSortedJobs,
    overdueReminders,
    selectedReminderDetails,
    handleFindMissingReminders,
    onNewJob,
    onEditJob,
    onViewJobSheet,
  } = form;


  // Simplified read-only view for members without write access to jobs.
  // Shows just job name, status, install date, and customer address.
  if (isReadOnlyJobs) {
    const readOnlyJobs = [...jobsWithCalc]
      .filter(({ job }) => job.status === 'Won' || job.status === 'Verbal' || job.status === 'Pending')
      .sort((a, b) => {
        const aDate = a.job.installDate || '';
        const bDate = b.job.installDate || '';
        if (aDate && bDate) return aDate.localeCompare(bDate);
        if (aDate) return -1;
        if (bDate) return 1;
        return 0;
      });

    const formatInstallDate = (d?: string) => {
      if (!d) return '—';
      const [y, m, day] = d.split('-').map(Number);
      if (!y || !m || !day) return d;
      return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const statusBadge = (status: JobStatus) => {
      const cls =
        status === 'Won' ? 'bg-green-100 text-green-800 border-green-200'
        : status === 'Verbal' ? 'bg-blue-100 text-blue-800 border-blue-200'
        : status === 'Pending' ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
        : 'bg-slate-100 text-slate-700 border-slate-200';
      return <span className={`inline-flex items-center text-xs font-medium rounded-full border px-2 py-0.5 ${cls}`}>{status}</span>;
    };

    return (
      <div className="max-w-7xl mx-auto p-3 sm:p-6">
        <div className="flex items-baseline gap-2.5 mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">Dashboard</h2>
          <span className="text-xs text-slate-400">{readOnlyJobs.length}</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading jobs...</div>
        ) : readOnlyJobs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No jobs to display.</div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Job Name</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Install Date</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Customer Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {readOnlyJobs.map(({ job }) => (
                  <tr
                    key={job.id}
                    onClick={() => onViewJobSheet(job.id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">{job.name || 'Untitled Job'}</td>
                    <td className="px-4 py-3">{statusBadge(job.status)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatInstallDate(job.installDate)}</td>
                    <td className="px-4 py-3 text-slate-600">{job.customerAddress || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Mobile dark search bar — visually extends the Layout header */}
      <div className="md:hidden bg-[#0a0a0a] px-4 pb-3">
        <div className="text-[11px] text-slate-400 mb-2">{filteredAndSortedJobs.length} active jobs</div>
        <div className="relative">
          <Search size={16} className="absolute left-[13px] top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search jobs or customers"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white rounded-[11px] py-[11px] pl-[38px] pr-3.5 text-[15px] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-gf-lime"
          />
        </div>
      </div>

      {/* Sticky tabs + toolbar */}
      <div className="sticky top-0 z-10">
        <section aria-labelledby="hot-jobs-heading" className="border-b border-amber-200 bg-amber-50 px-4 md:px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="hot-jobs-heading" className="flex items-center gap-2 text-sm font-bold text-amber-950">
              <Star size={17} className="text-amber-600" fill="currentColor" /> Hot jobs
              <span className="rounded-full bg-amber-200/60 px-2 py-0.5 text-xs">{hotJobs.length}</span>
            </h2>
            <span className="hidden md:block text-xs text-amber-800">Your team's priority list</span>
            <button type="button" aria-expanded={hotJobsExpanded} aria-controls="hot-jobs-list"
              onClick={() => {
                const expanded = !hotJobsExpanded;
                setHotJobsExpanded(expanded);
                try { localStorage.setItem('dashboard_hot_jobs_expanded_v1', String(expanded)); } catch { /* Storage may be unavailable. */ }
              }} className="md:hidden flex items-center gap-1 min-h-11 px-2 text-xs font-semibold text-amber-900">
              {hotJobsExpanded ? 'Hide' : 'Show'}
              <ChevronDown size={16} className={hotJobsExpanded ? 'rotate-180' : ''} />
            </button>
          </div>
          {starError && <p role="alert" className="text-sm text-red-700 mt-2">{starError}</p>}
          <div id="hot-jobs-list" className={`${hotJobsExpanded ? 'block' : 'hidden'} md:block mt-2`}>
            {hotJobs.length === 0 ? (
              <p className="text-xs text-amber-800">{loading ? 'Loading hot jobs…' : 'Star a job below to keep it here, across all dashboard views.'}</p>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {hotJobs.map(({ job }) => (
                  <li key={job.id} className="flex items-center gap-1 rounded-lg border border-amber-200 bg-white pl-3 pr-1">
                    <button type="button" onClick={() => onEditJob(job.id)} className="min-w-0 flex-1 py-2 text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
                      <span className="block truncate text-sm font-bold text-slate-900">{job.name || 'Untitled Job'}</span>
                      <span className="block truncate text-xs text-slate-500">{job.customerName || 'No customer'} · {job.status} · ${job.totalPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                    </button>
                    {starButton(job)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        {/* Desktop header row */}
        <div className="hidden md:flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200">
          <div className="flex items-baseline gap-2.5">
            <h2 className="text-xl font-bold text-slate-900">Dashboard</h2>
            <span className="text-xs text-slate-400">{filteredAndSortedJobs.length}/{jobsWithCalc.length}</span>
          </div>
          {canWriteJobs && (
            <button onClick={onNewJob} className="flex items-center gap-1.5 px-3 py-1.5 bg-gf-lime text-white rounded-lg font-semibold hover:bg-gf-dark-green transition-colors text-sm">
              <Plus size={15} />
              New Job
            </button>
          )}
        </div>

        {/* Tab bar */}
        <TabBar form={form} />

        {/* Find missing reminders button */}
        {viewMode === 'reminders' && (
          <div className="flex items-center justify-end px-4 md:px-6 py-2 bg-white border-b border-slate-100">
            <button
              type="button"
              onClick={handleFindMissingReminders}
              disabled={checkingMissingReminders}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-gf-dark-green bg-white border border-slate-200 rounded-lg hover:border-gf-lime hover:bg-green-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Search size={14} />
              {checkingMissingReminders ? 'Checking...' : 'Find Missing'}
            </button>
          </div>
        )}

        {/* Mobile toolbar (Jobs tab only) */}
        {viewMode === 'jobs' && (
          <MobileToolbar form={form} />
        )}

        {/* Desktop toolbar */}
        {viewMode !== 'today' && viewMode !== 'reminders' && (
          <DesktopToolbar form={form} />
        )}
      </div>

      {/* Desktop inline filter panel */}
      {showFilters && (
        <FilterPanel form={form} />
      )}

      {/* Overdue reminders banner */}
      {viewMode === 'reminders' && overdueReminders.length > 0 && (
        <OverdueRemindersBanner form={form} />
      )}

      {/* =========== TAB CONTENT =========== */}

      {/* Needs Contact tab */}
      {viewMode === 'needs-contact' && (
        <NeedsContactTab form={form} />
      )}

      {/* Today tab */}
      {viewMode === 'today' && (
        <TodayTab form={form} />
      )}

      {/* Reminders tab */}
      {viewMode === 'reminders' && (
        <RemindersTab form={form} />
      )}

      {/* Jobs tab content */}
      {viewMode !== 'jobs' ? null : loading ? (
        <div className="p-12 text-center text-sm text-slate-500">Loading jobs...</div>
      ) : filteredAndSortedJobs.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-sm text-slate-500 mb-4">
            {jobsWithCalc.length === 0 ? "No jobs yet. Create your first job to get started!" : "No jobs match the current filters."}
          </p>
          {jobsWithCalc.length === 0 && canWriteJobs && (
            <button onClick={onNewJob} className="inline-flex items-center gap-2 px-4 py-2 bg-gf-lime text-white rounded-lg font-semibold hover:bg-gf-dark-green transition-colors text-sm">
              <Plus size={16} /> Create Job
            </button>
          )}
          {(hasMoreOlderJobs || olderJobsMessage) && (
            <div className="mt-3 flex flex-col items-center gap-2">
              {hasMoreOlderJobs && (
                <button
                  type="button"
                  onClick={handleLoadOlderJobs}
                  disabled={loadingOlderJobs}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loadingOlderJobs ? 'Loading...' : 'Load Older Jobs'}
                </button>
              )}
              {olderJobsMessage && (
                <p className="text-xs text-slate-500 text-center">{olderJobsMessage}</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <JobCardList form={form} />

          {/* Desktop table */}
          <JobTable form={form} />
          {(hasMoreOlderJobs || olderJobsMessage) && (
            <div className="border-t border-slate-200 bg-slate-50 px-3 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-center gap-2">
              {hasMoreOlderJobs && (
                <button
                  type="button"
                  onClick={handleLoadOlderJobs}
                  disabled={loadingOlderJobs}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loadingOlderJobs ? 'Loading...' : 'Load Older Jobs'}
                </button>
              )}
              {olderJobsMessage && (
                <p className="text-xs text-slate-500 text-center">{olderJobsMessage}</p>
              )}
            </div>
          )}
        </>
      )}

      {/* Mobile FAB */}
      {canWriteJobs && viewMode === 'jobs' && (
        <div className="md:hidden sticky bottom-[22px] z-[18] flex justify-end px-5 pointer-events-none -mt-[78px]">
          <button onClick={onNewJob}
            className="pointer-events-auto flex items-center gap-2 px-[22px] py-[15px] rounded-full bg-gradient-to-r from-gf-lime to-gf-dark-green text-white text-[15px] font-extrabold shadow-lg shadow-gf-lime/25 active:scale-95 transition-transform">
            <Plus size={20} strokeWidth={2.6} />
            New Job
          </button>
        </div>
      )}

      {/* Mobile filter bottom sheet */}
      {showFilterSheet && (
        <MobileFilterSheet form={form} />
      )}

      {/* Reminder modals (unchanged) */}
      {showReminders && (
        <RemindersListModal form={form} />
      )}

      {nextReminderFor && (
        <NextReminderModal form={form} />
      )}

      {selectedReminder && selectedReminderDetails && (
        <ReminderDetailsModal form={form} />
      )}
      {showMissingRemindersModal && (
        <MissingRemindersModal form={form} />
      )}
    </div>
  );
}
