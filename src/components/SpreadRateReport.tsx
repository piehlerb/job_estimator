import { useMemo, useState } from 'react';
import type { Job, JobCalculation } from '../types';
import {
  aggregateSpreadBySystem,
  buildJobSpreadRow,
  SPREAD_SURFACE_LABELS,
  SPREAD_SURFACES,
  spreadVariancePct,
  type JobSpreadRow,
  type SpreadSurface,
} from '../lib/spreadRates';
import { localToday } from '../lib/dateUtils';

interface SpreadRateReportProps {
  jobs: ReadonlyArray<{ job: Job; calc: JobCalculation }>;
  onEditJob: (jobId: string) => void;
  /** Saves the job's ignore flag; absent when the viewer can't edit jobs */
  onToggleExclude?: (job: Job) => Promise<void>;
}

type DatePreset = 'all' | '90d' | 'ytd' | '12m' | 'custom';

function shiftedToday(days: number, months = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function presetBounds(preset: DatePreset, customStart: string, customEnd: string): { start: string; end: string } {
  if (preset === 'all') return { start: '', end: '' };
  if (preset === 'custom') return { start: customStart, end: customEnd };
  const end = localToday();
  if (preset === 'ytd') return { start: `${end.slice(0, 4)}-01-01`, end };
  if (preset === '90d') return { start: shiftedToday(89), end };
  return { start: shiftedToday(0, 12), end };
}

function formatRate(rate: number | undefined): string {
  return rate !== undefined && Number.isFinite(rate) ? rate.toFixed(0) : '—';
}

/** Actual rate with the estimate and variance beneath it */
function RateCell({ estRate, actualRate, note }: { estRate?: number; actualRate?: number; note?: string }) {
  if (actualRate === undefined) {
    return <span className="text-slate-300">—</span>;
  }
  const variance = spreadVariancePct(estRate, actualRate);
  // Fewer sqft per gallon than planned means the job used more material
  const varianceClass = variance === undefined
    ? 'text-slate-400'
    : variance <= -5
      ? 'text-red-600'
      : variance >= 5
        ? 'text-green-700'
        : 'text-slate-500';
  return (
    <div className="leading-tight">
      <div className="font-semibold text-slate-900">{formatRate(actualRate)}</div>
      <div className="text-[11px] text-slate-500">
        est. {formatRate(estRate)}
        {variance !== undefined && (
          <span className={`ml-1 font-medium ${varianceClass}`}>
            {variance > 0 ? '+' : ''}{variance.toFixed(0)}%
          </span>
        )}
      </div>
      {note && <div className="text-[11px] text-slate-400">{note}</div>}
    </div>
  );
}

export default function SpreadRateReport({ jobs, onEditJob, onToggleExclude }: SpreadRateReportProps) {
  const [preset, setPreset] = useState<DatePreset>('ytd');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [systemFilter, setSystemFilter] = useState('all');
  const [savingJobId, setSavingJobId] = useState<string | null>(null);

  const { start, end } = presetBounds(preset, customStart, customEnd);

  // Won jobs with at least one surface's actual recorded, in the date range
  const jobRows = useMemo((): JobSpreadRow[] => {
    return jobs
      .filter(({ job }) => {
        if (job.deleted || job.status !== 'Won' || !job.installDate) return false;
        if (start && job.installDate < start) return false;
        if (end && job.installDate > end) return false;
        return true;
      })
      .map(({ job, calc }) => buildJobSpreadRow(job, calc))
      .filter((row) => row.hasActuals)
      .sort((a, b) => b.job.installDate.localeCompare(a.job.installDate));
  }, [jobs, start, end]);

  const systemOptions = useMemo(() => {
    const names = new Map<string, string>();
    jobRows.forEach((row) => names.set(row.systemId, row.systemName));
    return [...names.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [jobRows]);

  const visibleRows = useMemo(
    () => (systemFilter === 'all' ? jobRows : jobRows.filter((row) => row.systemId === systemFilter)),
    [jobRows, systemFilter]
  );

  const systemAggregates = useMemo(
    () => aggregateSpreadBySystem(visibleRows.filter((row) => !row.job.excludeFromSpreadReport)),
    [visibleRows]
  );

  const ignoredCount = visibleRows.filter((row) => row.job.excludeFromSpreadReport).length;

  const handleToggle = async (job: Job) => {
    if (!onToggleExclude || savingJobId) return;
    setSavingJobId(job.id);
    try {
      await onToggleExclude(job);
    } catch (error) {
      console.error('Error updating job:', error);
      alert('Could not update the job. Please try again.');
    } finally {
      setSavingJobId(null);
    }
  };

  const inputClass = 'px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-gf-lime';

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs sm:text-sm text-slate-600 font-medium">Install Date:</label>
            {([
              { id: 'ytd', label: 'Year to Date' },
              { id: '90d', label: 'Last 90 Days' },
              { id: '12m', label: 'Last 12 Months' },
              { id: 'all', label: 'All Time' },
              { id: 'custom', label: 'Custom' },
            ] as { id: DatePreset; label: string }[]).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setPreset(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  preset === id ? 'bg-gf-lime text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className={inputClass} />
              <span className="text-slate-400 text-sm">to</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className={inputClass} />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs sm:text-sm text-slate-600 font-medium">Chip System:</label>
            <select value={systemFilter} onChange={(e) => setSystemFilter(e.target.value)} className={`${inputClass} bg-white`}>
              <option value="all">All systems</option>
              {systemOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Spread rates are square feet per gallon, per coat — the same unit as the chip system settings. Actual rates come from Won jobs
          whose actuals record coating gallons by floor and vertical (floor-only jobs count their total as floor). Rates are weighted by area.
        </p>
      </div>

      {/* By chip system */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mb-4 sm:mb-6">
        <div className="p-3 sm:p-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">Actual Spread Rates by Chip System</h3>
          {ignoredCount > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">{ignoredCount} ignored job{ignoredCount === 1 ? '' : 's'} left out.</p>
          )}
        </div>
        {systemAggregates.length === 0 ? (
          <div className="p-6 sm:p-8 text-center text-slate-600 text-sm">
            No Won jobs with coating actuals in this range.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 sm:px-4 py-3 text-left font-semibold text-slate-700">System</th>
                  <th className="px-3 sm:px-4 py-3 text-right font-semibold text-slate-700">Jobs</th>
                  {SPREAD_SURFACES.map((surface) => (
                    <th key={surface} className="px-3 sm:px-4 py-3 text-right font-semibold text-slate-700">{SPREAD_SURFACE_LABELS[surface]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {systemAggregates.map((agg) => (
                  <tr key={agg.systemId} className="border-b border-slate-200 align-top">
                    <td className="px-3 sm:px-4 py-3 font-medium text-slate-900">{agg.systemName}</td>
                    <td className="px-3 sm:px-4 py-3 text-right text-slate-700">{agg.jobs}</td>
                    {SPREAD_SURFACES.map((surface) => {
                      const s = agg.surfaces[surface];
                      return (
                        <td key={surface} className="px-3 sm:px-4 py-3 text-right">
                          <RateCell
                            estRate={s.estRate}
                            actualRate={s.actualRate}
                            note={s.jobs > 0 ? `${s.jobs} job${s.jobs === 1 ? '' : 's'} · ${s.actualGallons.toFixed(1)} gal` : undefined}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* By job */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">Spread Rates by Job</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {onToggleExclude
              ? 'Uncheck a job to leave it out of the system averages. The choice is saved on the job.'
              : 'Ignoring a job needs edit access to Jobs.'}
          </p>
        </div>
        {visibleRows.length === 0 ? (
          <div className="p-6 sm:p-8 text-center text-slate-600 text-sm">No jobs to show.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-3 text-center font-semibold text-slate-700">Use</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-700">Job</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-700">Floor / Vert sqft</th>
                  {SPREAD_SURFACES.map((surface) => (
                    <th key={surface} className="px-3 py-3 text-right font-semibold text-slate-700">{SPREAD_SURFACE_LABELS[surface]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const ignored = !!row.job.excludeFromSpreadReport;
                  return (
                    <tr key={row.job.id} className={`border-b border-slate-200 align-top ${ignored ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50'}`}>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={!ignored}
                          disabled={!onToggleExclude || savingJobId === row.job.id}
                          onChange={() => handleToggle(row.job)}
                          title={ignored ? 'Ignored — check to include' : 'Included — uncheck to ignore'}
                          className="w-4 h-4 rounded border-slate-300 text-gf-dark-green focus:ring-gf-lime disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => onEditJob(row.job.id)}
                          className="font-medium text-gf-dark-green hover:underline text-left"
                        >
                          {row.job.name}
                        </button>
                        <div className="text-xs text-slate-500">
                          {row.job.installDate} · {row.systemName}
                          {row.job.spreadRateOverrides && <span className="ml-1 text-amber-700">· custom rates</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right text-slate-700 whitespace-nowrap">
                        {row.job.floorFootage.toLocaleString()} / {row.job.verticalFootage.toLocaleString()}
                      </td>
                      {SPREAD_SURFACES.map((surface: SpreadSurface) => {
                        const s = row.surfaces[surface];
                        return (
                          <td key={surface} className="px-3 py-3 text-right">
                            {s ? (
                              <RateCell
                                estRate={s.estRate}
                                actualRate={s.actualRate}
                                note={s.actualGallons !== undefined ? `${s.actualGallons.toFixed(1)} gal` : undefined}
                              />
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
