import { useMemo, useState } from 'react';
import { MessageSquare, Phone } from 'lucide-react';
import type { Lead, LeadStage } from '../types';
import { LEAD_STAGES } from '../lib/leadPipeline';
import {
  buildLeadContactReport,
  LEAD_CONTACT_REPORT_EXCLUDED_STAGES,
  type LeadContactReportOrder,
  type LeadContactReportRow,
} from '../lib/leadContactReport';
import { stageBadgeClass } from '../lib/leadStageStyles';

interface LeadLastContactedReportProps {
  leads: Lead[];
}

const REPORT_STAGES = LEAD_STAGES.filter((stage) => !LEAD_CONTACT_REPORT_EXCLUDED_STAGES.has(stage));

function leadName(lead: Lead): string {
  return lead.name?.trim() || lead.phone || lead.email || 'Unknown lead';
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysLabel(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

/** Colour for how long a lead has gone without a call or text */
function stalenessClass(row: LeadContactReportRow): string {
  if (row.daysSinceContact === undefined) return 'bg-red-100 text-red-800';
  if (row.daysSinceContact > 14) return 'bg-red-50 text-red-700';
  if (row.daysSinceContact > 7) return 'bg-amber-50 text-amber-800';
  return 'bg-green-50 text-green-800';
}

function LastContactedBadge({ row }: { row: LeadContactReportRow }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${stalenessClass(row)}`}
      title={row.lastContactedAt ? formatDateTime(row.lastContactedAt) : undefined}
    >
      {row.daysSinceContact === undefined ? 'Never contacted' : daysLabel(row.daysSinceContact)}
    </span>
  );
}

function ContactCounts({ row }: { row: LeadContactReportRow }) {
  return (
    <span className="inline-flex items-center gap-3 text-sm tabular-nums text-slate-600">
      <span className="inline-flex items-center gap-1" title="Calls">
        <Phone size={13} className="text-slate-400" aria-hidden="true" />
        <span className="sr-only">Calls</span>
        {row.calls}
      </span>
      <span className="inline-flex items-center gap-1" title="Texts">
        <MessageSquare size={13} className="text-slate-400" aria-hidden="true" />
        <span className="sr-only">Texts</span>
        {row.texts}
      </span>
    </span>
  );
}

function PhoneLink({ phone }: { phone?: string }) {
  if (!phone) return null;
  return (
    <a href={`tel:${phone}`} className="text-xs text-slate-500 underline-offset-2 hover:text-[#4d7820] hover:underline">
      {phone}
    </a>
  );
}

export default function LeadLastContactedReport({ leads }: LeadLastContactedReportProps) {
  const [order, setOrder] = useState<LeadContactReportOrder>('stalest');
  const [selectedStages, setSelectedStages] = useState<Set<LeadStage>>(() => new Set(REPORT_STAGES));

  const allRows = useMemo(() => buildLeadContactReport(leads, { order }), [leads, order]);
  const rows = useMemo(() => allRows.filter((row) => selectedStages.has(row.lead.stage)), [allRows, selectedStages]);

  const stageCounts = useMemo(() => {
    const counts = new Map<LeadStage, number>();
    allRows.forEach((row) => counts.set(row.lead.stage, (counts.get(row.lead.stage) || 0) + 1));
    return counts;
  }, [allRows]);

  const totals = useMemo(() => {
    let never = 0;
    let overWeek = 0;
    let withinWeek = 0;
    rows.forEach((row) => {
      if (row.daysSinceContact === undefined) never++;
      else if (row.daysSinceContact > 7) overWeek++;
      else withinWeek++;
    });
    return { never, overWeek, withinWeek };
  }, [rows]);

  const toggleStage = (stage: LeadStage) => {
    setSelectedStages((current) => {
      const next = new Set(current);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  };

  const allStagesSelected = selectedStages.size === REPORT_STAGES.length;

  return (
    <section className="space-y-4 sm:space-y-6">
      <div className="border-b border-slate-200 pb-4 sm:flex sm:items-end sm:justify-between sm:gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4d7820]">Lead follow-up</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Last Contacted</h2>
          <p className="mt-1 text-sm text-slate-600">
            Every lead that isn't disqualified, ordered by its most recent call or text.
          </p>
        </div>
        <div className="mt-3 text-right sm:mt-0">
          <p className="text-2xl font-bold tabular-nums text-slate-900">{rows.length}</p>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Leads shown</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: 'Never contacted', value: totals.never, tone: 'text-red-700' },
          { label: 'Over 7 days', value: totals.overWeek, tone: 'text-amber-700' },
          { label: 'Within 7 days', value: totals.withinWeek, tone: 'text-green-700' },
        ].map(({ label, value, tone }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <p className={`text-xl font-bold tabular-nums sm:text-2xl ${tone}`}>{value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">Order</span>
          <div className="inline-flex rounded-lg bg-slate-200/70 p-0.5">
            {([
              { id: 'stalest', label: 'Longest since contact' },
              { id: 'recent', label: 'Most recent first' },
            ] as { id: LeadContactReportOrder; label: string }[]).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setOrder(id)}
                aria-pressed={order === id}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  order === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-semibold text-slate-700">Stages</span>
          {REPORT_STAGES.map((stage) => {
            const active = selectedStages.has(stage);
            return (
              <button
                key={stage}
                type="button"
                onClick={() => toggleStage(stage)}
                aria-pressed={active}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'border-gf-lime bg-white text-slate-900'
                    : 'border-slate-200 bg-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                {stage} <span className="tabular-nums text-slate-400">{stageCounts.get(stage) || 0}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSelectedStages(allStagesSelected ? new Set() : new Set(REPORT_STAGES))}
            className="ml-1 text-xs font-semibold text-[#4d7820] hover:underline"
          >
            {allStagesSelected ? 'Clear' : 'All'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            {selectedStages.size === 0 ? 'Pick at least one stage to see leads.' : 'No leads in the selected stages.'}
          </div>
        ) : (
          <>
            {/* Phones: one card per lead */}
            <ul className="divide-y divide-slate-100 sm:hidden">
              {rows.map((row) => (
                <li key={row.lead.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{leadName(row.lead)}</p>
                      <PhoneLink phone={row.lead.phone} />
                    </div>
                    <LastContactedBadge row={row} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${stageBadgeClass(row.lead.stage)}`}>
                      {row.lead.stage}
                    </span>
                    <ContactCounts row={row} />
                    {row.lead.source && <span className="text-xs text-slate-500">{row.lead.source}</span>}
                  </div>
                </li>
              ))}
            </ul>

            {/* Tablets and up: table */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold sm:px-5">Lead</th>
                    <th className="px-4 py-3 font-semibold">Stage</th>
                    <th className="px-4 py-3 font-semibold">Last contacted</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">Calls · Texts</th>
                    <th className="hidden px-4 py-3 font-semibold lg:table-cell">Source</th>
                    <th className="hidden whitespace-nowrap px-4 py-3 font-semibold sm:px-5 xl:table-cell">Lead created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.lead.id} className="align-top transition-colors hover:bg-slate-50/80">
                      <td className="px-4 py-3 sm:px-5">
                        <p className="whitespace-nowrap font-medium text-slate-900">{leadName(row.lead)}</p>
                        <PhoneLink phone={row.lead.phone} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${stageBadgeClass(row.lead.stage)}`}>
                          {row.lead.stage}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <LastContactedBadge row={row} />
                        {row.lastContactedAt && (
                          <p className="mt-1 whitespace-nowrap text-xs text-slate-500">{formatDateTime(row.lastContactedAt)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ContactCounts row={row} />
                      </td>
                      <td className="hidden px-4 py-3 text-sm text-slate-600 lg:table-cell">{row.lead.source || '—'}</td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-slate-600 sm:px-5 xl:table-cell">
                        {formatDate(row.lead.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
