import { ArrowLeft, X, Link, Shuffle } from 'lucide-react';
import type { JobFormModel } from './useJobForm';

export default function GroupEstimateModal({ form }: { form: JobFormModel }) {
  const {
    ungroupedJobs,
    setShowGroupModal,
    groupModalType,
    creatingGroupJob,
    modalView,
    setModalView,
    existingJobSearch,
    setExistingJobSearch,
    handleCreateGroupEstimate,
    handleAddExistingJobToGroup,
  } = form;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            {modalView === 'existing-search' && (
              <button
                type="button"
                onClick={() => { setModalView('options'); setExistingJobSearch(''); }}
                className="p-1 text-slate-400 hover:text-slate-600 mr-1"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            {groupModalType === 'bundled' ? <Link size={18} className="text-blue-600" /> : <Shuffle size={18} className="text-purple-600" />}
            <h2 className="text-lg font-semibold text-slate-900">
              {modalView === 'existing-search'
                ? 'Select an Existing Estimate'
                : groupModalType === 'bundled' ? 'Add Bundle Part' : 'Add Alternative Estimate'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => { setShowGroupModal(false); setModalView('options'); setExistingJobSearch(''); }}
            className="p-1 text-slate-400 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5">
          {modalView === 'options' ? (
            <>
              <p className="text-sm text-slate-600 mb-4">
                {groupModalType === 'bundled'
                  ? 'Add another estimate to this bundle. Each part has a separate system, footage, and pricing. Aggregate totals are shown together.'
                  : 'Add an alternative estimate for the same customer. Each option has its own system, pricing, and specs for the customer to choose from.'}
              </p>
              <p className="text-sm font-semibold text-slate-700 mb-3">How should the new estimate start?</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  disabled={creatingGroupJob}
                  onClick={() => handleCreateGroupEstimate(true)}
                  className="flex flex-col items-center gap-1.5 p-4 border-2 border-slate-200 rounded-xl hover:border-gf-lime hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-2xl">📋</span>
                  <span className="font-semibold text-slate-800 text-sm">Copy This Job</span>
                  <span className="text-xs text-slate-500 text-center">Same settings, edit what's different</span>
                </button>
                <button
                  type="button"
                  disabled={creatingGroupJob}
                  onClick={() => handleCreateGroupEstimate(false)}
                  className="flex flex-col items-center gap-1.5 p-4 border-2 border-slate-200 rounded-xl hover:border-gf-lime hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-2xl">✨</span>
                  <span className="font-semibold text-slate-800 text-sm">Start Blank</span>
                  <span className="text-xs text-slate-500 text-center">Customer info carried over only</span>
                </button>
                <button
                  type="button"
                  disabled={creatingGroupJob || ungroupedJobs.length === 0}
                  onClick={() => setModalView('existing-search')}
                  className="flex flex-col items-center gap-1.5 p-4 border-2 border-slate-200 rounded-xl hover:border-gf-lime hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={ungroupedJobs.length === 0 ? 'No other ungrouped estimates available' : undefined}
                >
                  <span className="text-2xl">🔍</span>
                  <span className="font-semibold text-slate-800 text-sm">Use Existing</span>
                  <span className="text-xs text-slate-500 text-center">
                    {ungroupedJobs.length === 0 ? 'No ungrouped estimates' : 'Add an estimate you already made'}
                  </span>
                </button>
              </div>
              {creatingGroupJob && (
                <p className="text-xs text-center text-slate-500 mt-3">Creating estimate...</p>
              )}
            </>
          ) : (
            <>
              <input
                type="text"
                placeholder="Search by job name or customer..."
                value={existingJobSearch}
                onChange={(e) => setExistingJobSearch(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent mb-3"
                autoFocus
              />
              <div className="max-h-64 overflow-y-auto space-y-1">
                {ungroupedJobs
                  .filter(j => {
                    const q = existingJobSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (j.name || '').toLowerCase().includes(q) || (j.customerName || '').toLowerCase().includes(q);
                  })
                  .slice(0, 8)
                  .map(j => (
                    <button
                      key={j.id}
                      type="button"
                      disabled={creatingGroupJob}
                      onClick={() => handleAddExistingJobToGroup(j)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-slate-200 hover:border-gf-lime hover:bg-green-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{j.name || 'Untitled Job'}</p>
                        {j.customerName && <p className="text-xs text-slate-500 truncate">{j.customerName}</p>}
                      </div>
                      <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                        j.status === 'Won' ? 'bg-green-100 text-green-800' :
                        j.status === 'Lost' ? 'bg-red-100 text-red-800' :
                        j.status === 'Verbal' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {j.status}
                      </span>
                    </button>
                  ))}
                {ungroupedJobs.filter(j => {
                  const q = existingJobSearch.trim().toLowerCase();
                  if (!q) return true;
                  return (j.name || '').toLowerCase().includes(q) || (j.customerName || '').toLowerCase().includes(q);
                }).length === 0 && (
                  <p className="text-sm text-slate-500 italic text-center py-4">No matching estimates found.</p>
                )}
              </div>
              {creatingGroupJob && (
                <p className="text-xs text-center text-slate-500 mt-3">Adding estimate...</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
