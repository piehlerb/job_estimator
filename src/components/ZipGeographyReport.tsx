import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CircleMarker, Map as LeafletMap } from 'leaflet';
import { CalendarDays, MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import type { Job, JobStatus } from '../types';
import AddressCleanupPanel from './AddressCleanupPanel';
import {
  aggregateJobsByZip,
  countZipReportJobs,
  filterJobsByZipDate,
  filterJobsByZipStatus,
} from '../lib/zipGeography';
import type {
  ZipAggregate,
  ZipDateField,
  ZipGeographyReport,
} from '../lib/zipGeography';

interface ZipGeographyReportProps {
  jobs: readonly Job[];
  loading?: boolean;
  onEditJob: (jobId: string) => void;
}

type DatePreset = '30d' | '90d' | 'ytd' | 'all' | 'custom';

const MAP_JOB_STATUSES: readonly JobStatus[] = ['Pending', 'Verbal', 'Won', 'Lost'];
const STATUS_STYLES: Record<JobStatus, { active: string; dot: string }> = {
  Pending: { active: 'border-amber-300 bg-amber-50 text-amber-900', dot: 'bg-amber-500' },
  Verbal: { active: 'border-sky-300 bg-sky-50 text-sky-900', dot: 'bg-sky-500' },
  Won: { active: 'border-emerald-300 bg-emerald-50 text-emerald-900', dot: 'bg-emerald-500' },
  Lost: { active: 'border-rose-300 bg-rose-50 text-rose-900', dot: 'bg-rose-500' },
};

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
function localDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateBounds(preset: DatePreset, customStart: string, customEnd: string) {
  if (preset === 'all') return { start: '', end: '' };
  if (preset === 'custom') return { start: customStart, end: customEnd };

  const today = new Date();
  const end = localDateString(today);
  if (preset === 'ytd') return { start: `${today.getFullYear()}-01-01`, end };

  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  start.setDate(start.getDate() - (preset === '30d' ? 29 : 89));
  return { start: localDateString(start), end };
}

function dateRangeLabel(preset: DatePreset, start: string, end: string): string {
  if (preset === 'all') return 'All time';
  if (preset === '30d') return 'Last 30 days';
  if (preset === '90d') return 'Last 90 days';
  if (preset === 'ytd') return 'Year to date';
  if (start && end) return `${start} through ${end}`;
  if (start) return `Since ${start}`;
  if (end) return `Through ${end}`;
  return 'Custom range';
}

function statusFilterLabel(statuses: readonly JobStatus[]): string {
  if (statuses.length === MAP_JOB_STATUSES.length) return 'All statuses';
  if (statuses.length === 0) return 'No statuses';
  if (statuses.length === 1) return statuses[0];
  return `${statuses.length} statuses`;
}

function percent(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)}%`;
}

function decidedCloseRate(row: Pick<ZipAggregate, 'won' | 'lost'>): number | null {
  const decided = row.won + row.lost;
  return decided > 0 ? (row.won / decided) * 100 : null;
}

function markerRadius(estimates: number): number {
  return Math.min(22, 7 + Math.sqrt(estimates) * 2.5);
}

function markerFill(row: Pick<ZipAggregate, 'state'>): string {
  return row.state === 'NH' ? '#2563eb' : '#16a34a';
}

function createPopupContent(row: ZipAggregate): HTMLDivElement {
  const popup = document.createElement('div');
  popup.className = 'min-w-[12rem] text-slate-900';

  const heading = document.createElement('div');
  heading.className = 'font-bold text-base';
  heading.textContent = `${row.city}, ${row.state} ${row.zip}`;

  const metrics = document.createElement('div');
  metrics.className = 'mt-1 text-sm leading-5';
  metrics.textContent = `${row.estimates} estimates · ${row.won} won · ${row.lost} lost`;

  const closeRate = document.createElement('div');
  closeRate.className = 'mt-1 text-xs text-slate-600';
  closeRate.textContent = `Decided close rate: ${percent(decidedCloseRate(row))}`;

  popup.append(heading, metrics, closeRate);
  return popup;
}

function ExclusionSummary({ report }: { report: ZipGeographyReport }) {
  const { missing, 'invalid-format': invalid, 'out-of-scope-or-unrecognized': unsupported } = report.excluded;
  const excluded = missing + invalid + unsupported;
  if (excluded === 0) return null;

  return (
    <p className="mt-2 text-xs sm:text-sm text-slate-600" role="status">
      {excluded} {excluded === 1 ? 'job needs' : 'jobs need'} address review in this date range: {missing} without a ZIP, {invalid} malformed, and {unsupported} outside or missing from the NH/ME registry.
    </p>
  );
}

function SelectedZipSummary({ row, compact = false }: { row: ZipAggregate | null; compact?: boolean }) {
  if (!row) return null;

  return (
    <aside className={compact ? 'border-t border-slate-200 bg-white p-4' : 'absolute right-4 top-4 z-[500] w-64 rounded-xl border border-white/70 bg-white/95 p-4 shadow-xl backdrop-blur'} aria-live="polite">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Selected market</p>
      <h4 className="mt-1 text-xl font-bold text-slate-900">{row.city}, {row.state}</h4>
      <p className="text-sm font-medium text-slate-500">ZIP {row.zip}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 text-sm">
        <div><dt className="text-xs text-slate-500">Estimates</dt><dd className="font-bold text-slate-900">{row.estimates}</dd></div>
        <div><dt className="text-xs text-slate-500">Close rate</dt><dd className="font-bold text-slate-900">{percent(decidedCloseRate(row))}</dd></div>
        <div><dt className="text-xs text-slate-500">Won</dt><dd className="font-bold text-emerald-700">{row.won}</dd></div>
        <div><dt className="text-xs text-slate-500">Lost</dt><dd className="font-bold text-rose-700">{row.lost}</dd></div>
      </dl>
    </aside>
  );
}

export default function ZipGeographyReport({
  jobs,
  loading = false,
  onEditJob,
}: ZipGeographyReportProps) {
  const [datePreset, setDatePreset] = useState<DatePreset>('ytd');
  const [dateField, setDateField] = useState<ZipDateField>('estimate');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<JobStatus[]>(() => [...MAP_JOB_STATUSES]);
  const [selectedZip, setSelectedZip] = useState<string | null>(null);
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [tileWarning, setTileWarning] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersByZipRef = useRef<Map<string, CircleMarker>>(new Map());

  const bounds = useMemo(
    () => dateBounds(datePreset, customStart, customEnd),
    [datePreset, customStart, customEnd]
  );
  const dateFilteredJobs = useMemo(
    () => filterJobsByZipDate(jobs, dateField, bounds.start, bounds.end),
    [jobs, dateField, bounds.start, bounds.end]
  );
  const statusCounts = useMemo(() => ({
    Pending: countZipReportJobs(filterJobsByZipStatus(dateFilteredJobs, ['Pending'])),
    Verbal: countZipReportJobs(filterJobsByZipStatus(dateFilteredJobs, ['Verbal'])),
    Won: countZipReportJobs(filterJobsByZipStatus(dateFilteredJobs, ['Won'])),
    Lost: countZipReportJobs(filterJobsByZipStatus(dateFilteredJobs, ['Lost'])),
  }), [dateFilteredJobs]);
  const filteredJobs = useMemo(
    () => filterJobsByZipStatus(dateFilteredJobs, selectedStatuses),
    [dateFilteredJobs, selectedStatuses]
  );
  const filteredJobCount = useMemo(() => countZipReportJobs(filteredJobs), [filteredJobs]);
  const totalJobCount = useMemo(() => countZipReportJobs(jobs), [jobs]);
  const report = useMemo(() => aggregateJobsByZip(filteredJobs), [filteredJobs]);
  const selectedRow = report.rows.find((row) => row.zip === selectedZip) ?? report.rows[0] ?? null;
  const selectedZipRef = useRef<string | null>(selectedRow?.zip ?? null);

  const toggleStatus = useCallback((status: JobStatus) => {
    setSelectedStatuses((current) => (
      current.includes(status)
        ? current.filter((selected) => selected !== status)
        : MAP_JOB_STATUSES.filter((candidate) => candidate === status || current.includes(candidate))
    ));
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || report.rows.length === 0) {
      markersByZipRef.current.forEach((marker) => marker.remove());
      markersByZipRef.current.clear();
      if (report.rows.length === 0) setMapStatus('ready');
      return;
    }

    let cancelled = false;
    const rows = report.rows;

    const renderMap = async () => {
      setMapStatus('loading');
      const L = await import('leaflet');
      if (cancelled || !mapContainerRef.current) return;

      let map = mapRef.current;
      if (!map) {
        map = L.map(mapContainerRef.current, {
          attributionControl: true,
          minZoom: 5,
          preferCanvas: true,
          scrollWheelZoom: false,
          zoomControl: true,
        });

        L.tileLayer(OSM_TILE_URL, {
          attribution: OSM_ATTRIBUTION,
          maxZoom: 19,
        })
          .on('tileerror', () => setTileWarning(true))
          .addTo(map);
        mapRef.current = map;
      }

      markersByZipRef.current.forEach((marker) => marker.remove());
      markersByZipRef.current.clear();

      rows.forEach((row) => {
        const isSelected = row.zip === selectedZipRef.current;
        const marker = L.circleMarker([row.lat, row.lon], {
          color: isSelected ? '#0f172a' : '#ffffff',
          fillColor: markerFill(row),
          fillOpacity: 0.88,
          radius: markerRadius(row.estimates),
          weight: isSelected ? 4 : 2,
        })
          .addTo(map)
          .bindTooltip(`${row.city}, ${row.state} ${row.zip} · ${row.estimates} estimate${row.estimates === 1 ? '' : 's'}`, {
            direction: 'top',
            opacity: 0.96,
          })
          .bindPopup(createPopupContent(row))
          .on('click', () => setSelectedZip(row.zip));

        markersByZipRef.current.set(row.zip, marker);
      });

      const visibleBounds = L.latLngBounds(rows.map((row) => [row.lat, row.lon]));
      if (rows.length === 1) {
        map.setView(visibleBounds.getCenter(), 10, { animate: false });
      } else {
        map.fitBounds(visibleBounds, { animate: false, maxZoom: 10, padding: [38, 38] });
      }

      window.requestAnimationFrame(() => map?.invalidateSize());
      setMapStatus('ready');
    };

    renderMap().catch((error) => {
      console.error('Unable to initialize ZIP geography map:', error);
      if (!cancelled) setMapStatus('error');
    });

    return () => {
      cancelled = true;
    };
  }, [report.rows]);

  useEffect(() => {
    const activeZip = selectedRow?.zip;
    selectedZipRef.current = activeZip ?? null;
    markersByZipRef.current.forEach((marker, zip) => {
      marker.setStyle({
        color: zip === activeZip ? '#0f172a' : '#ffffff',
        weight: zip === activeZip ? 4 : 2,
      });
    });
  }, [selectedRow?.zip]);

  useEffect(() => () => {
    markersByZipRef.current.clear();
    mapRef.current?.remove();
    mapRef.current = null;
  }, []);

  const revealZip = useCallback((row: ZipAggregate) => {
    setSelectedZip(row.zip);
    const map = mapRef.current;
    const marker = markersByZipRef.current.get(row.zip);
    if (!map || !marker) return;

    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 9), { duration: 0.55 });
    marker.openPopup();
  }, []);

  if (loading) {
    return <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">Loading ZIP geography…</div>;
  }

  return (
    <section aria-labelledby="zip-geography-heading" className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-1">
        <h2 id="zip-geography-heading" className="text-xl font-semibold text-slate-900 sm:text-2xl">NH &amp; ME ZIP Geography</h2>
        <p className="text-sm text-slate-600">
          Postal city/town names and ZIP centroids are local to the report. Wins are only <strong>Won</strong>; losses are only <strong>Lost</strong>.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <CalendarDays className="h-4 w-4 text-gf-dark-green" aria-hidden="true" />
          Map filters
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-[12rem_minmax(0,1fr)_auto] xl:items-end">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Date based on</span>
            <select value={dateField} onChange={(event) => setDateField(event.target.value as ZipDateField)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-gf-dark-green focus:outline-none focus:ring-2 focus:ring-gf-lime/50">
              <option value="estimate">Estimate date</option>
              <option value="install">Install date</option>
            </select>
          </label>
          <div>
            <span className="text-xs font-medium text-slate-600">Range</span>
            <div className="mt-1 flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
              {([
                ['30d', '30 days'],
                ['90d', '90 days'],
                ['ytd', 'YTD'],
                ['all', 'All time'],
                ['custom', 'Custom'],
              ] as [DatePreset, string][]).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setDatePreset(value)} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${datePreset === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="rounded-lg bg-lime-50 px-3 py-2 text-xs font-medium text-gf-dark-green">
            {filteredJobCount} of {totalJobCount} jobs · {dateRangeLabel(datePreset, bounds.start, bounds.end)} · {statusFilterLabel(selectedStatuses)}
          </p>
        </div>
        {datePreset === 'custom' && (
          <div className="mt-3 grid gap-3 sm:max-w-md sm:grid-cols-2">
            <label className="block"><span className="text-xs font-medium text-slate-600">Start date</span><input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="block"><span className="text-xs font-medium text-slate-600">End date</span><input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
          </div>
        )}
        <div className="mt-4 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-600">Job status</span>
            <div className="flex gap-3 text-xs font-semibold">
              <button type="button" onClick={() => setSelectedStatuses([...MAP_JOB_STATUSES])} className="text-gf-dark-green hover:underline disabled:cursor-default disabled:no-underline" disabled={selectedStatuses.length === MAP_JOB_STATUSES.length}>Select all</button>
              <button type="button" onClick={() => setSelectedStatuses([])} className="text-slate-500 hover:text-slate-900 hover:underline disabled:cursor-default disabled:no-underline" disabled={selectedStatuses.length === 0}>Clear</button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Job status filters">
            {MAP_JOB_STATUSES.map((status) => {
              const selected = selectedStatuses.includes(status);
              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleStatus(status)}
                  className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-gf-lime ${selected ? STATUS_STYLES[status].active : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800'}`}
                >
                  <span className={`h-2 w-2 rounded-full ${selected ? STATUS_STYLES[status].dot : 'bg-slate-300'}`} aria-hidden="true" />
                  {status}
                  <span className="tabular-nums opacity-70">{statusCounts[status]}</span>
                </button>
              );
            })}
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">Estimate date falls back to the job’s created date when an estimate date is unavailable. Install-date filtering excludes jobs without an install date.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4"><p className="text-xs text-slate-500">Mapped Estimates</p><p className="text-2xl font-bold text-slate-900">{report.totals.estimates}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4"><p className="text-xs text-slate-500">Won</p><p className="text-2xl font-bold text-emerald-700">{report.totals.won}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4"><p className="text-xs text-slate-500">Lost</p><p className="text-2xl font-bold text-rose-700">{report.totals.lost}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4"><p className="text-xs text-slate-500">Close Rate (decided)</p><p className="text-2xl font-bold text-slate-900">{percent(decidedCloseRate(report.totals))}</p><p className="mt-1 text-xs text-slate-400">Won ÷ (Won + Lost)</p></div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div><h3 className="font-semibold text-slate-900">Interactive market map</h3><p className="mt-1 text-xs text-slate-600 sm:text-sm">The map automatically fits every ZIP visible in the selected date range. Marker size shows estimate volume.</p><ExclusionSummary report={report} /></div>
          <div className="flex shrink-0 gap-3 text-xs text-slate-600" aria-label="Map legend"><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-blue-600" />NH</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-green-600" />ME</span></div>
        </div>
        <div className="relative isolate z-0 min-h-[28rem] bg-slate-100">
          <div ref={mapContainerRef} className="zip-geography-map h-[28rem] w-full sm:h-[34rem] lg:h-[min(68vh,46rem)] lg:min-h-[36rem]" role="region" aria-label="Interactive street map of filtered Maine and New Hampshire ZIP estimates" />
          {mapStatus === 'loading' && report.rows.length > 0 && <div className="pointer-events-none absolute inset-0 z-[500] grid place-items-center bg-slate-100/80 text-sm font-medium text-slate-600">Loading interactive map…</div>}
          {mapStatus === 'error' && <div className="absolute inset-0 z-[500] grid place-items-center bg-slate-100 p-6 text-center text-sm text-slate-700">The interactive map could not load. Exact ZIP metrics remain available below.</div>}
          {report.rows.length === 0 && mapStatus !== 'error' && <div className="absolute inset-0 z-[500] grid place-items-center bg-slate-100 p-6 text-center"><div><MapPin className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-2 font-medium text-slate-900">No mapped ZIP estimates in this date range.</p><p className="mt-1 text-sm text-slate-600">Try a wider date range or review the addresses below.</p></div></div>}
          {tileWarning && mapStatus === 'ready' && <p className="absolute left-3 top-3 z-[500] max-w-xs rounded-md bg-white/95 px-3 py-2 text-xs text-slate-700 shadow">Some map tiles could not load. ZIP markers and exact metrics remain available.</p>}
          <div className="hidden lg:block"><SelectedZipSummary row={selectedRow} /></div>
        </div>
        <div className="lg:hidden"><SelectedZipSummary row={selectedRow} compact /></div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4 sm:p-5"><h3 className="font-semibold text-slate-900">Exact ZIP metrics</h3><p className="mt-1 text-xs text-slate-600 sm:text-sm">Postal city/town names come from the same local registry as the marker coordinates. Select a row to center it.</p></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem]">
            <thead><tr className="border-b border-slate-200 bg-slate-50"><th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-slate-700">ZIP</th><th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-slate-700">City / town</th><th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-slate-700">State</th><th scope="col" className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Estimates</th><th scope="col" className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Won</th><th scope="col" className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Lost</th><th scope="col" className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Close Rate</th></tr></thead>
            <tbody>{report.rows.length > 0 ? report.rows.map((row) => (
              <tr key={row.zip} className={`border-b border-slate-200 ${selectedRow?.zip === row.zip ? 'bg-lime-50' : 'hover:bg-slate-50'}`}>
                <td className="px-4 py-3"><button type="button" onClick={() => revealZip(row)} className="rounded font-semibold text-gf-dark-green underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-gf-lime">{row.zip}</button></td><td className="px-4 py-3 text-sm font-medium text-slate-900">{row.city}</td><td className="px-4 py-3 text-sm text-slate-700">{row.state}</td><td className="px-4 py-3 text-right text-sm text-slate-900">{row.estimates}</td><td className="px-4 py-3 text-right text-sm text-emerald-700">{row.won}</td><td className="px-4 py-3 text-right text-sm text-rose-700">{row.lost}</td><td className="px-4 py-3 text-right text-sm text-slate-900">{percent(decidedCloseRate(row))}</td>
              </tr>
            )) : <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">No exact ZIP metrics for this date range.</td></tr>}</tbody>
          </table>
        </div>
      </div>

      {/* The address cleanup worklist replaced the ZIP-only repair list that used to
          live here: that covered ME/NH ZIPs on jobs, this covers every address field
          on jobs, leads and customers. See AddressCleanupPanel. */}
      <AddressCleanupPanel onEditJob={onEditJob} />
    </section>
  );
}
