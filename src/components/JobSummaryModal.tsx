import { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { getDefaultCosts, getDefaultPricing } from '../lib/db';
import { calculateJobOutputs } from '../lib/calculations';
import { normalizeChipBlendName } from '../lib/syncHelpers';
import {
  Job,
  Costs,
  Pricing,
  BaseCoatInventory,
  TopCoatInventory,
  ChipInventory,
  TintInventory,
} from '../types';

interface JobSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: Job[];
  baseCoatInventory: BaseCoatInventory;
  topCoatInventory: TopCoatInventory;
  chipInventory: ChipInventory[];
  tintInventory: TintInventory[];
  currentCosts: Costs;
  currentPricing: Pricing;
}

interface JobMaterialRow {
  job: Job;
  baseA: number;
  baseBGrey: number;
  baseBTan: number;
  baseBClear: number;
  topA: number;
  topB: number;
  chipBlend: string | null;
  chipLbs: number;
  tintColor: string | null;
  tintOz: number;
}

function parseLocalDate(dateStr: string): Date {
  // Parse YYYY-MM-DD without UTC offset issues
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(dateStr: string): string {
  try {
    const d = parseLocalDate(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

interface MaterialRowProps {
  label: string;
  unit: string;
  required: number;
  onHand: number;
}

function MaterialRow({ label, unit, required, onHand }: MaterialRowProps) {
  const diff = onHand - required;
  return (
    <tr className="border-b border-slate-100">
      <td className="py-2 px-4 text-slate-700">{label}</td>
      <td className="py-2 px-4 text-right text-slate-500 text-xs">{unit}</td>
      <td className="py-2 px-4 text-right">{required.toFixed(2)}</td>
      <td className="py-2 px-4 text-right">{onHand.toFixed(2)}</td>
      <td className={`py-2 px-4 text-right font-semibold ${diff < 0 ? 'text-red-600' : 'text-green-600'}`}>
        {diff >= 0 ? '+' : ''}{diff.toFixed(2)}
      </td>
    </tr>
  );
}

export default function JobSummaryModal({
  isOpen,
  onClose,
  jobs,
  baseCoatInventory,
  topCoatInventory,
  chipInventory,
  tintInventory,
  currentCosts,
  currentPricing,
}: JobSummaryModalProps) {
  const [dayWindow, setDayWindow] = useState(30);
  const [ignoredJobIds, setIgnoredIds] = useState<Set<string>>(new Set());

  // Reset ignored state when modal opens
  useEffect(() => {
    if (isOpen) setIgnoredIds(new Set());
  }, [isOpen]);

  const getMergedCosts = (job: Job): Costs => ({
    ...getDefaultCosts(),
    ...job.costsSnapshot,
    antiSlipCostPerGal: job.costsSnapshot.antiSlipCostPerGal ?? currentCosts.antiSlipCostPerGal,
    abrasionResistanceCostPerGal:
      job.costsSnapshot.abrasionResistanceCostPerGal ?? currentCosts.abrasionResistanceCostPerGal,
  });

  const getMergedPricing = (job: Job): Pricing =>
    job.pricingSnapshot
      ? { ...getDefaultPricing(), ...job.pricingSnapshot }
      : currentPricing;

  // Filter and sort jobs within the day window
  const filteredJobs = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today);
    cutoff.setDate(today.getDate() + dayWindow);

    return jobs
      .filter((job) => {
        if (!job.installDate || job.deleted || job.status !== 'Won') return false;
        const jobDate = parseLocalDate(job.installDate);
        return jobDate >= today && jobDate <= cutoff;
      })
      .sort((a, b) => a.installDate.localeCompare(b.installDate));
  }, [jobs, dayWindow]);

  // Compute per-job material requirements
  const jobMaterials = useMemo((): JobMaterialRow[] => {
    return filteredJobs.map((job) => {
      const mergedCosts = getMergedCosts(job);
      const mergedPricing = getMergedPricing(job);

      const calc = calculateJobOutputs(
        {
          floorFootage: job.floorFootage,
          verticalFootage: job.verticalFootage,
          crackFillFactor: job.crackFillFactor,
          travelDistance: job.travelDistance,
          installDate: job.installDate,
          installDays: job.installDays,
          jobHours: job.jobHours,
          totalPrice: job.totalPrice,
          includeBasecoatTint: job.includeBasecoatTint || false,
          includeTopcoatTint: job.includeTopcoatTint || false,
          antiSlip: job.antiSlip || false,
          abrasionResistance: job.abrasionResistance || false,
          cyclo1Topcoat: job.cyclo1Topcoat || false,
          cyclo1Coats: job.cyclo1Coats || 0,
          coatingRemoval: job.coatingRemoval || 'None',
          moistureMitigation: job.moistureMitigation || false,
          tags: job.tags,
          installSchedule: job.installSchedule,
        },
        job.systemSnapshot,
        mergedCosts,
        job.laborersSnapshot,
        mergedPricing
      );

      // Basecoat split by color
      const bg = calc.baseGallons;
      let baseA = 0, baseBGrey = 0, baseBTan = 0, baseBClear = 0;
      if (job.baseColor === 'Grey') {
        baseA = bg / 3;
        baseBGrey = (bg * 2) / 3;
      } else if (job.baseColor === 'Tan') {
        baseA = bg / 3;
        baseBTan = (bg * 2) / 3;
      } else if (job.baseColor === 'Clear') {
        baseA = bg / 3;
        baseBClear = (bg * 2) / 3;
      } else {
        // No color set — Base A only (consistent with Inventory.tsx commitment logic)
        baseA = bg / 3;
      }

      const topA = calc.topGallons * 0.5;
      const topB = calc.topGallons * 0.5;

      const chipBlend = job.chipBlend ? normalizeChipBlendName(job.chipBlend) : null;
      const chipLbs = calc.chipNeeded * 40;

      const hasTint = job.includeBasecoatTint || job.includeTopcoatTint;
      const tintColor = hasTint && job.tintColor ? job.tintColor : null;
      const tintOz = calc.tintNeeded;

      return { job, baseA, baseBGrey, baseBTan, baseBClear, topA, topB, chipBlend, chipLbs, tintColor, tintOz };
    });
  }, [filteredJobs, currentCosts, currentPricing]);

  // Aggregate totals for non-ignored jobs
  const totals = useMemo(() => {
    const activeRows = jobMaterials.filter((r) => !ignoredJobIds.has(r.job.id));

    const baseA = activeRows.reduce((s, r) => s + r.baseA, 0);
    const baseBGrey = activeRows.reduce((s, r) => s + r.baseBGrey, 0);
    const baseBTan = activeRows.reduce((s, r) => s + r.baseBTan, 0);
    const baseBClear = activeRows.reduce((s, r) => s + r.baseBClear, 0);
    const topA = activeRows.reduce((s, r) => s + r.topA, 0);
    const topB = activeRows.reduce((s, r) => s + r.topB, 0);

    const chipByBlend: Record<string, number> = {};
    for (const r of activeRows) {
      if (r.chipBlend && r.chipLbs > 0) {
        chipByBlend[r.chipBlend] = (chipByBlend[r.chipBlend] || 0) + r.chipLbs;
      }
    }

    const tintByColor: Record<string, number> = {};
    for (const r of activeRows) {
      if (r.tintColor && r.tintOz > 0) {
        tintByColor[r.tintColor] = (tintByColor[r.tintColor] || 0) + r.tintOz;
      }
    }

    // All chip blends: union of required blends + inventory blends (where either > 0)
    const allChipBlendsSet = new Set<string>([
      ...Object.keys(chipByBlend),
      ...chipInventory
        .filter((c) => c.pounds > 0)
        .map((c) => normalizeChipBlendName(c.blend)),
    ]);
    const allChipBlends = [...allChipBlendsSet].sort();

    // All tint colors: union of required colors + inventory colors
    const allTintColorsSet = new Set<string>([
      ...Object.keys(tintByColor),
      ...tintInventory.filter((t) => t.ounces > 0).map((t) => t.color),
    ]);
    const allTintColors = [...allTintColorsSet].sort();

    return { baseA, baseBGrey, baseBTan, baseBClear, topA, topB, chipByBlend, tintByColor, allChipBlends, allTintColors };
  }, [jobMaterials, ignoredJobIds, chipInventory, tintInventory]);

  const toggleIgnored = (jobId: string) => {
    setIgnoredIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const statusBadgeClass = (status: string) => {
    if (status === 'Won') return 'inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700';
    if (status === 'Pending') return 'inline-block px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700';
    return 'inline-block px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600';
  };

  if (!isOpen) return null;

  const activeCount = filteredJobs.length - ignoredJobIds.size;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Job Summary</h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Next
            <input
              type="number"
              min="1"
              max="365"
              value={dayWindow}
              onChange={(e) => setDayWindow(Math.max(1, parseInt(e.target.value) || 30))}
              className="w-20 px-2 py-1 border border-slate-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-gf-lime"
            />
            days
          </label>
          <span className="text-sm text-slate-500">
            {activeCount} of {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-auto p-6 space-y-6">

        {/* Per-job table */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">Upcoming Jobs</h3>
            <p className="text-xs text-slate-500 mt-0.5">Check "Ignore" to exclude a job from the material totals below.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="py-3 px-3 text-left font-semibold text-slate-600 w-16">Ignore</th>
                  <th className="py-3 px-3 text-left font-semibold text-slate-600">Job</th>
                  <th className="py-3 px-3 text-left font-semibold text-slate-600">Customer</th>
                  <th className="py-3 px-3 text-left font-semibold text-slate-600">Install Date</th>
                  <th className="py-3 px-3 text-left font-semibold text-slate-600">Status</th>
                  <th className="py-3 px-3 text-right font-semibold text-slate-600">Base A (gal)</th>
                  <th className="py-3 px-3 text-left font-semibold text-slate-600">Base B</th>
                  <th className="py-3 px-3 text-right font-semibold text-slate-600">Top A (gal)</th>
                  <th className="py-3 px-3 text-right font-semibold text-slate-600">Top B (gal)</th>
                  <th className="py-3 px-3 text-left font-semibold text-slate-600">Chip</th>
                  <th className="py-3 px-3 text-left font-semibold text-slate-600">Tint</th>
                </tr>
              </thead>
              <tbody>
                {jobMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-slate-400">
                      No jobs scheduled in the next {dayWindow} days
                    </td>
                  </tr>
                ) : (
                  jobMaterials.map((row) => {
                    const ignored = ignoredJobIds.has(row.job.id);
                    return (
                      <tr
                        key={row.job.id}
                        className={`border-b border-slate-100 ${ignored ? 'opacity-40' : 'hover:bg-slate-50'}`}
                      >
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={ignored}
                            onChange={() => toggleIgnored(row.job.id)}
                            className="w-4 h-4 rounded border-slate-300 accent-gf-lime cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-800">{row.job.name}</td>
                        <td className="py-3 px-3 text-slate-600">{row.job.customerName || '–'}</td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{formatDate(row.job.installDate)}</td>
                        <td className="py-3 px-3">
                          <span className={statusBadgeClass(row.job.status)}>{row.job.status}</span>
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums">{row.baseA.toFixed(2)}</td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {row.baseBGrey > 0 && <span>Grey {row.baseBGrey.toFixed(2)}</span>}
                          {row.baseBTan > 0 && <span>Tan {row.baseBTan.toFixed(2)}</span>}
                          {row.baseBClear > 0 && <span>Clear {row.baseBClear.toFixed(2)}</span>}
                          {!row.baseBGrey && !row.baseBTan && !row.baseBClear && <span className="text-slate-400">–</span>}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums">{row.topA.toFixed(2)}</td>
                        <td className="py-3 px-3 text-right tabular-nums">{row.topB.toFixed(2)}</td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {row.chipBlend && row.chipLbs > 0
                            ? <span>{row.chipBlend} <span className="tabular-nums">{row.chipLbs.toFixed(0)} lbs</span></span>
                            : <span className="text-slate-400">–</span>
                          }
                        </td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {row.tintColor && row.tintOz > 0
                            ? <span>{row.tintColor} <span className="tabular-nums">{row.tintOz.toFixed(1)} oz</span></span>
                            : <span className="text-slate-400">–</span>
                          }
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Material totals vs inventory */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">Material Requirements vs. Inventory</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Based on {activeCount} active job{activeCount !== 1 ? 's' : ''}.
              {' '}Difference = On Hand − Required.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="py-3 px-4 text-left font-semibold text-slate-600">Material</th>
                  <th className="py-3 px-4 text-left font-semibold text-slate-600">Unit</th>
                  <th className="py-3 px-4 text-right font-semibold text-slate-600">Required</th>
                  <th className="py-3 px-4 text-right font-semibold text-slate-600">On Hand</th>
                  <th className="py-3 px-4 text-right font-semibold text-slate-600">Difference</th>
                </tr>
              </thead>
              <tbody>
                {/* Basecoat */}
                {totals.baseA > 0 && <MaterialRow label="Base A" unit="gal" required={totals.baseA} onHand={baseCoatInventory.baseA} />}
                {totals.baseBGrey > 0 && <MaterialRow label="Base B Grey" unit="gal" required={totals.baseBGrey} onHand={baseCoatInventory.baseBGrey} />}
                {totals.baseBTan > 0 && <MaterialRow label="Base B Tan" unit="gal" required={totals.baseBTan} onHand={baseCoatInventory.baseBTan} />}
                {totals.baseBClear > 0 && <MaterialRow label="Base B Clear" unit="gal" required={totals.baseBClear} onHand={baseCoatInventory.baseBClear} />}

                {/* Topcoat */}
                {totals.topA > 0 && <MaterialRow label="Top A" unit="gal" required={totals.topA} onHand={topCoatInventory.topA} />}
                {totals.topB > 0 && <MaterialRow label="Top B" unit="gal" required={totals.topB} onHand={topCoatInventory.topB} />}

                {/* Chip by blend */}
                {totals.allChipBlends.map((blend) => {
                  const required = totals.chipByBlend[blend] || 0;
                  const inv = chipInventory.find((c) => normalizeChipBlendName(c.blend) === blend);
                  const onHand = inv?.pounds || 0;
                  if (required === 0) return null;
                  return (
                    <MaterialRow
                      key={`chip-${blend}`}
                      label={`Chip — ${blend}`}
                      unit="lbs"
                      required={required}
                      onHand={onHand}
                    />
                  );
                })}

                {/* Tint by color */}
                {totals.allTintColors.map((color) => {
                  const required = totals.tintByColor[color] || 0;
                  const inv = tintInventory.find((t) => t.color === color);
                  const onHand = inv?.ounces || 0;
                  if (required === 0) return null;
                  return (
                    <MaterialRow
                      key={`tint-${color}`}
                      label={`Tint — ${color}`}
                      unit="oz"
                      required={required}
                      onHand={onHand}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
