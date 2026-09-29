import { ChevronDown, Link, Shuffle } from 'lucide-react';
import type { DashboardModel } from './useDashboard';

export default function JobCardList({ form }: { form: DashboardModel }) {
  const {
    starButton,
    expandedGroups,
    displayItems,
    toggleGroup,
    getStatusColor,
    getMarginColor,
    onEditJob,
  } = form;

  return (
    <div className="md:hidden px-3.5 py-2.5 pb-[120px] flex flex-col gap-2.5">
      {displayItems.map((item) => {
        if (item.type === 'group') {
          const isExpanded = expandedGroups.has(item.groupId);
          const isBundled = item.groupType === 'bundled';
          const aggMarginPct = item.aggregateTotalPrice > 0 ? ((item.aggregateTotalPrice - item.aggregateTotalCosts) / item.aggregateTotalPrice) * 100 : 0;
          return (
            <div key={item.groupId} className={`${isBundled ? 'bg-[#eff6ff]' : 'bg-[#faf5ff]'} border ${isBundled ? 'border-[#bfdbfe]' : 'border-[#e9d5ff]'} rounded-[16px] overflow-hidden`}>
              <div onClick={() => toggleGroup(item.groupId)}
                className="flex items-center gap-[9px] px-4 py-[13px] cursor-pointer">
                {isBundled
                  ? <Link size={16} className="text-blue-500 shrink-0" />
                  : <Shuffle size={16} className="text-purple-600 shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[15px] text-[#0f172a] truncate">{item.customerName}</div>
                  <div className={`text-xs font-semibold mt-0.5 ${isBundled ? 'text-blue-600' : 'text-[#9333ea]'}`}>
                    {isBundled ? `${item.jobs.length} bundled parts` : `${item.jobs.length} alternative estimates`}
                  </div>
                </div>
                {isBundled && <span className={`num text-xs font-extrabold ${getMarginColor(aggMarginPct)}`}>{aggMarginPct.toFixed(0)}%</span>}
                <ChevronDown size={18} className={`text-purple-300 shrink-0 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
              </div>
              {isExpanded && (
                <div className="px-3 pb-3 flex flex-col gap-2">
                  {item.jobs.map(({ job, calc }) => {
                    const marginPct = job.totalPrice > 0 ? ((job.totalPrice - calc.totalCosts) / job.totalPrice) * 100 : 0;
                    return (
                      <div key={job.id} onClick={() => onEditJob(job.id)}
                        className={`bg-white border ${isBundled ? 'border-[#bfdbfe] border-l-[3px] border-l-[#60a5fa]' : 'border-[#e9d5ff] border-l-[3px] border-l-[#c084fc]'} rounded-[11px] px-[13px] py-3 cursor-pointer flex items-center justify-between gap-2`}>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-sm text-[#0f172a] truncate">{job.name || 'Untitled Job'}</div>
                          <div className={`num text-xs font-bold mt-0.5 ${getMarginColor(marginPct)}`}>{marginPct.toFixed(0)}% margin</div>
                        </div>
                        {starButton(job)}
                        <span className="num text-[17px] font-extrabold text-[#0f172a] shrink-0">${job.totalPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        const { job, calc } = item.jobWithCalc;
        const marginPct = job.totalPrice > 0 ? ((job.totalPrice - calc.totalCosts) / job.totalPrice) * 100 : 0;
        const metaParts: string[] = [];
        if (job.customerName) metaParts.push(job.customerName);
        if (job.estimateDate) {
          const [y, m, d] = job.estimateDate.split('-').map(Number);
          if (y && m && d) metaParts.push(new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        }
        if (job.floorFootage) metaParts.push(`${job.floorFootage} ft²`);

        return (
          <div key={job.id} onClick={() => onEditJob(job.id)}
            className="bg-white border border-slate-200 rounded-[16px] px-4 py-3.5 cursor-pointer shadow-[0_1px_2px_rgba(15,23,42,0.04)] active:bg-slate-50 transition-colors">
            <div className="flex items-start justify-between gap-2.5">
              <div className="min-w-0 flex-1">
                <span className="font-bold text-[15.5px] text-[#0f172a] truncate block">{job.name || 'Untitled Job'}</span>
                {metaParts.length > 0 && (
                  <div className="text-[12.5px] text-slate-400 mt-[3px] truncate">{metaParts.join(' · ')}</div>
                )}
              </div>
              {starButton(job)}
              <span className={`shrink-0 px-[9px] py-[3px] rounded-full text-[11px] font-extrabold ${getStatusColor(job.status)}`}>
                {job.status}
              </span>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#f1f5f9]">
              <div className="flex gap-[5px] flex-wrap">
                {(job.tags || []).slice(0, 3).map((tag) => (
                  <span key={tag} className="text-[11px] font-semibold text-slate-500 bg-[#f1f5f9] px-2 py-[3px] rounded-[6px]">{tag}</span>
                ))}
              </div>
              <div className="flex items-baseline gap-2.5 shrink-0">
                <span className={`num text-[12.5px] font-extrabold ${getMarginColor(marginPct)}`}>{marginPct.toFixed(0)}%</span>
                <span className="num text-[20px] font-extrabold text-[#0f172a] tracking-tight">${job.totalPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
