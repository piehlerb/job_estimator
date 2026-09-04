import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MapPin,
  Search,
  Wrench,
} from 'lucide-react';
import {
  applyProposalToCustomer,
  applyProposalToJob,
  applyProposalToLead,
  buildAddressBackfillPreview,
  buildZipFillGroups,
  resolveByHand,
  type AddressProposalRow,
} from '../lib/addressBackfill';
import { parseAddress } from '../lib/addressParse';
import { getAllCustomers, getAllJobs, getAllLeads, updateCustomer, updateJob, updateLead } from '../lib/db';
import type { AddressFieldSet } from '../lib/addressFields';

/**
 * The address cleanup worklist.
 *
 * Replaces the ZIP-review block that used to live in the geography report: that
 * one only covered ME/NH ZIPs on jobs, and this covers every address field on
 * jobs, leads and customers.
 *
 * Three sections, in the order the work actually gets done:
 *
 *   1. Fill automatically — everything the parser resolved deterministically.
 *      Gated rather than run at startup, because it touches every record at once
 *      and the whole point of tiers is that a person sees them first.
 *   2. Conflicts — the ZIP disagrees with the typed town. Never auto-resolved:
 *      trusting either side would launder a data-entry error into clean-looking
 *      data that nothing downstream would question.
 *   3. Unresolved — nothing to go on. Fix by hand, or open the record.
 *
 * Anything resolved here is stamped confirmed, so no later pass can revert it.
 */

interface Props {
  onEditJob: (jobId: string) => void;
  /** Bumped by the parent after a save elsewhere, to force a re-read. */
  refreshKey?: number;
}

type Busy = false | 'backfill' | string;

export default function AddressCleanupPanel({ onEditJob, refreshKey }: Props) {
  const [rows, setRows] = useState<{ jobs: number; leads: number; customers: number } | null>(null);
  const [preview, setPreview] = useState<ReturnType<typeof buildAddressBackfillPreview> | null>(null);
  const [busy, setBusy] = useState<Busy>(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [jobs, leads, customers] = await Promise.all([
        getAllJobs(),
        getAllLeads(),
        getAllCustomers(),
      ]);
      setRows({ jobs: jobs.length, leads: leads.length, customers: customers.length });
      setPreview(buildAddressBackfillPreview(jobs, leads, customers));
    } catch (err) {
      console.error('[AddressCleanup] failed to load', err);
      setError('Could not read local records. Try reloading.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const writeRow = useCallback(async (row: AddressProposalRow, fields: AddressFieldSet) => {
    const now = new Date().toISOString();
    if (row.entityType === 'job') {
      const job = (await getAllJobs()).find((item) => item.id === row.id);
      if (job) await updateJob(applyProposalToJob(job, fields, now));
    } else if (row.entityType === 'lead') {
      const lead = (await getAllLeads()).find((item) => item.id === row.id);
      if (lead) await updateLead(applyProposalToLead(lead, fields, now));
    } else {
      const customer = (await getAllCustomers()).find((item) => item.id === row.id);
      if (customer) await updateCustomer(applyProposalToCustomer(customer, fields, now));
    }
  }, []);

  const applyBackfill = async () => {
    if (!preview) return;
    setBusy('backfill');
    setMessage('');
    setError('');
    try {
      for (const row of preview.applicable) {
        await writeRow(row, row.proposed);
      }
      setMessage(`Filled ${preview.applicable.length} address${preview.applicable.length === 1 ? '' : 'es'}.`);
      await load();
    } catch (err) {
      console.error('[AddressCleanup] backfill failed', err);
      setError('Some records could not be updated. The list has been refreshed.');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const applyZipGroup = async (city: string, state: string, zip: string, groupRows: AddressProposalRow[]) => {
    setBusy(`${state}|${city}`);
    setMessage('');
    setError('');
    try {
      for (const row of groupRows) {
        // Stamped confirmed: a person chose to accept this town's only ZIP.
        await writeRow(row, resolveByHand(row.proposed, { zip }));
      }
      setMessage(`Set ${zip} on ${groupRows.length} record${groupRows.length === 1 ? '' : 's'} in ${city}.`);
      await load();
    } catch (err) {
      console.error('[AddressCleanup] bulk zip fill failed', err);
      setError('Some records could not be updated. The list has been refreshed.');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const resolveConflict = async (row: AddressProposalRow, keep: 'typed' | 'zip') => {
    setBusy(row.id);
    setMessage('');
    setError('');
    try {
      const parsed = parseAddress(row.raw);
      // parseAddress reports the ZIP's own town in the note; re-parsing without the
      // typed town is not possible, so the two candidates come from the proposal.
      const fields: AddressFieldSet =
        keep === 'zip'
          ? { ...row.proposed, city: parsed.city, state: parsed.state, zip: parsed.zip }
          : { ...row.proposed, city: row.current.city ?? parsed.city };
      await writeRow(row, resolveByHand(fields, {}));
      setMessage('Address confirmed.');
      await load();
    } catch (err) {
      console.error('[AddressCleanup] conflict resolution failed', err);
      setError('Could not update that record.');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const zipGroups = useMemo(
    () => (preview ? buildZipFillGroups([...preview.applicable, ...preview.unresolved]) : []),
    [preview]
  );

  const filteredUnresolved = useMemo(() => {
    if (!preview) return [];
    const needle = search.trim().toLowerCase();
    if (!needle) return preview.unresolved;
    return preview.unresolved.filter(
      (row) =>
        row.label.toLowerCase().includes(needle) || (row.raw ?? '').toLowerCase().includes(needle)
    );
  }, [preview, search]);

  if (error && !preview) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{error}</div>
    );
  }

  if (!preview || !rows) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        <Loader2 className="mx-auto h-5 w-5 animate-spin" aria-hidden="true" />
        <p className="mt-2">Checking addresses…</p>
      </div>
    );
  }

  const total = rows.jobs + rows.leads + rows.customers;
  const outstanding = preview.applicable.length + preview.conflicts.length + preview.unresolved.length;

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-lime-100 p-2 text-gf-dark-green">
            <MapPin className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900">Address cleanup</h3>
            <p className="mt-1 text-xs text-slate-600 sm:text-sm">
              Structured street, town, state and ZIP for every job, lead and customer. The free-text
              address is never changed — it stays the record of what was typed.
            </p>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 p-3">
            <dt className="text-xs text-slate-500">Records</dt>
            <dd className="text-xl font-bold text-slate-900">{total}</dd>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <dt className="text-xs text-slate-500">Already complete</dt>
            <dd className="text-xl font-bold text-gf-dark-green">{preview.settledCount}</dd>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <dt className="text-xs text-slate-500">Can fill automatically</dt>
            <dd className="text-xl font-bold text-slate-900">{preview.applicable.length}</dd>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <dt className="text-xs text-slate-500">Need a person</dt>
            <dd className="text-xl font-bold text-amber-700">
              {preview.conflicts.length + preview.unresolved.length}
            </dd>
          </div>
        </dl>

        {message && (
          <p className="mt-3 text-sm font-medium text-gf-dark-green" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="mt-3 text-sm font-medium text-rose-700" role="alert">
            {error}
          </p>
        )}
        {outstanding === 0 && (
          <p className="mt-3 flex items-center gap-2 text-sm font-medium text-gf-dark-green">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Every address is resolved.
          </p>
        )}
      </div>

      {preview.applicable.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h4 className="font-semibold text-slate-900">
                Fill automatically <span className="text-slate-400">({preview.applicable.length})</span>
              </h4>
              <p className="mt-1 text-xs text-slate-600">
                Every one of these came out of a ZIP lookup or an unambiguous town. Review below,
                then apply.
              </p>
            </div>
            <button
              type="button"
              onClick={applyBackfill}
              disabled={busy !== false}
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-gf-dark-green px-4 py-2 text-sm font-semibold text-white hover:bg-gf-dark-green/90 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busy === 'backfill' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              )}
              Apply {preview.applicable.length}
            </button>
          </div>
          <div className="max-h-72 overflow-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-2 font-semibold">Record</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Address as typed</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Will be recorded as</th>
                </tr>
              </thead>
              <tbody>
                {preview.applicable.slice(0, 200).map((row) => (
                  <tr key={`${row.entityType}-${row.id}`} className="border-t border-slate-100">
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-900">{row.label}</div>
                      <div className="text-xs text-slate-500">{row.entityType}</div>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{row.raw || '—'}</td>
                    <td className="px-4 py-2 text-slate-800">
                      {[row.proposed.street, row.proposed.city, row.proposed.state, row.proposed.zip]
                        .filter(Boolean)
                        .join(', ')}
                      {row.proposed.tier && row.proposed.tier !== 'A' && (
                        <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                          {row.proposed.tier}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.applicable.length > 200 && (
              <p className="px-4 py-2 text-xs text-slate-500">
                Showing the first 200. Applying covers all {preview.applicable.length}.
              </p>
            )}
          </div>
        </div>
      )}

      {zipGroups.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4 sm:p-5">
            <h4 className="font-semibold text-slate-900">Fill a ZIP by town</h4>
            <p className="mt-1 text-xs text-slate-600">
              These towns are served by exactly one street-delivery ZIP, so the whole group can be
              set at once. Towns served by several are left out — the street decides which.
            </p>
          </div>
          <ul className="divide-y divide-slate-200">
            {zipGroups.map((group) => (
              <li
                key={`${group.state}-${group.city}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {group.city}, {group.state}
                  </p>
                  <p className="text-xs text-slate-500">
                    {group.rows.length} record{group.rows.length === 1 ? '' : 's'} · ZIP {group.zip}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => applyZipGroup(group.city, group.state, group.zip, group.rows)}
                  disabled={busy !== false}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-gf-dark-green px-3 py-1.5 text-xs font-semibold text-gf-dark-green hover:bg-lime-50 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {busy === `${group.state}|${group.city}` && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  )}
                  Set {group.zip}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview.conflicts.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
          <div className="border-b border-amber-200 bg-amber-50/70 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="rounded-lg bg-amber-100 p-2 text-amber-800">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h4 className="font-semibold text-slate-900">
                  ZIP disagrees with the town{' '}
                  <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs text-amber-900">
                    {preview.conflicts.length}
                  </span>
                </h4>
                <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                  Nothing was recorded for these. One of the two is a typo, and guessing which would
                  bury the mistake in data that looks clean.
                </p>
              </div>
            </div>
          </div>
          <ul className="divide-y divide-slate-200">
            {preview.conflicts.map((row) => {
              const parsed = parseAddress(row.raw);
              return (
                <li key={`${row.entityType}-${row.id}`} className="px-4 py-3 sm:px-5">
                  <p className="text-sm font-medium text-slate-900">{row.label}</p>
                  <p className="text-sm text-slate-600">{row.raw}</p>
                  <p className="mt-1 text-xs text-amber-800">{row.note || parsed.note}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => resolveConflict(row, 'zip')}
                      disabled={busy !== false}
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-45"
                    >
                      Use the ZIP&apos;s town
                      {parsed.city ? ` (${parsed.city} ${parsed.zip ?? ''})` : ''}
                    </button>
                    {row.entityType === 'job' && (
                      <button
                        type="button"
                        onClick={() => onEditJob(row.id)}
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-gf-dark-green hover:bg-lime-50"
                      >
                        Open job <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {preview.unresolved.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="rounded-lg bg-slate-100 p-2 text-slate-600">
                <Wrench className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-slate-900">
                  Nothing to go on <span className="text-slate-400">({preview.unresolved.length})</span>
                </h4>
                <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                  No recognizable town or ZIP — a typo, a missing address, or somewhere outside Maine
                  and New Hampshire. Open the record and enter the details.
                </p>
              </div>
            </div>
            <label className="relative mt-3 block max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter by name or address"
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-gf-dark-green focus:outline-none focus:ring-2 focus:ring-gf-lime/50"
              />
            </label>
          </div>
          <ul className="max-h-96 divide-y divide-slate-200 overflow-auto">
            {filteredUnresolved.map((row) => (
              <li
                key={`${row.entityType}-${row.id}`}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{row.label}</p>
                  <p className="truncate text-sm text-slate-600">{row.raw || 'No address entered'}</p>
                  {row.note && <p className="mt-0.5 text-xs text-slate-500">{row.note}</p>}
                </div>
                {row.entityType === 'job' ? (
                  <button
                    type="button"
                    onClick={() => onEditJob(row.id)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-gf-dark-green hover:bg-lime-50"
                  >
                    Open job <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </button>
                ) : (
                  <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {row.entityType}
                  </span>
                )}
              </li>
            ))}
            {filteredUnresolved.length === 0 && (
              <li className="p-8 text-center text-sm text-slate-500">Nothing matches that filter.</li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
