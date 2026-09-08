import { Star } from 'lucide-react';
import type { Job } from '../types';
import { isHotJob } from '../lib/hotJobs';

export default function JobStarButton({ job, disabled, onToggle }: {
  job: Job;
  disabled?: boolean;
  onToggle: (job: Job) => void;
}) {
  const hot = isHotJob(job);
  const label = `${hot ? 'Unstar' : 'Star'} ${job.name || 'Untitled Job'}`;
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={hot} disabled={disabled}
      onClick={event => { event.stopPropagation(); onToggle(job); }}
      className={`inline-flex shrink-0 items-center justify-center rounded-lg w-11 h-11 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-40 ${hot ? 'text-amber-600 hover:bg-amber-100' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`}>
      <Star size={18} fill={hot ? 'currentColor' : 'none'} />
    </button>
  );
}
