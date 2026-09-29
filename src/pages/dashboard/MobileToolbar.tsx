import { SlidersHorizontal } from 'lucide-react';
import type { DashboardModel } from './useDashboard';

export default function MobileToolbar({ form }: { form: DashboardModel }) {
  const {
    sortBy,
    setSortBy,
    showInactive,
    setShowInactive,
    setShowFilterSheet,
    activeFilterCount,
  } = form;

  return (
    <div className="md:hidden flex items-center gap-2 px-4 py-[11px] bg-[#f8fafc]">
      <button
        onClick={() => setShowFilterSheet(true)}
        className={`flex items-center gap-1.5 px-[13px] py-2 rounded-[10px] border text-[13px] font-bold transition-colors ${
          activeFilterCount > 0
            ? 'bg-gf-lime/10 text-gf-dark-green border-gf-lime/40'
            : 'bg-white text-slate-600 border-slate-200'
        }`}
      >
        <SlidersHorizontal size={14} />
        Filters
        {activeFilterCount > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gf-lime text-white text-[10px] font-bold">{activeFilterCount}</span>
        )}
      </button>
      <button
        onClick={() => setShowInactive(p => !p)}
        className={`px-[13px] py-2 rounded-[10px] border text-[13px] font-bold transition-colors ${
          showInactive ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200'
        }`}
      >
        Inactive
      </button>
      <div className="flex-1" />
      <select
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value as 'date' | 'price' | 'margin')}
        className="px-2.5 py-2 rounded-[10px] border border-slate-200 bg-white text-[13px] font-bold text-slate-600"
      >
        <option value="date">Recent</option>
        <option value="price">Price</option>
        <option value="margin">Margin</option>
      </select>
    </div>
  );
}
