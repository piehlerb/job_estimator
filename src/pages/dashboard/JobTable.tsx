import { Trash2, FileText, ChevronDown, ChevronRight, Link, Shuffle } from 'lucide-react';
import type { DashboardModel } from './useDashboard';

export default function JobTable({ form }: { form: DashboardModel }) {
  const {
    canWriteJobs,
    starButton,
    expandedGroups,
    handleDeleteJob,
    displayItems,
    toggleGroup,
    getStatusColor,
    onEditJob,
    onViewJobSheet,
  } = form;

  return (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-4 lg:px-6 py-3 text-left text-sm font-semibold text-slate-700">Job Name</th>
            <th className="px-4 lg:px-6 py-3 text-center text-sm font-semibold text-slate-700">Status</th>
            <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Total Cost</th>
            <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Total Price</th>
            <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Actual Margin</th>
            <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Date</th>
            <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Action</th>
          </tr>
        </thead>
        <tbody>
          {displayItems.map((item) => {
            if (item.type === 'group') {
              const isExpanded = expandedGroups.has(item.groupId);
              const isBundled = item.groupType === 'bundled';
              const aggMarginPct = item.aggregateTotalPrice > 0 ? ((item.aggregateTotalPrice - item.aggregateTotalCosts) / item.aggregateTotalPrice) * 100 : 0;
              return (
                <>
                  <tr key={`group-${item.groupId}`}
                    className={`border-b border-slate-200 cursor-pointer transition-colors ${isBundled ? 'bg-blue-50 hover:bg-blue-100' : 'bg-purple-50 hover:bg-purple-100'}`}
                    onClick={() => toggleGroup(item.groupId)}>
                    <td className="px-4 lg:px-6 py-3 text-sm font-semibold text-slate-900" colSpan={isBundled ? 1 : 5}>
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown size={14} className="text-slate-500 shrink-0" /> : <ChevronRight size={14} className="text-slate-500 shrink-0" />}
                        {isBundled ? <Link size={13} className="text-blue-600 shrink-0" /> : <Shuffle size={13} className="text-purple-600 shrink-0" />}
                        <span>{item.customerName}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isBundled ? 'bg-blue-200 text-blue-800' : 'bg-purple-200 text-purple-800'}`}>
                          {isBundled ? `Bundle · ${item.jobs.length} parts` : `${item.jobs.length} Alternatives`}
                        </span>
                      </div>
                    </td>
                    {isBundled && (
                      <>
                        <td className="px-4 lg:px-6 py-3 text-sm text-center text-slate-400">—</td>
                        <td className="px-4 lg:px-6 py-3 text-sm text-right text-slate-700 font-medium">${item.aggregateTotalCosts.toFixed(0)}</td>
                        <td className="px-4 lg:px-6 py-3 text-sm text-right font-semibold text-slate-900">${item.aggregateTotalPrice.toFixed(0)}</td>
                        <td className={`px-4 lg:px-6 py-3 text-sm text-right font-bold ${aggMarginPct >= 30 ? 'text-green-600' : 'text-orange-600'}`}>{aggMarginPct.toFixed(0)}%</td>
                        <td className="px-4 lg:px-6 py-3 text-sm text-right text-slate-400">—</td>
                        <td className="px-4 lg:px-6 py-3 text-sm text-right text-slate-400">—</td>
                      </>
                    )}
                  </tr>
                  {isExpanded && item.jobs.map(({ job, calc }) => {
                    const marginPct = job.totalPrice > 0 ? ((job.totalPrice - calc.totalCosts) / job.totalPrice) * 100 : 0;
                    return (
                      <tr key={job.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => onEditJob(job.id)}>
                        <td className="py-3 text-sm font-medium text-slate-900">
                          <div className="flex items-center">
                            <div className={`w-1 self-stretch mr-3 rounded-r ${isBundled ? 'bg-blue-300' : 'bg-purple-300'}`} style={{minHeight: '100%'}} />
                            <div className="px-2 lg:px-3">
                              <div>{job.name || 'Untitled Job'}</div>
                              {(job.tags || []).length > 0 && (
                                <div className="mt-0.5 flex flex-wrap gap-1">
                                  {(job.tags || []).slice(0, 3).map((tag) => (
                                    <span key={tag} className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">{tag}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 lg:px-6 py-3 text-sm text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>{job.status}</span>
                        </td>
                        <td className="px-4 lg:px-6 py-3 text-sm text-slate-600 text-right">${calc.totalCosts.toFixed(0)}</td>
                        <td className="px-4 lg:px-6 py-3 text-sm font-semibold text-slate-900 text-right">${job.totalPrice.toFixed(0)}</td>
                        <td className={`px-4 lg:px-6 py-3 text-sm font-semibold text-right ${marginPct >= 30 ? 'text-green-600' : 'text-orange-600'}`}>{marginPct.toFixed(0)}%</td>
                        <td className="px-4 lg:px-6 py-3 text-sm text-slate-600 text-right">{new Date(job.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 lg:px-6 py-3 text-sm text-right">
                          <div className="flex items-center justify-end gap-2">
                            {starButton(job)}
                    <button onClick={(e) => { e.stopPropagation(); onViewJobSheet(job.id); }} className="text-green-600 hover:text-green-800" title="Job Sheet"><FileText size={18} /></button>
                            <button className="text-gf-dark-green font-medium text-xs lg:text-sm">Edit</button>
                            {canWriteJobs && (<button onClick={(e) => { e.stopPropagation(); handleDeleteJob(job.id); }} className="text-red-600 hover:text-red-800"><Trash2 size={18} /></button>)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </>
              );
            }

            const { job, calc } = item.jobWithCalc;
            const marginPct = job.totalPrice > 0 ? ((job.totalPrice - calc.totalCosts) / job.totalPrice) * 100 : 0;
            return (
              <tr key={job.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => onEditJob(job.id)}>
                <td className="px-4 lg:px-6 py-4 text-sm font-medium text-slate-900">
                  <div>{job.name || 'Untitled Job'}</div>
                  {(job.tags || []).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(job.tags || []).slice(0, 3).map((tag) => (
                        <span key={tag} className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">{tag}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 lg:px-6 py-4 text-sm text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>{job.status}</span>
                </td>
                <td className="px-4 lg:px-6 py-4 text-sm text-slate-600 text-right">${calc.totalCosts.toFixed(0)}</td>
                <td className="px-4 lg:px-6 py-4 text-sm font-semibold text-slate-900 text-right">${job.totalPrice.toFixed(0)}</td>
                <td className={`px-4 lg:px-6 py-4 text-sm font-semibold text-right ${marginPct >= 30 ? 'text-green-600' : 'text-orange-600'}`}>{marginPct.toFixed(0)}%</td>
                <td className="px-4 lg:px-6 py-4 text-sm text-slate-600 text-right">{new Date(job.createdAt).toLocaleDateString()}</td>
                <td className="px-4 lg:px-6 py-4 text-sm text-right">
                  <div className="flex items-center justify-end gap-2">
                    {starButton(job)}
                    <button onClick={(e) => { e.stopPropagation(); onViewJobSheet(job.id); }} className="text-green-600 hover:text-green-800" title="Job Sheet"><FileText size={18} /></button>
                    <button className="text-gf-dark-green font-medium text-xs lg:text-sm">Edit</button>
                    {canWriteJobs && (<button onClick={(e) => { e.stopPropagation(); handleDeleteJob(job.id); }} className="text-red-600 hover:text-red-800"><Trash2 size={18} /></button>)}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
