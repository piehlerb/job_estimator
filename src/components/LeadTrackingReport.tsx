import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { AdSpend, Lead, LeadAppointment } from '../types';
import {
  UNATTRIBUTED_SOURCE,
  costPer,
  costsBySource,
  leadMonth,
  leadSourceOf,
  percent,
  spendSourceOf,
  summarizeLeads,
} from '../lib/leadReporting';
import { toLocalDateString } from '../lib/dateUtils';
import LeadQualityBreakdown from './LeadQualityBreakdown';

const money = (value: number | null) => value === null ? '—' : value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const monthLabel = (month: string) => new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

interface Props {
  leads: Lead[];
  appointments: LeadAppointment[];
  spendRecords: AdSpend[];
  /** Set one source's spend for a month; null removes it ("not entered", which is not the same as $0) */
  saveSpend: (month: string, source: string, amount: number | null) => Promise<void>;
  canEditSpend: boolean;
}

export default function LeadTrackingReport({ leads, appointments, spendRecords, saveSpend, canEditSpend }: Props) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState(() => toLocalDateString().slice(0, 7));
  const [sources, setSources] = useState<string[]>([]);
  const valid = !start || !end || start <= end;
  const activeSpend = useMemo(() => spendRecords.filter(r => !r.deleted), [spendRecords]);
  const leadSources = useMemo(() => [...new Set(leads.filter(l => !l.deleted).map(leadSourceOf))], [leads]);
  // Filter chips: every lead source plus paid sources that have no leads yet
  const availableSources = useMemo(() => [...new Set([...leadSources, ...activeSpend.map(spendSourceOf)])].sort(), [leadSources, activeSpend]);
  // Sources offered when adding spend: the same, minus the catch-all groups
  const spendSources = useMemo(
    () => availableSources.filter(s => s !== '(No Source)' && s !== UNATTRIBUTED_SOURCE).sort((a, b) => a.localeCompare(b)),
    [availableSources]
  );
  const filtered = useMemo(() => leads.filter(l => {
    const month = leadMonth(l);
    return valid && !l.deleted && month && (!start || month >= start) && (!end || month <= end) && (!sources.length || sources.includes(leadSourceOf(l)));
  }), [leads, start, end, sources, valid]);
  // Spend follows the source filter: with sources selected, only their spend counts
  const scopedSpend = useMemo(() => activeSpend.filter(r => !sources.length || sources.includes(spendSourceOf(r))), [activeSpend, sources]);
  const rows = useMemo(() => {
    if (!valid) return [];
    const grouped = new Map<string, Lead[]>();
    filtered.forEach(l => { const key = leadMonth(l); const group = grouped.get(key) || []; group.push(l); grouped.set(key, group); });
    const spendByMonth = new Map<string, number>();
    scopedSpend.forEach(r => spendByMonth.set(r.month, (spendByMonth.get(r.month) ?? 0) + r.amount));
    const current = toLocalDateString().slice(0, 7);
    const first = start || [...grouped.keys(), ...spendByMonth.keys(), current].sort()[0];
    const last = end || current;
    const cursor = new Date(`${first}-01T00:00:00`);
    const result = [];
    while (toLocalDateString(cursor).slice(0, 7) <= last) {
      const month = toLocalDateString(cursor).slice(0, 7);
      const cohort = grouped.get(month) || [];
      result.push({
        month,
        cohort,
        spend: spendByMonth.get(month) ?? null,
        sourceCosts: costsBySource(cohort, appointments, scopedSpend, new Set([month])),
        ...summarizeLeads(cohort, appointments),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return result.reverse();
  }, [filtered, scopedSpend, appointments, start, end, valid]);
  const total = useMemo(() => summarizeLeads(filtered, appointments), [filtered, appointments]);
  const totalSourceCosts = useMemo(
    () => costsBySource(filtered, appointments, scopedSpend, new Set(rows.map(r => r.month))),
    [filtered, appointments, scopedSpend, rows]
  );
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
      <p className="text-xs text-slate-500">Grouped by first-seen month (created date if unavailable). Filters apply to lead counts, spend and costs: with sources selected, only those sources' spend is counted.</p>
    </div>
    {!valid ? <p role="alert" className="text-amber-800">Choose an end month on or after the start month.</p> : <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Object.entries({ Leads: total.leads, 'In territory': total.territory['In territory'], 'Ad spend recorded': money(spend), 'Cost / lead': money(costPer(spend, costTotals.leads)), CPLIT: money(costPer(spend, costTotals.territory)), 'Cost / booking': money(costPer(spend, costTotals.booked)) }).map(([label, value]) => <div key={label} className="rounded-lg border bg-white p-4"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-xl font-bold tabular-nums">{value}</dd></div>)}
      </dl>
      <p className="text-xs text-slate-500">CPLIT = spend ÷ in-territory leads. Cost / booking = spend ÷ booked leads. Summary costs blend all filtered leads over months with recorded spend ({rows.filter(r => r.spend !== null).length} of {rows.length}); each source's own costs are under Source quality. Missing spend and zero denominators display —. Lead → booking: {percent(total.booked, total.leads)}; {percent(total.booked, total.decided)} of decided leads.</p>
      <LeadQualityBreakdown leads={filtered} appointments={appointments} sourceCosts={totalSourceCosts} />
      <div className="space-y-3">
        <div><h3 className="font-semibold text-slate-900">Leads by Month &amp; Source</h3><p className="text-xs text-slate-500">{canEditSpend ? 'Enter ad spend per source for each month. ' : ''}Expand a month for conversion metrics and its source breakdown.</p></div>
        {rows.map(row => <div key={row.month} className="rounded-lg border bg-white">
          {/* Spend stays outside <details> so it is always visible and typing in it never toggles the row */}
          <MonthSpend
            month={row.month}
            total={row.spend}
            records={activeSpend.filter(r => r.month === row.month)}
            sourceOptions={spendSources}
            canEdit={canEditSpend}
            onSave={saveSpend}
          />
          <details>
            <summary className="cursor-pointer p-4">
              <dl className="inline-grid w-[calc(100%-1.5rem)] grid-cols-2 gap-3 align-top text-sm sm:grid-cols-3 lg:grid-cols-6">{Object.entries({ Leads: row.leads, 'In territory': row.territory['In territory'], Booked: row.booked, 'Cost / lead': money(costPer(row.spend, row.leads)), CPLIT: money(costPer(row.spend, row.territory['In territory'])), 'Cost / booking': money(costPer(row.spend, row.booked)) }).map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="font-semibold tabular-nums">{value}</dd></div>)}</dl>
            </summary>
            <div className="space-y-4 border-t p-4">
              <p className="text-sm text-slate-600">Booking: {percent(row.booked, row.leads)} · Decided booking: {percent(row.booked, row.decided)} · Open: {row.open} · Won: {row.won}</p>
              <LeadQualityBreakdown leads={row.cohort} appointments={appointments} sourceCosts={row.sourceCosts} />
            </div>
          </details>
        </div>)}
      </div>
    </>}
  </section>;
}

/** One month's spend by source: a summary line, plus an editor for members who can edit reporting */
function MonthSpend({ month, total, records, sourceOptions, canEdit, onSave }: {
  month: string;
  total: number | null;
  records: AdSpend[];
  sourceOptions: string[];
  canEdit: boolean;
  onSave: Props['saveSpend'];
}) {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newSource, setNewSource] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const sorted = [...records].sort((a, b) => b.amount - a.amount || spendSourceOf(a).localeCompare(spendSourceOf(b)));
  const label = monthLabel(month);
  const datalistId = `spend-sources-${month}`;

  const save = async (source: string, amount: number | null) => {
    setSaving(source);
    setError('');
    try {
      await onSave(month, source, amount);
      setDrafts(prev => { const next = { ...prev }; delete next[source]; return next; });
    } catch {
      setError('Could not save. Try again.');
    } finally {
      setSaving(null);
    }
  };

  const commitDraft = (record: AdSpend) => {
    const source = record.source?.trim() ?? '';
    const draft = drafts[source];
    if (draft === undefined) return;
    if (draft.trim() === '') return save(source, null);
    const amount = Number(draft);
    if (Number.isNaN(amount) || amount < 0 || amount === record.amount) {
      setDrafts(prev => { const next = { ...prev }; delete next[source]; return next; });
      return;
    }
    return save(source, amount);
  };

  const existingSource = newSource.trim() !== '' && records.some(r => (r.source?.trim() ?? '').toLowerCase() === newSource.trim().toLowerCase());
  const newAmountValue = Number(newAmount);
  const canAdd = newSource.trim() !== '' && newAmount.trim() !== '' && !Number.isNaN(newAmountValue) && newAmountValue >= 0 && !existingSource;
  const add = async () => {
    if (!canAdd) return;
    await save(newSource.trim(), newAmountValue);
    setNewSource('');
    setNewAmount('');
  };

  return <div className="px-4 pt-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="font-semibold">{label}</span>
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <span>Ad spend <span className="font-semibold tabular-nums text-slate-900">{money(total)}</span></span>
        {canEdit && <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} className="rounded border px-2 py-1 text-xs font-medium text-gf-dark-green hover:bg-slate-50">
          {open ? 'Done' : records.length ? 'Edit spend' : 'Add spend'}
        </button>}
      </div>
    </div>
    {sorted.length > 0 && !open && <p className="mt-1 text-xs text-slate-500">
      {sorted.map(r => `${spendSourceOf(r)} ${money(r.amount)}`).join(' · ')}
    </p>}
    {canEdit && open && <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      {sorted.map(record => {
        const source = record.source?.trim() ?? '';
        const name = spendSourceOf(record);
        return <div key={record.id} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="min-w-0 flex-1 truncate text-slate-700">{name}</span>
          <input
            aria-label={`${name} ad spend for ${label}`}
            type="number" min="0" step="any" inputMode="decimal"
            value={drafts[source] ?? String(record.amount)}
            disabled={saving === source}
            onChange={e => setDrafts(prev => ({ ...prev, [source]: e.target.value }))}
            onBlur={() => commitDraft(record)}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            className="w-28 rounded border bg-white p-1.5 text-right tabular-nums text-slate-900"
          />
          <button type="button" aria-label={`Remove ${name} spend for ${label}`} title="Remove" disabled={saving === source} onClick={() => save(source, null)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
            <X size={14} />
          </button>
        </div>;
      })}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2 text-sm">
        <input
          aria-label={`Source for new ad spend in ${label}`}
          list={datalistId}
          placeholder="Source"
          value={newSource}
          onChange={e => setNewSource(e.target.value)}
          className="min-w-0 flex-1 rounded border bg-white p-1.5"
        />
        <datalist id={datalistId}>
          {sourceOptions.filter(s => !records.some(r => r.source?.trim() === s)).map(s => <option key={s} value={s} />)}
        </datalist>
        <input
          aria-label={`Amount for new ad spend in ${label}`}
          type="number" min="0" step="any" inputMode="decimal" placeholder="Amount"
          value={newAmount}
          onChange={e => setNewAmount(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          className="w-28 rounded border bg-white p-1.5 text-right tabular-nums"
        />
        <button type="button" onClick={add} disabled={!canAdd || saving !== null} className="inline-flex items-center gap-1 rounded bg-gf-lime px-2.5 py-1.5 text-xs font-medium text-white hover:bg-gf-dark-green disabled:opacity-50">
          <Plus size={12} /> Add
        </button>
      </div>
      {existingSource && <p className="text-xs text-amber-700">That source already has spend this month; change its amount above.</p>}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-slate-500">Use the source name exactly as it appears on leads so costs line up. Clearing an amount removes it (not entered is different from $0).</p>
    </div>}
  </div>;
}
