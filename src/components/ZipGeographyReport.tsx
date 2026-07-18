import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CircleMarker, Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Job } from '../types';
import { aggregateJobsByZip } from '../lib/zipGeography';
import type { ZipAggregate, ZipGeographyReport } from '../lib/zipGeography';

interface ZipGeographyReportProps {
  jobs: readonly Pick<Job, 'customerAddress' | 'status'>[];
  loading?: boolean;
}

const REGION_BOUNDS: [[number, number], [number, number]] = [
  [42.7, -72.6],
  [47.55, -66.9],
];
const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

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
  popup.className = 'min-w-[11rem] text-slate-900';

  const heading = document.createElement('div');
  heading.className = 'font-bold text-base';
  heading.textContent = `ZIP ${row.zip} · ${row.state}`;

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
    <p className="mt-3 text-xs sm:text-sm text-slate-600" role="status">
      {excluded} {excluded === 1 ? 'job was' : 'jobs were'} excluded: {missing} without a ZIP, {invalid} with a malformed ZIP, and {unsupported} outside the exact NH/ME registry or unrecognized.
    </p>
  );
}

export default function ZipGeographyReport({ jobs, loading = false }: ZipGeographyReportProps) {
  const report = useMemo(() => aggregateJobsByZip(jobs), [jobs]);
  const [selectedZip, setSelectedZip] = useState<string | null>(null);
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [tileWarning, setTileWarning] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersByZipRef = useRef<Map<string, CircleMarker>>(new Map());
  const selectedRow = report.rows.find((row) => row.zip === selectedZip) ?? report.rows[0] ?? null;
  const selectedZipRef = useRef<string | null>(selectedRow?.zip ?? null);

  useEffect(() => {
    if (!mapContainerRef.current || report.rows.length === 0) return;

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

        map.fitBounds(L.latLngBounds(REGION_BOUNDS), { padding: [18, 18] });
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
          .bindTooltip(`ZIP ${row.zip} · ${row.estimates} estimate${row.estimates === 1 ? '' : 's'}`, {
            direction: 'top',
            opacity: 0.96,
          })
          .bindPopup(createPopupContent(row))
          .on('click', () => setSelectedZip(row.zip));

        markersByZipRef.current.set(row.zip, marker);
      });

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
    return <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center text-slate-600">Loading ZIP geography…</div>;
  }

  return (
    <section aria-labelledby="zip-geography-heading" className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-1">
        <h2 id="zip-geography-heading" className="text-xl sm:text-2xl font-semibold text-slate-900">NH &amp; ME ZIP Geography</h2>
        <p className="text-sm text-slate-600">
          Each mapped job is one estimate. Wins are only <strong>Won</strong>; losses are only <strong>Lost</strong>. Pending and Verbal estimates remain in the estimate count.
        </p>
      </div>

      {report.rows.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 sm:p-8 text-center">
          <p className="font-medium text-slate-900">No NH or ME ZIP estimates to map yet.</p>
          <p className="mt-1 text-sm text-slate-600">Add a standalone five-digit ZIP or ZIP+4 to the customer address, or load full job history to include legacy jobs.</p>
          <ExclusionSummary report={report} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
              <p className="text-xs text-slate-500">Mapped Estimates</p>
              <p className="text-2xl font-bold text-slate-900">{report.totals.estimates}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
              <p className="text-xs text-slate-500">Won</p>
              <p className="text-2xl font-bold text-emerald-700">{report.totals.won}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
              <p className="text-xs text-slate-500">Lost</p>
              <p className="text-2xl font-bold text-rose-700">{report.totals.lost}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
              <p className="text-xs text-slate-500">Close Rate (decided)</p>
              <p className="text-2xl font-bold text-slate-900">{percent(decidedCloseRate(report.totals))}</p>
              <p className="text-xs text-slate-400 mt-1">Won ÷ (Won + Lost)</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Interactive ZIP map</h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">Pan and zoom across Maine and New Hampshire. Marker size shows estimates; select a marker for exact results.</p>
            </div>
            <div className="grid lg:grid-cols-[minmax(0,1.55fr)_minmax(15rem,.45fr)]">
              <div className="relative z-0 isolate min-h-[24rem] border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-100">
                <div
                  ref={mapContainerRef}
                  className="zip-geography-map h-[26rem] sm:h-[32rem] w-full"
                  role="region"
                  aria-label="Interactive street map of Maine and New Hampshire ZIP estimate locations"
                />
                {mapStatus === 'loading' && (
                  <div className="pointer-events-none absolute inset-0 z-[500] grid place-items-center bg-slate-100/80 text-sm font-medium text-slate-600">
                    Loading interactive map…
                  </div>
                )}
                {mapStatus === 'error' && (
                  <div className="absolute inset-0 z-[500] grid place-items-center bg-slate-100 p-6 text-center text-sm text-slate-700">
                    The interactive map could not load. Exact ZIP metrics remain available below.
                  </div>
                )}
                {tileWarning && mapStatus === 'ready' && (
                  <p className="absolute left-3 top-3 z-[500] max-w-xs rounded-md bg-white/95 px-3 py-2 text-xs text-slate-700 shadow">
                    Some map tiles could not load. ZIP markers and the exact table remain available.
                  </p>
                )}
              </div>
              <aside className="p-4 sm:p-5" aria-live="polite">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected ZIP</p>
                {selectedRow && (
                  <>
                    <h4 className="mt-1 text-2xl font-bold text-slate-900">{selectedRow.zip} <span className="text-sm font-medium text-slate-500">{selectedRow.state}</span></h4>
                    <dl className="mt-4 space-y-3 text-sm">
                      <div className="flex justify-between gap-3"><dt className="text-slate-600">Estimates</dt><dd className="font-semibold text-slate-900">{selectedRow.estimates}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-slate-600">Won</dt><dd className="font-semibold text-emerald-700">{selectedRow.won}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-slate-600">Lost</dt><dd className="font-semibold text-rose-700">{selectedRow.lost}</dd></div>
                      <div className="flex justify-between gap-3 border-t border-slate-200 pt-3"><dt className="text-slate-600">Close rate</dt><dd className="font-semibold text-slate-900">{percent(decidedCloseRate(selectedRow))}</dd></div>
                    </dl>
                  </>
                )}
                <div className="mt-6 space-y-2 border-t border-slate-200 pt-4 text-xs text-slate-600" aria-label="Map legend">
                  <p><span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-600 mr-1.5" />New Hampshire ZIP</p>
                  <p><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-600 mr-1.5" />Maine ZIP</p>
                  <p>Marker size = estimates</p>
                  <p className="pt-2 text-slate-400">Street-map tiles require an internet connection. Metrics remain local.</p>
                </div>
              </aside>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Exact ZIP metrics</h3>
              <p className="mt-1 text-xs sm:text-sm text-slate-600">Select a ZIP to center it on the map. Close rate uses decided estimates only: Won ÷ (Won + Lost).</p>
              <ExclusionSummary report={report} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[38rem]">
                <thead><tr className="bg-slate-50 border-b border-slate-200">
                  <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-slate-700">ZIP</th>
                  <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-slate-700">State</th>
                  <th scope="col" className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Estimates</th>
                  <th scope="col" className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Won</th>
                  <th scope="col" className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Lost</th>
                  <th scope="col" className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Close Rate</th>
                </tr></thead>
                <tbody>{report.rows.map((row) => (
                  <tr key={row.zip} className={`border-b border-slate-200 ${selectedRow?.zip === row.zip ? 'bg-lime-50' : 'hover:bg-slate-50'}`}>
                    <td className="px-4 py-3"><button type="button" onClick={() => revealZip(row)} className="font-semibold text-gf-dark-green underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-gf-lime rounded">{row.zip}</button></td>
                    <td className="px-4 py-3 text-sm text-slate-700">{row.state}</td>
                    <td className="px-4 py-3 text-sm text-right text-slate-900">{row.estimates}</td>
                    <td className="px-4 py-3 text-sm text-right text-emerald-700">{row.won}</td>
                    <td className="px-4 py-3 text-sm text-right text-rose-700">{row.lost}</td>
                    <td className="px-4 py-3 text-sm text-right text-slate-900">{percent(decidedCloseRate(row))}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
