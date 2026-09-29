import { PhoneCall } from 'lucide-react';
import type { DashboardModel } from './useDashboard';

export default function NeedsContactTab({ form }: { form: DashboardModel }) {
  const {
    needsContactJobs,
    onEditJob,
  } = form;

  return (
    <div className="md:bg-white md:divide-y md:divide-slate-100">
      {needsContactJobs.length === 0 ? (
        <div className="p-12 text-center">
          <PhoneCall size={24} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-500">No pending jobs need contact right now.</p>
        </div>
      ) : (
        <div className="px-3.5 md:px-0 py-2 md:py-0 flex flex-col gap-2 md:gap-0">
          {needsContactJobs.map(({ job, daysSince }) => (
            <button key={job.id} onClick={() => onEditJob(job.id)}
              className="w-full bg-white border border-[#fed7aa] md:border-0 md:border-b md:border-slate-100 rounded-[14px] md:rounded-none px-4 md:px-6 py-3.5 md:py-3 flex items-center gap-3 text-left hover:bg-orange-50/60 active:bg-orange-50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="text-[14.5px] font-bold text-[#0f172a] truncate">{job.name || 'Untitled Job'}</div>
                {job.customerName && <div className="text-xs text-slate-400 mt-0.5">{job.customerName}</div>}
              </div>
              <span className={`num text-[15px] font-extrabold shrink-0 ${daysSince > 60 ? 'text-red-500' : 'text-[#ea580c]'}`}>{daysSince}d</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
