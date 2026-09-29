import { ALL_STATUSES } from './useDashboard';
import type { DashboardModel } from './useDashboard';

export default function MobileFilterSheet({ form }: { form: DashboardModel }) {
  const {
    statusFilter,
    probabilityFilter,
    setProbabilityFilter,
    setShowFilterSheet,
    handleStatusToggle,
    handleClearFilters,
    getStatusColor,
  } = form;

  return (
    <>
      <div className="md:hidden fixed inset-0 z-40 bg-slate-900/45" onClick={() => setShowFilterSheet(false)} />
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[41] bg-white rounded-t-[22px] px-5 pt-[18px] pb-7 animate-sheet-up">
        <div className="w-[38px] h-1 bg-slate-300 rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between mb-4">
          <span className="font-heading font-extrabold text-[18px]">Filters</span>
          <button onClick={() => { handleClearFilters(); setShowFilterSheet(false); }}
            className="text-[13px] font-bold text-red-600">Clear all</button>
        </div>
        <div className="text-[11px] font-extrabold text-slate-400 tracking-[0.5px] uppercase mb-2">Status</div>
        <div className="flex gap-[7px] flex-wrap mb-[18px]">
          {ALL_STATUSES.map((status) => (
            <button key={status} onClick={() => handleStatusToggle(status)}
              className={`px-[15px] py-2 rounded-full border text-[13px] font-bold transition-colors ${
                statusFilter.includes(status) ? getStatusColor(status) + ' border-transparent' : 'bg-white border-slate-200 text-slate-400'
              }`}>
              {status}
            </button>
          ))}
        </div>
        <div className="text-[11px] font-extrabold text-slate-400 tracking-[0.5px] uppercase mb-2">Min Probability</div>
        <div className="flex gap-[7px] flex-wrap mb-[22px]">
          {[0, 20, 40, 60, 80, 100].map(p => (
            <button key={p} onClick={() => setProbabilityFilter(p)}
              className={`px-[15px] py-2 rounded-full border text-[13px] font-bold transition-colors ${
                probabilityFilter === p ? 'bg-blue-100 text-blue-800 border-transparent' : 'bg-white border-slate-200 text-slate-400'
              }`}>
              {p === 0 ? 'Any' : `≥${p}%`}
            </button>
          ))}
        </div>
        <button onClick={() => setShowFilterSheet(false)}
          className="w-full py-[15px] rounded-[13px] bg-gradient-to-r from-gf-lime to-gf-dark-green text-white text-[15px] font-extrabold">
          Show results
        </button>
      </div>
    </>
  );
}
