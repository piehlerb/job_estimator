import { useMemo, useState } from 'react';
import type { Lead } from '../types';

interface LeadDayRow {
  day: string;
  total: number;
  bySource: Record<string, number>;
}

interface LeadCreatedDateReportProps {
  leads: Lead[];
}

interface LeadCreationChartProps {
  rows: LeadDayRow[];
  sources: string[];
  colors: Record<string, string>;
}

const NO_SOURCE = '(No Source)';
const SOURCE_COLORS = [
  '#2563eb',
  '#0f766e',
  '#d97706',
  '#7c3aed',
  '#db2777',
  '#4d7c0f',
  '#0891b2',
  '#b45309',
  '#be123c',
  '#475569',
];

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateKey(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : getLocalDateKey(date);
}

function getPriorThirtyDaysStart(): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - 29);
  return getLocalDateKey(date);
}

function getToday(): string {
  return getLocalDateKey(new Date());
}

function getLeadSource(lead: Lead): string {
  return lead.source?.trim() || NO_SOURCE;
}

function getLeadName(lead: Lead): string {
  return lead.name?.trim() || lead.phone || lead.email || 'Unknown lead';
}

function getDayLabel(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildDays(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate || startDate > endDate) return [];

  const days: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (cursor <= end) {
    days.push(getLocalDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function LeadCreationChart({ rows, sources, colors }: LeadCreationChartProps) {
  const maxLeadCount = Math.max(...rows.map((row) => row.total), 0);
  if (maxLeadCount === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center text-sm text-slate-500">
        No leads were created during this date range.
      </div>
    );
  }

  const yMax = Math.max(4, Math.ceil(maxLeadCount / 4) * 4);
  const height = 292;
  const padding = { top: 18, right: 18, bottom: 58, left: 42 };
  const chartWidth = Math.max(760, rows.length * 34 + padding.left + padding.right);
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const baseline = padding.top + plotHeight;
  const step = plotWidth / rows.length;
  const barWidth = Math.min(22, step * 0.68);
  const labelStep = Math.max(1, Math.ceil(rows.length / 10));
  const yTicks = Array.from({ length: 5 }, (_, index) => (yMax / 4) * index);

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-100 bg-white pb-1">
      <svg
        role="img"
        aria-label="Stacked bar chart of leads created each day, grouped by lead source"
        width={chartWidth}
        height={height}
        viewBox={`0 0 ${chartWidth} ${height}`}
        className="block min-w-full"
      >
        <title>Leads created each day, stacked by source</title>
        {yTicks.map((tick) => {
          const y = baseline - (tick / yMax) * plotHeight;
          return (
            <g key={tick}>
              <line x1={padding.left} x2={chartWidth - padding.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={padding.left - 9} y={y + 4} fill="#64748b" fontSize="11" textAnchor="end">{tick}</text>
            </g>
          );
        })}
        <line x1={padding.left} x2={padding.left} y1={padding.top} y2={baseline} stroke="#cbd5e1" strokeWidth="1" />
        {rows.map((row, rowIndex) => {
          const x = padding.left + rowIndex * step + (step - barWidth) / 2;
          let stackedCount = 0;
          const shouldShowLabel = rowIndex % labelStep === 0 || rowIndex === rows.length - 1;

          return (
            <g key={row.day}>
              {sources.map((source) => {
                const count = row.bySource[source] || 0;
                if (count === 0) return null;
                const y = baseline - ((stackedCount + count) / yMax) * plotHeight;
                const barHeight = (count / yMax) * plotHeight;
                stackedCount += count;
                return (
                  <rect key={source} x={x} y={y} width={barWidth} height={barHeight} fill={colors[source]} rx="2">
                    <title>{`${getDayLabel(row.day)}: ${count} ${source} lead${count === 1 ? '' : 's'}`}</title>
                  </rect>
                );
              })}
              {shouldShowLabel && (
                <text
                  x={x + barWidth / 2}
                  y={baseline + 16}
                  fill="#64748b"
                  fontSize="10"
                  textAnchor="end"
                  transform={`rotate(-42 ${x + barWidth / 2} ${baseline + 16})`}
                >
                  {getDayLabel(row.day)}
                </text>
              )}
            </g>
          );
        })}
        <text x="14" y={padding.top + plotHeight / 2} fill="#64748b" fontSize="11" textAnchor="middle" transform={`rotate(-90 14 ${padding.top + plotHeight / 2})`}>
          Leads
        </text>
      </svg>
    </div>
  );
}

export default function LeadCreatedDateReport({ leads }: LeadCreatedDateReportProps) {
  const [startDate, setStartDate] = useState(getPriorThirtyDaysStart);
  const [endDate, setEndDate] = useState(getToday);

  const selectedDays = useMemo(() => buildDays(startDate, endDate), [startDate, endDate]);
  const dateRangeIsValid = Boolean(startDate && endDate && startDate <= endDate);

  const { dailyRows, detailLeads, sourceTotals } = useMemo(() => {
    const rowsByDay = new Map<string, LeadDayRow>(
      selectedDays.map((day) => [day, { day, total: 0, bySource: {} }])
    );
    const matchingLeads: Lead[] = [];
    const totals: Record<string, number> = {};

    leads.forEach((lead) => {
      if (lead.deleted) return;
      const day = getDateKey(lead.createdAt);
      const row = day ? rowsByDay.get(day) : undefined;
      if (!row) return;

      const source = getLeadSource(lead);
      row.total += 1;
      row.bySource[source] = (row.bySource[source] || 0) + 1;
      totals[source] = (totals[source] || 0) + 1;
      matchingLeads.push(lead);
    });

    return {
      dailyRows: Array.from(rowsByDay.values()),
      detailLeads: matchingLeads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      sourceTotals: totals,
    };
  }, [leads, selectedDays]);

  const sources = useMemo(
    () => Object.keys(sourceTotals).sort((a, b) => sourceTotals[b] - sourceTotals[a] || a.localeCompare(b)),
    [sourceTotals]
  );
  const sourceColors = useMemo(
    () => Object.fromEntries(sources.map((source, index) => [source, SOURCE_COLORS[index % SOURCE_COLORS.length]])),
    [sources]
  );

  const resetDateRange = () => {
    setStartDate(getPriorThirtyDaysStart());
    setEndDate(getToday());
  };

  return (
    <section className="space-y-4 sm:space-y-6">
      <div className="border-b border-slate-200 pb-4 sm:flex sm:items-end sm:justify-between sm:gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4d7820]">Lead volume</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Leads by Created Date</h2>
          <p className="mt-1 text-sm text-slate-600">Daily lead volume, with each bar segmented by acquisition source.</p>
        </div>
        <div className="mt-3 text-right sm:mt-0">
          <p className="text-2xl font-bold tabular-nums text-slate-900">{detailLeads.length}</p>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Leads in range</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 sm:flex-row sm:items-end sm:justify-between sm:p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
            Start date
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => setStartDate(event.target.value)}
              className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
            End date
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              max={getToday()}
              onChange={(event) => setEndDate(event.target.value)}
              className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={resetDateRange}
          className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
        >
          Last 30 days
        </button>
      </div>

      {!dateRangeIsValid ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Choose an end date that is on or after the start date.
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">Daily leads by source</h3>
                <p className="mt-1 text-xs text-slate-500">{getDayLabel(startDate)} – {getDayLabel(endDate)} · {selectedDays.length} calendar days</p>
              </div>
              {sources.length > 0 && (
                <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-slate-600" aria-label="Lead source legend">
                  {sources.map((source) => (
                    <li key={source} className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: sourceColors[source] }} aria-hidden="true" />
                      <span>{source} <span className="tabular-nums text-slate-400">{sourceTotals[source]}</span></span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <LeadCreationChart rows={dailyRows} sources={sources} colors={sourceColors} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-5">
              <div>
                <h3 className="font-semibold text-slate-900">Lead details</h3>
                <p className="mt-0.5 text-xs text-slate-500">All {detailLeads.length} lead{detailLeads.length === 1 ? '' : 's'} created in the selected date range.</p>
              </div>
            </div>
            {detailLeads.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500">No lead details to show for this date range.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[850px] w-full text-left">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold sm:px-5">Created</th>
                      <th className="px-4 py-3 font-semibold">Lead</th>
                      <th className="px-4 py-3 font-semibold">Source</th>
                      <th className="px-4 py-3 font-semibold">Campaign</th>
                      <th className="px-4 py-3 font-semibold">Stage</th>
                      <th className="px-4 py-3 font-semibold sm:px-5">Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detailLeads.map((lead) => (
                      <tr key={lead.id} className="align-top transition-colors hover:bg-slate-50/80">
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 sm:px-5">{formatCreatedAt(lead.createdAt)}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{getLeadName(lead)}</p>
                          {(lead.phone || lead.email) && (
                            <p className="mt-0.5 text-xs text-slate-500">{[lead.phone, lead.email].filter(Boolean).join(' · ')}</p>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-sm ${getLeadSource(lead) === NO_SOURCE ? 'italic text-slate-400' : 'text-slate-700'}`}>{getLeadSource(lead)}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{lead.campaign || lead.utmCampaign || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{lead.stage}</td>
                        <td className="max-w-xs px-4 py-3 text-sm text-slate-600 sm:px-5">{lead.address || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
