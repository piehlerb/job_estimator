import { Eye } from 'lucide-react';

/** Shown at the top of a page the member can see but not change */
export default function ViewOnlyNotice({ className = '' }: { className?: string }) {
  return (
    <div
      role="status"
      className={`flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800 ${className}`}
    >
      <Eye size={16} className="shrink-0" />
      View only — you can look around here, but not make changes.
    </div>
  );
}
