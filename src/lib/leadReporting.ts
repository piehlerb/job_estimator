import type { Lead, LeadAppointment } from '../types/index.js';

export type Territory = 'In territory' | 'Out of territory';

export const percent = (count: number, total: number) => total ? `${(count / total * 100).toFixed(1)}%` : '—';

export function leadTerritory(lead: Lead): Territory {
  if (lead.dispositionReason === 'Out of Territory') return 'Out of territory';
  // Business rule: all leads count as in territory unless explicitly excluded.
  return 'In territory';
}

export function summarizeLeads(leads: Lead[], appointments: LeadAppointment[]) {
  const appointmentIds = new Set(appointments.filter(a => !a.deleted).map(a => a.leadId));
  const active = leads.filter(l => !l.deleted);
  const stages: Record<string, number> = {};
  const dispositions: Record<string, number> = {};
  const territory = { 'In territory': 0, 'Out of territory': 0 };
  let booked = 0, bookedInTerritory = 0, decided = 0, won = 0;
  for (const lead of active) {
    const location = leadTerritory(lead);
    territory[location]++;
    const isBooked = appointmentIds.has(lead.id) || ['Estimate Booked', 'Estimate Completed', 'Quoted', 'Won'].includes(lead.stage);
    if (isBooked) booked++;
    if (isBooked && location === 'In territory') bookedInTerritory++;
    if (isBooked || ['Won', 'Lost', 'Disqualified'].includes(lead.stage)) decided++;
    if (lead.stage === 'Won') won++;
    stages[lead.stage] = (stages[lead.stage] || 0) + 1;
    const reason = lead.dispositionReason || 'No disposition';
    dispositions[reason] = (dispositions[reason] || 0) + 1;
  }
  return { leads: active.length, booked, bookedInTerritory, decided, open: active.length - decided, won, territory, stages, dispositions };
}

export function costPer(spend: number | null, count: number): number | null {
  return spend !== null && count > 0 ? spend / count : null;
}
