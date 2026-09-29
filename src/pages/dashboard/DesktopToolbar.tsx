import { Search, Bell, X, SlidersHorizontal } from 'lucide-react';
import type { DashboardModel } from './useDashboard';

export default function DesktopToolbar({ form }: { form: DashboardModel }) {
  const {
    sortBy,
    setSortBy,
    searchQuery,
    setSearchQuery,
    viewMode,
    showFilters,
    setShowFilters,
    showInactive,
    setShowInactive,
    setShowReminders,
    handleClearFilters,
    remindersNeedingAttentionCount,
    activeFilterCount,
    isFiltered,
  } = form;

  return (
    <div className="hidden md:flex items-center gap-2 px-6 py-2 bg-white border-b border-slate-200">
      <div className="relative flex-1">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-7 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gf-lime"
        />
      </div>
      {viewMode === 'jobs' && (
        <>
          <button
            onClick={() => setShowFilters(p => !p)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0 ${
              showFilters || activeFilterCount > 0
                ? 'bg-gf-lime/10 text-gf-dark-green border border-gf-lime/40'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <SlidersHorizontal size={13} />
            Filters
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gf-lime text-white text-[10px] font-bold">{activeFilterCount}</span>
            )}
          </button>
          <button
            onClick={() => setShowInactive(p => !p)}
            title="Show inactive jobs (Lost + past Won)"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0 ${
              showInactive ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Inactive
          </button>
          {isFiltered && (
            <button onClick={handleClearFilters} title="Clear all filters"
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 transition-colors shrink-0">
              <X size={12} />
              Clear
            </button>
          )}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'price' | 'margin')}
            className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gf-lime shrink-0"
          >
            <option value="date">Recent</option>
            <option value="price">Price ↓</option>
            <option value="margin">Margin ↓</option>
          </select>
        </>
      )}
      <button
        type="button"
        onClick={() => setShowReminders((prev) => !prev)}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0 ${
          remindersNeedingAttentionCount > 0
            ? 'bg-red-100 text-red-700 hover:bg-red-200'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
      >
        <Bell size={13} />
        {remindersNeedingAttentionCount > 0 && <span className="font-bold">{remindersNeedingAttentionCount}</span>}
      </button>
    </div>
  );
}
