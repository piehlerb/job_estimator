import type { LeadStage } from '../types/index.js';

/** Tailwind classes for a lead stage badge, shared by the Leads page and lead reports */
export function stageBadgeClass(stage: LeadStage): string {
  switch (stage) {
    case 'Won':
      return 'bg-green-100 text-green-800';
    case 'Lost':
      return 'bg-red-100 text-red-800';
    case 'Disqualified':
      return 'bg-slate-200 text-slate-700';
    case 'Call Booked':
      return 'bg-cyan-100 text-cyan-800';
    case 'Estimate Booked':
    case 'Estimate Completed':
      return 'bg-blue-100 text-blue-800';
    case 'Quoted':
      return 'bg-purple-100 text-purple-800';
    case 'Contact Attempted':
    case 'Engaged':
      return 'bg-amber-100 text-amber-800';
    case 'New':
    default:
      return 'bg-slate-100 text-slate-700';
  }
}
