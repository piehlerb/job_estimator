import { ALL_STATUSES } from './useDashboard';
import type { DashboardModel } from './useDashboard';

export default function FilterPanel({ form }: { form: DashboardModel }) {
  const {
    statusFilter,
    probabilityFilter,
    setProbabilityFilter,
    chipBlendFilter,
    setChipBlendFilter,
    selectedTagFilters,
    setSelectedTagFilters,
    tagMatchMode,
    setTagMatchMode,
    availableChipBlends,
    availableTags,
    handleStatusToggle,
    handleTagToggle,
    getStatusColor,
  } = form;

  return (
    <div className="hidden md:block bg-slate-50 border-b border-slate-200 px-6 py-3 space-y-3">
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
          {ALL_STATUSES.map((status) => (
            <button key={status} onClick={() => handleStatusToggle(status)}
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${statusFilter.includes(status) ? getStatusColor(status) : 'bg-white border border-slate-200 text-slate-400'}`}>
              {status}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Prob</span>
          {[0, 20, 40, 60, 80, 100].map(p => (
            <button key={p} onClick={() => setProbabilityFilter(p)}
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${probabilityFilter === p ? 'bg-blue-100 text-blue-800' : 'bg-white border border-slate-200 text-slate-400 hover:bg-slate-100'}`}>
              {p === 0 ? 'Any' : `≥${p}%`}
            </button>
          ))}
        </div>
      </div>
      {availableChipBlends.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide shrink-0">Chip</span>
          <select value={chipBlendFilter} onChange={(e) => setChipBlendFilter(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-gf-lime bg-white">
            <option value="">All Blends</option>
            {availableChipBlends.map((blend) => <option key={blend} value={blend}>{blend}</option>)}
          </select>
        </div>
      )}
      {availableTags.length > 0 && (
        <div className="flex items-start gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide shrink-0 pt-0.5">Tags</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => setTagMatchMode('any')}
              className={`px-2 py-0.5 rounded text-xs font-medium ${tagMatchMode === 'any' ? 'bg-gf-lime/20 text-gf-dark-green' : 'text-slate-400 hover:text-slate-600'}`}>any</button>
            <button onClick={() => setTagMatchMode('all')}
              className={`px-2 py-0.5 rounded text-xs font-medium ${tagMatchMode === 'all' ? 'bg-gf-lime/20 text-gf-dark-green' : 'text-slate-400 hover:text-slate-600'}`}>all</button>
            <span className="text-slate-200">|</span>
            {availableTags.map((tag) => (
              <button key={tag} onClick={() => handleTagToggle(tag)}
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${selectedTagFilters.includes(tag) ? 'bg-indigo-100 text-indigo-800' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                {tag}
              </button>
            ))}
            {selectedTagFilters.length > 0 && (
              <button onClick={() => setSelectedTagFilters([])} className="text-xs text-slate-400 hover:text-slate-600 underline">clear</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
