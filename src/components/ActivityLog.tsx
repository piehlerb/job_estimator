import { useCallback, useEffect, useState } from 'react';
import { Bot, ChevronDown, ChevronRight, History, RefreshCw } from 'lucide-react';
import { AUDIT_PAGE_SIZE, getAuditLog, type AuditLogFilters } from '../lib/organizationService';
import { AUDIT_TABLES, actionVerb, actorName, changedFields, formatValue, tableLabel } from '../lib/auditFormat';
import type { AuditLogEntry, OrganizationMember } from '../types';

const PERIODS = [
  { value: '1', label: 'Last 24 hours' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
];

const ACTION_STYLES: Record<AuditLogEntry['action'], string> = {
  insert: 'bg-green-50 text-green-700 border-green-200',
  update: 'bg-slate-50 text-slate-700 border-slate-200',
  delete: 'bg-red-50 text-red-700 border-red-200',
  restore: 'bg-amber-50 text-amber-700 border-amber-200',
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * Who changed what in the organization, newest first. Admin only (the
 * audit_log RLS policy returns nothing to anyone else).
 */
export default function ActivityLog({ orgId, members }: { orgId: string; members: OrganizationMember[] }) {
  const [actor, setActor] = useState('');
  const [area, setArea] = useState('');
  const [period, setPeriod] = useState('7');
  const [agentsOnly, setAgentsOnly] = useState(false);
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const buildFilters = useCallback((): AuditLogFilters => ({
    actor: actor || undefined,
    tableNames: area ? AUDIT_TABLES.find((g) => g.area === area)?.tables.map((t) => t.name) : undefined,
    agentsOnly,
    since: period === 'all' ? undefined : new Date(Date.now() - Number(period) * 86_400_000).toISOString(),
  }), [actor, area, period, agentsOnly]);

  const load = useCallback(async (append: boolean, before?: number) => {
    setLoading(true);
    setError('');
    try {
      const page = await getAuditLog(orgId, { ...buildFilters(), before });
      setEntries((prev) => (append ? [...prev, ...page] : page));
      setHasMore(page.length === AUDIT_PAGE_SIZE);
      if (!append) setExpanded(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity.');
    } finally {
      setLoading(false);
    }
  }, [orgId, buildFilters]);

  useEffect(() => {
    load(false);
  }, [load]);

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectClass = 'text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-gf-electric/40';

  return (
    <section>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <History size={18} className="text-slate-500" />
          <h2 className="text-base font-semibold text-slate-700">Activity</h2>
        </div>
        <button
          type="button"
          onClick={() => load(false)}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Every change saved to the organization's data, by whom and when. Changes made offline appear once they sync.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select aria-label="Who" value={actor} onChange={(e) => setActor(e.target.value)} className={selectClass}>
          <option value="">Everyone</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.email}{m.isAgent ? ' (agent)' : ''}
            </option>
          ))}
          <option value="system">System (GoHighLevel, database updates)</option>
        </select>
        <select aria-label="Area" value={area} onChange={(e) => setArea(e.target.value)} className={selectClass}>
          <option value="">All areas</option>
          {AUDIT_TABLES.map((g) => (
            <option key={g.area} value={g.area}>{g.area}</option>
          ))}
        </select>
        <select aria-label="Period" value={period} onChange={(e) => setPeriod(e.target.value)} className={selectClass}>
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={agentsOnly}
            onChange={(e) => setAgentsOnly(e.target.checked)}
            className="rounded border-slate-300 text-gf-lime focus:ring-gf-lime"
          />
          Agents only
        </label>
      </div>

      {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        {entries.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            {loading ? 'Loading…' : 'No activity for these filters.'}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {entries.map((entry) => {
              const fields = changedFields(entry);
              const isOpen = expanded.has(entry.id);
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => toggle(entry.id)}
                    aria-expanded={isOpen}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-start gap-2"
                  >
                    <span className="mt-0.5 text-slate-400">{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
                        <span className="font-medium text-slate-800 break-all">{actorName(entry)}</span>
                        {entry.isAgent && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-700">
                            <Bot size={10} /> Agent
                          </span>
                        )}
                        <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${ACTION_STYLES[entry.action]}`}>
                          {actionVerb(entry.action)}
                        </span>
                        <span className="text-slate-600">{tableLabel(entry.tableName)}</span>
                        {entry.recordLabel && <span className="font-medium text-slate-800 break-all">“{entry.recordLabel}”</span>}
                      </span>
                      <span className="block text-xs text-slate-500 mt-0.5">
                        {formatWhen(entry.createdAt)}
                        {entry.action === 'update' && fields.length > 0 && (
                          <> · {fields.slice(0, 3).map((f) => f.label).join(', ')}{fields.length > 3 ? ` +${fields.length - 3} more` : ''}</>
                        )}
                      </span>
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-3 pl-10 overflow-x-auto">
                      {fields.length === 0 ? (
                        <p className="text-xs text-slate-500">No field details.</p>
                      ) : (
                        <table className="text-xs w-full max-w-3xl">
                          <thead>
                            <tr className="text-slate-500">
                              <th className="py-1 pr-4 text-left font-semibold">Field</th>
                              {entry.action !== 'insert' && <th className="py-1 pr-4 text-left font-semibold">Before</th>}
                              {entry.action !== 'delete' && <th className="py-1 text-left font-semibold">After</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {fields.map((f) => (
                                <tr key={f.field} className="border-t border-slate-100 align-top">
                                  <td className="py-1 pr-4 text-slate-700 whitespace-nowrap">{f.label}</td>
                                  {entry.action !== 'insert' && (
                                    <td className="py-1 pr-4 text-slate-500 break-all" title={formatValue(f.old, 10_000)}>{formatValue(f.old)}</td>
                                  )}
                                  {entry.action !== 'delete' && (
                                    <td className="py-1 text-slate-900 break-all" title={formatValue(f.new, 10_000)}>{formatValue(f.new)}</td>
                                  )}
                                </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {hasMore && (
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => load(true, entries[entries.length - 1]?.id)}
            disabled={loading}
            className="text-sm font-medium text-gf-dark-green hover:underline disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Load older'}
          </button>
        </div>
      )}
    </section>
  );
}
