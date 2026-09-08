import { useMemo, useState } from 'react';
import type { AdSpend, Lead, LeadAppointment } from '../types';
import { costPer, percent, summarizeLeads } from '../lib/leadReporting';
import { toLocalDateString } from '../lib/dateUtils';
import LeadQualityBreakdown from './LeadQualityBreakdown';

const money = (value: number | null) => value === null ? '—' : value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const monthOf = (lead: Lead) => {
  const date = new Date(lead.firstSeenAt || lead.createdAt);
  return Number.isNaN(date.getTime()) ? '' : toLocalDateString(date).slice(0, 7);
};
const sourceOf = (lead: Lead) => lead.source?.trim() || '(No Source)';
const monthLabel = (month: string) => new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

interface Props {
  leads: Lead[];
  appointments: LeadAppointment[];
  spendRecords: AdSpend[];
  drafts: Record<string, string>;
  setDraft: (month: string, value: string) => void;
  saveSpend: (month: string) => void;
  savingMonth: string | null;
}

export default function LeadTrackingReport({ leads, appointments, spendRecords, drafts, setDraft, saveSpend, savingMonth }: Props) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState(() => toLocalDateString().slice(0, 7));
  const [sources, setSources] = useState<string[]>([]);
  const valid = !start || !end || start <= end;
  const availableSources = useMemo(() => [...new Set(leads.filter(l => !l.deleted).map(sourceOf))].sort(), [leads]);
  const filtered = useMemo(() => leads.filter(l => {
    const month = monthOf(l);
    return valid && !l.deleted && month && (!start || month >= start) && (!end || month <= end) && (!sources.length || sources.includes(sourceOf(l)));
  }), [leads, start, end, sources, valid]);
  const rows = useMemo(() => {
    if (!valid) return [];
    const grouped = new Map<string, Lead[]>();
    filtered.forEach(l => { const key = monthOf(l); const group = grouped.get(key) || []; group.push(l); grouped.set(key, group); });
    const spends = new Map(spendRecords.filter(r => !r.deleted).map(r => [r.month, r.amount]));
    const current = toLocalDateString().slice(0, 7);
    const first = start || [...grouped.keys(), ...spends.keys(), current].sort()[0];
    const last = end || current;
    const cursor = new Date(`${first}-01T00:00:00`);
    const result = [];
    while (toLocalDateString(cursor).slice(0, 7) <= last) {
      const month = toLocalDateString(cursor).slice(0, 7);
      const cohort = grouped.get(month) || [];
      result.push({ month, cohort, spend: spends.get(month) ?? null, ...summarizeLeads(cohort, appointments) });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return result.reverse();
  }, [filtered, spendRecords, appointments, start, end, valid]);
  const total = useMemo(() => summarizeLeads(filtered, appointments), [filtered, appointments]);
  // Compare spend and lead counts over exactly the same months. Missing spend
  // is not zero; a deliberately entered zero remains a valid cost observation.
  const costTotals = rows.filter(r => r.spend !== null).reduce((acc, row) => ({ spend: acc.spend + row.spend!, leads: acc.leads + row.leads, territory: acc.territory + row.territory['In territory'], booked: acc.booked + row.booked }), { spend: 0, leads: 0, territory: 0, booked: 0 });
  const hasSpend = rows.some(r => r.spend !== null);
  const spend = hasSpend ? costTotals.spend : null;
  return <section className="space-y-5">
    <div className="rounded-lg border bg-white p-4 space-y-3">
      <h2 className="text-xl font-semibold text-slate-900">Lead Tracking</h2>
      <div className="flex flex-wrap gap-3">
        <label className="text-xs font-medium">From month<input aria-label="From month" type="month" className="block rounded border p-2" value={start} max={end || undefined} onChange={e => setStart(e.target.value)} /></label>
        <label className="text-xs font-medium">Through month<input aria-label="Through month" type="month" className="block rounded border p-2" value={end} min={start || undefined} onChange={e => setEnd(e.target.value)} /></label>
        <button className="self-end rounded border px-3 py-2 text-sm" onClick={() => { setStart(''); setEnd(toLocalDateString().slice(0, 7)); setSources([]); }}>Reset filters</button>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Source filters">{availableSources.map(source => <button key={source} aria-pressed={sources.includes(source)} onClick={() => setSources(prev => prev.includes(source) ? prev.filter(s => s !== source) : [...prev, source])} className={`rounded-full px-3 py-1 text-xs ${sources.includes(source) ? 'bg-lime-100 text-green-900' : 'bg-slate-100 text-slate-600'}`}>{source}</button>)}</div>
      <p className="text-xs text-slate-500">Grouped by first-seen month (created date if unavailable). Filters apply to all lead counts and source breakdowns. Spend is the full monthly advertising total, including when sources are filtered; costs are not source-attributed.</p>
    </div>
    {!valid ? <p role="alert" className="text-amber-800">Choose an end month on or after the start month.</p> : <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Object.entries({ Leads: total.leads, 'In territory': total.territory['In territory'], 'Ad spend recorded': money(spend), 'Cost / lead': money(costPer(spend, costTotals.leads)), CPLIT: money(costPer(spend, costTotals.territory)), 'Cost / booking': money(costPer(spend, costTotals.booked)) }).map(([label, value]) => <div key={label} className="rounded-lg border bg-white p-4"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-xl font-bold tabular-nums">{value}</dd></div>)}
      </dl>
      <p className="text-xs text-slate-500">CPLIT = spend ÷ in-territory leads. Cost / booking = spend ÷ booked leads. Summary costs use only months with recorded spend ({rows.filter(r => r.spend !== null).length} of {rows.length}); missing spend and zero denominators display —. Lead → booking: {percent(total.booked, total.leads)}; {percent(total.booked, total.decided)} of decided leads.</p>
      <LeadQualityBreakdown leads={filtered} appointments={appointments} />
      <div className="space-y-3">
        <div><h3 className="font-semibold text-slate-900">Leads by Month &amp; Source</h3><p className="text-xs text-slate-500">Expand a month for spend entry, conversion metrics, and its source breakdown.</p></div>
        {rows.map(row => <details key={row.month} className="rounded-lg border bg-white">
          <summary className="cursor-pointer p-4"><span className="font-semibold">{monthLabel(row.month)}</span>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">{Object.entries({ Leads: row.leads, 'In territory': row.territory['In territory'], Booked: row.booked, 'Cost / lead': money(costPer(row.spend, row.leads)), CPLIT: money(costPer(row.spend, row.territory['In territory'])), 'Cost / booking': money(costPer(row.spend, row.booked)) }).map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="font-semibold tabular-nums">{value}</dd></div>)}</dl>
          </summary>
          <div className="space-y-4 border-t p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <label className="text-sm">Ad spend · {monthLabel(row.month)}<input aria-label={`Ad spend for ${monthLabel(row.month)}`} type="number" min="0" step="any" inputMode="decimal" placeholder="Not entered" value={drafts[row.month] ?? (row.spend === null ? '' : String(row.spend))} disabled={savingMonth === row.month} onChange={e => setDraft(row.month, e.target.value)} onBlur={() => saveSpend(row.month)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} className="ml-2 w-32 rounded border p-2" /><span className="block mt-1 text-xs text-slate-500">{savingMonth === row.month ? 'Saving…' : 'Saves when you leave the field.'}</span></label>
              <p className="text-sm text-slate-600">Booking: {percent(row.booked, row.leads)} · Decided booking: {percent(row.booked, row.decided)} · Open: {row.open} · Won: {row.won}</p>
            </div>
            <LeadQualityBreakdown leads={row.cohort} appointments={appointments} />
          </div>
        </details>)}
      </div>
    </>}
  </section>;
}
