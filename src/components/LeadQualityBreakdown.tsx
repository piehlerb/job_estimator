import { useMemo, useState } from 'react';
import type { Lead, LeadAppointment } from '../types';
import { costPer, leadSourceOf, leadTerritory, percent, summarizeLeads, type SourceCost } from '../lib/leadReporting';

const money = (value: number | null) => value === null ? '—' : value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/**
 * Lead outcomes per source. With `sourceCosts`, each source also shows its
 * spend and cost per lead / in-territory lead / booking, and sources with
 * spend but no leads still appear.
 */
export default function LeadQualityBreakdown({ leads, appointments, sourceCosts }: { leads: Lead[]; appointments: LeadAppointment[]; sourceCosts?: Map<string, SourceCost> }) {
  const [territory, setTerritory] = useState('All');
  const [sort, setSort] = useState('bookedInTerritory');
  const rows = useMemo(() => {
    const groups = new Map<string, Lead[]>();
    leads.forEach(lead => {
      if (lead.deleted || (territory !== 'All' && leadTerritory(lead) !== territory)) return;
      const source = leadSourceOf(lead);
      const group = groups.get(source) || [];
      group.push(lead);
      groups.set(source, group);
    });
    // Paid sources with no leads in range still show, so their spend isn't hidden
    sourceCosts?.forEach((_, source) => { if (!groups.has(source)) groups.set(source, []); });
    return [...groups].map(([source, group]) => ({ source, cost: sourceCosts?.get(source), ...summarizeLeads(group, appointments) }))
      .sort((a, b) => (sort === 'bookedInTerritory' ? b.bookedInTerritory - a.bookedInTerritory : sort === 'territory' ? b.territory['In territory'] - a.territory['In territory'] : sort === 'leads' ? b.leads - a.leads : sort === 'spend' ? (b.cost?.spend ?? -1) - (a.cost?.spend ?? -1) : b.booked - a.booked) || b.leads - a.leads || a.source.localeCompare(b.source));
  }, [leads, appointments, territory, sort, sourceCosts]);
  return <section className="space-y-3">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h3 className="font-semibold text-slate-900">Source quality</h3><p className="text-xs text-slate-500">Current outcomes for leads in the selected range. Expand a source for stage and disposition counts.</p></div>
      <div className="flex flex-wrap gap-3 text-xs">
        <label>Territory<select aria-label="Territory" className="block rounded border p-2" value={territory} onChange={e => setTerritory(e.target.value)}>{['All', 'In territory', 'Out of territory'].map(v => <option key={v}>{v}</option>)}</select></label>
        <label>Rank by<select aria-label="Rank sources by" className="block rounded border p-2" value={sort} onChange={e => setSort(e.target.value)}><option value="bookedInTerritory">In-territory bookings</option><option value="booked">Bookings</option><option value="territory">In-territory leads</option><option value="leads">Lead volume</option>{sourceCosts && <option value="spend">Ad spend</option>}</select></label>
      </div>
    </div>
    <p className="text-xs text-slate-500">In territory means any lead not marked “Out of Territory,” including leads without an address. Booked means an appointment was recorded or the lead reached a booked-or-later stage.{sourceCosts && ' A source’s costs use its own spend and only its leads from months that spend was entered; the territory filter does not change them.'}</p>
    {rows.length === 0 && <p className="rounded border border-dashed p-6 text-sm text-slate-500">No leads match these filters.</p>}
    {rows.map(row => <details key={row.source} className="rounded-lg border border-slate-200 bg-white">
      <summary className="cursor-pointer p-4 focus-visible:outline-gf-lime">
        <span className="font-semibold text-slate-900 break-words">{row.source}</span>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:grid-cols-7">
          {Object.entries({ Leads: row.leads, 'In territory': `${row.territory['In territory']} · ${percent(row.territory['In territory'], row.leads)}`, 'Out of territory': row.territory['Out of territory'], Booked: `${row.booked} · ${percent(row.booked, row.leads)}`, 'Booked in territory': row.bookedInTerritory, Open: row.open, Won: row.won }).map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-semibold tabular-nums">{value}</dd></div>)}
        </dl>
        {sourceCosts && <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm sm:grid-cols-4">
          {Object.entries({ 'Ad spend': money(row.cost?.spend ?? null), 'Cost / lead': money(row.cost ? costPer(row.cost.spend, row.cost.leads) : null), CPLIT: money(row.cost ? costPer(row.cost.spend, row.cost.inTerritory) : null), 'Cost / booking': money(row.cost ? costPer(row.cost.spend, row.cost.booked) : null) }).map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-semibold tabular-nums">{value}</dd></div>)}
        </dl>}
      </summary>
      <div className="grid gap-5 border-t p-4 sm:grid-cols-2">
        {([['Stage', row.stages], ['Disposition', row.dispositions]] as const).map(([title, counts]) => <div key={title}><h4 className="mb-2 text-sm font-semibold">{title}</h4><dl className="space-y-1">{Object.entries(counts).map(([label, count]) => <div key={label} className="flex justify-between gap-3 text-sm"><dt>{label}</dt><dd className="tabular-nums">{count}</dd></div>)}</dl></div>)}
        <p className="text-xs text-slate-500">Share of filtered leads: {percent(row.leads, rows.reduce((sum, r) => sum + r.leads, 0))}. Booking rate among decided leads: {percent(row.booked, row.decided)}.</p>
      </div>
    </details>)}
  </section>;
}
