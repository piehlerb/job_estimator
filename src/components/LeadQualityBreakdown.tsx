import { useMemo, useState } from 'react';
import type { Lead, LeadAppointment } from '../types';
import { leadTerritory, percent, summarizeLeads } from '../lib/leadReporting';

export default function LeadQualityBreakdown({ leads, appointments }: { leads: Lead[]; appointments: LeadAppointment[] }) {
  const [territory, setTerritory] = useState('All');
  const [sort, setSort] = useState('bookedInTerritory');
  const rows = useMemo(() => {
    const groups = new Map<string, Lead[]>();
    leads.forEach(lead => {
      if (lead.deleted || (territory !== 'All' && leadTerritory(lead) !== territory)) return;
      const source = lead.source?.trim() || '(No Source)';
      const group = groups.get(source) || [];
      group.push(lead);
      groups.set(source, group);
    });
    return [...groups].map(([source, group]) => ({ source, ...summarizeLeads(group, appointments) }))
      .sort((a, b) => (sort === 'bookedInTerritory' ? b.bookedInTerritory - a.bookedInTerritory : sort === 'territory' ? b.territory['In territory'] - a.territory['In territory'] : sort === 'leads' ? b.leads - a.leads : b.booked - a.booked) || b.leads - a.leads || a.source.localeCompare(b.source));
  }, [leads, appointments, territory, sort]);
  return <section className="space-y-3">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h3 className="font-semibold text-slate-900">Source quality</h3><p className="text-xs text-slate-500">Current outcomes for leads in the selected range. Expand a source for stage and disposition counts.</p></div>
      <div className="flex flex-wrap gap-3 text-xs">
        <label>Territory<select aria-label="Territory" className="block rounded border p-2" value={territory} onChange={e => setTerritory(e.target.value)}>{['All', 'In territory', 'Out of territory'].map(v => <option key={v}>{v}</option>)}</select></label>
        <label>Rank by<select aria-label="Rank sources by" className="block rounded border p-2" value={sort} onChange={e => setSort(e.target.value)}><option value="bookedInTerritory">In-territory bookings</option><option value="booked">Bookings</option><option value="territory">In-territory leads</option><option value="leads">Lead volume</option></select></label>
      </div>
    </div>
    <p className="text-xs text-slate-500">In territory means any lead not marked “Out of Territory,” including leads without an address. Booked means an appointment was recorded or the lead reached a booked-or-later stage.</p>
    {rows.length === 0 && <p className="rounded border border-dashed p-6 text-sm text-slate-500">No leads match these filters.</p>}
    {rows.map(row => <details key={row.source} className="rounded-lg border border-slate-200 bg-white">
      <summary className="cursor-pointer p-4 focus-visible:outline-gf-lime">
        <span className="font-semibold text-slate-900 break-words">{row.source}</span>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:grid-cols-7">
          {Object.entries({ Leads: row.leads, 'In territory': `${row.territory['In territory']} · ${percent(row.territory['In territory'], row.leads)}`, 'Out of territory': row.territory['Out of territory'], Booked: `${row.booked} · ${percent(row.booked, row.leads)}`, 'Booked in territory': row.bookedInTerritory, Open: row.open, Won: row.won }).map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-semibold tabular-nums">{value}</dd></div>)}
        </dl>
      </summary>
      <div className="grid gap-5 border-t p-4 sm:grid-cols-2">
        {([['Stage', row.stages], ['Disposition', row.dispositions]] as const).map(([title, counts]) => <div key={title}><h4 className="mb-2 text-sm font-semibold">{title}</h4><dl className="space-y-1">{Object.entries(counts).map(([label, count]) => <div key={label} className="flex justify-between gap-3 text-sm"><dt>{label}</dt><dd className="tabular-nums">{count}</dd></div>)}</dl></div>)}
        <p className="text-xs text-slate-500">Share of filtered leads: {percent(row.leads, rows.reduce((sum, r) => sum + r.leads, 0))}. Booking rate among decided leads: {percent(row.booked, row.decided)}.</p>
      </div>
    </details>)}
  </section>;
}
