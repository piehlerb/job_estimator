import { ArrowLeft, Printer } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getJob } from '../lib/db';
import { Job, JobCalculation, CoatingPart } from '../types';
import { calculateJobOutputs } from '../lib/calculations';
import { resolveJobMaterials, ResolvedCoatingLine, ResolvedTintLine } from '../lib/materialAllocation';

interface JobSheetProps {
  jobId: string;
  onBack: () => void;
}

const PART_LABELS: Record<CoatingPart, string> = {
  topA: 'Top A',
  topB: 'Top B',
  baseA: 'Base A',
  baseB: 'Base B',
};

/**
 * Card label: 'Base B (Grey)', 'Top A (Slow Cure)', 'Base A'. Default variants
 * (Original/Normal) stay implicit — except on a colorless part split across
 * flavors, where the variant is the only thing telling the cards apart.
 */
function coatingCardLabel(line: ResolvedCoatingLine, splitPart: boolean): string {
  const isDefaultVariant = line.variant === 'Normal' || line.variant === 'Original';
  const needsVariant = !isDefaultVariant || (splitPart && !line.color);
  const detail = [line.variant && needsVariant ? line.variant : null, line.color]
    .filter(Boolean)
    .join(' ');
  return detail ? `${PART_LABELS[line.part]} (${detail})` : PART_LABELS[line.part];
}

interface MaterialCardProps {
  label: string;
  value: string;
  unit: string;
  overridden?: boolean;
}

function MaterialCard({ label, value, unit, overridden }: MaterialCardProps) {
  if (overridden) {
    return (
      <div className="bg-amber-50 border-2 border-amber-400 p-3 rounded-lg text-center">
        <span className="text-xs text-amber-900 font-semibold block">{label}</span>
        <span className="text-xl font-bold text-amber-900">{value}</span>
        <span className="text-xs text-amber-900 block">{unit}</span>
        <span className="mt-1 inline-block px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 text-[10px] font-bold uppercase tracking-wide">
          Override
        </span>
      </div>
    );
  }
  return (
    <div className="bg-green-50 p-3 rounded-lg text-center">
      <span className="text-xs text-gf-dark-green block">{label}</span>
      <span className="text-xl font-bold text-gf-dark-green">{value}</span>
      <span className="text-xs text-gf-dark-green block">{unit}</span>
    </div>
  );
}

export default function JobSheet({ jobId, onBack }: JobSheetProps) {
  const [job, setJob] = useState<Job | null>(null);
  const [calculation, setCalculation] = useState<JobCalculation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJob();
  }, [jobId]);

  const loadJob = async () => {
    setLoading(true);
    try {
      const loadedJob = await getJob(jobId);
      if (loadedJob) {
        setJob(loadedJob);

        // Calculate job outputs using snapshots
        const calc = calculateJobOutputs(
          {
            floorFootage: loadedJob.floorFootage,
            verticalFootage: loadedJob.verticalFootage,
            crackFillFactor: loadedJob.crackFillFactor,
            travelDistance: loadedJob.travelDistance,
            installDate: loadedJob.installDate,
            installDays: loadedJob.installDays,
            jobHours: loadedJob.jobHours,
            totalPrice: loadedJob.totalPrice,
            products: loadedJob.products,
            includeBasecoatTint: loadedJob.includeBasecoatTint || false,
            includeTopcoatTint: loadedJob.includeTopcoatTint || false,
            antiSlip: loadedJob.antiSlip || false,
            abrasionResistance: loadedJob.abrasionResistance || false,
            cyclo1Topcoat: loadedJob.cyclo1Topcoat || false,
            cyclo1Coats: loadedJob.cyclo1Coats || 0,
            coatingRemoval: loadedJob.coatingRemoval || 'None',
            moistureMitigation: loadedJob.moistureMitigation || false,
            installSchedule: loadedJob.installSchedule,
            tags: loadedJob.tags,
          },
          loadedJob.systemSnapshot,
          loadedJob.costsSnapshot,
          loadedJob.laborersSnapshot,
          loadedJob.pricingSnapshot || {
            id: 'default',
            verticalPricePerSqft: 0,
            antiSlipPricePerSqft: 0,
            abrasionResistancePricePerSqft: 0,
            coatingRemovalPaintPerSqft: 0,
            coatingRemovalEpoxyPerSqft: 0,
            moistureMitigationPerSqft: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        );
        setCalculation(calc);
      }
    } catch (error) {
      console.error('Error loading job:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    const [y, m, d] = dateString.split('-').map(Number);
    if (!y || !m || !d) return dateString;
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-red-600">Job not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      {/* Header - hidden when printing */}
      <div className="print:hidden bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="font-medium text-sm">Back to Dashboard</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-gf-lime text-white rounded-lg font-semibold hover:bg-gf-dark-green transition-colors text-sm"
          >
            <Printer size={16} />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Printable Job Sheet - compact for one page */}
      <div className="max-w-4xl mx-auto p-4 print:p-0 print:max-w-none">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 print:shadow-none print:border-none print:p-6">
          {/* Header */}
          <div className="border-b-2 border-slate-300 pb-3 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-slate-900">Job Sheet</h1>
                <h2 className="text-lg font-semibold text-gf-dark-green">{job.name}</h2>
              </div>
              <div className="text-right text-sm text-slate-500">
                <p>Install: {formatDate(job.installDate)}</p>
              </div>
            </div>
          </div>

          {/* Two Column Layout for Compact Display */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Customer Information */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2 border-b border-slate-200 pb-1">Customer</h3>
                <div className="space-y-1 text-sm">
                  <p><span className="text-slate-500">Name:</span> <span className="font-medium">{job.customerName || 'Not specified'}</span></p>
                  <p><span className="text-slate-500">Address:</span> <span className="font-medium">{job.customerAddress || 'Not specified'}</span></p>
                </div>
              </div>

              {/* Job Details */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2 border-b border-slate-200 pb-1">Job Details</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p className="col-span-2"><span className="text-slate-500">System:</span> <span className="font-medium">{job.systemSnapshot.name}</span></p>
                  <p><span className="text-slate-500">Chip Blend:</span> <span className="font-medium">{job.chipBlend || '-'}</span></p>
                  <p><span className="text-slate-500">Base Color:</span> <span className="font-medium">{job.baseColor || '-'}</span></p>
                  <p><span className="text-slate-500">Tags:</span> <span className="font-medium">{(job.tags || []).length > 0 ? (job.tags || []).join(', ') : '-'}</span></p>
                  <p><span className="text-slate-500">Floor Sq Ft:</span> <span className="font-medium">{job.floorFootage.toLocaleString()}</span></p>
                  <p><span className="text-slate-500">Vertical Sq Ft:</span> <span className="font-medium">{job.verticalFootage.toLocaleString()}</span></p>
                </div>
              </div>

              {/* System Spread Rate Assumptions */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2 border-b border-slate-200 pb-1">Spread Rate Assumptions</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p>
                    <span className="text-slate-500">Base Coat:</span>{' '}
                    <span className="font-medium">{job.systemSnapshot.baseSpread} sqft/gal</span>
                    <span className="text-slate-400"> × {job.systemSnapshot.baseCoats ?? 1} coat{(job.systemSnapshot.baseCoats ?? 1) !== 1 ? 's' : ''}</span>
                  </p>
                  <p>
                    <span className="text-slate-500">Top Coat:</span>{' '}
                    <span className="font-medium">{job.systemSnapshot.topSpread} sqft/gal</span>
                    <span className="text-slate-400"> × {job.systemSnapshot.topCoats ?? 1} coat{(job.systemSnapshot.topCoats ?? 1) !== 1 ? 's' : ''}</span>
                  </p>
                  {(job.systemSnapshot.cyclo1Spread > 0) && (
                    <p>
                      <span className="text-slate-500">Cyclo1:</span>{' '}
                      <span className="font-medium">{job.systemSnapshot.cyclo1Spread} sqft/gal</span>
                      <span className="text-slate-400"> × {job.systemSnapshot.cyclo1Coats ?? 1} coat{(job.systemSnapshot.cyclo1Coats ?? 1) !== 1 ? 's' : ''}</span>
                    </p>
                  )}
                  <p>
                    <span className="text-slate-500">Chip:</span>{' '}
                    <span className="font-medium">{job.systemSnapshot.feetPerLb} sqft/lb</span>
                  </p>
                </div>
              </div>

              {/* Options - only show enabled options */}
              {(() => {
                const options: string[] = [];
                if (job.abrasionResistance) options.push('Abrasion Resistance');
                if (job.antiSlip) options.push('Anti-Slip');
                if (job.includeBasecoatTint) options.push('Basecoat Tint');
                if (job.includeTopcoatTint) options.push('Topcoat Tint');
                if (job.cyclo1Topcoat) options.push(`Cyclo1 Topcoat (${job.cyclo1Coats || 1} coat${(job.cyclo1Coats || 1) !== 1 ? 's' : ''})`);
                if (job.moistureMitigation) options.push('Moisture Mitigation');
                if (job.coatingRemoval && job.coatingRemoval !== 'None') options.push(`Coating Removal: ${job.coatingRemoval}`);
                if (options.length === 0) return null;
                return (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-2 border-b border-slate-200 pb-1">Options</h3>
                    <div className="flex flex-wrap gap-2">
                      {options.map((opt) => (
                        <span key={opt} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          {opt}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Right Column - Materials */}
            <div>
              {calculation && (() => {
                const allocationInput = {
                  baseGallons: calculation.baseGallons,
                  topGallons: calculation.topGallons,
                  baseColor: job.baseColor,
                  tintColor: job.tintColor,
                  includeBasecoatTint: job.includeBasecoatTint,
                  includeTopcoatTint: job.includeTopcoatTint,
                };
                // Resolve twice: once as saved, once with no override, so any line
                // that differs from the standard split can be called out.
                const materials = resolveJobMaterials({ ...allocationInput, override: job.materialAllocation });
                const standard = resolveJobMaterials(allocationInput);

                // A line is off-standard when the default split has no line with
                // that SKU key, or has it at a different quantity.
                const standardCoating = new Map(standard.coating.map((l) => [l.key, l.gallons]));
                const standardTint = new Map(standard.tint.map((l) => [l.key, l.oz]));
                const coatingOverridden = (line: ResolvedCoatingLine) =>
                  Math.abs((standardCoating.get(line.key) ?? 0) - line.gallons) > 0.005;
                const tintOverridden = (line: ResolvedTintLine) =>
                  Math.abs((standardTint.get(line.key) ?? 0) - line.oz) > 0.05;
                const anyOverridden =
                  materials.coating.some(coatingOverridden) ||
                  materials.tint.some(tintOverridden) ||
                  // a SKU the standard split needs but this job no longer draws
                  standard.coating.some((l) => !materials.coating.some((m) => m.key === l.key)) ||
                  standard.tint.some((l) => !materials.tint.some((m) => m.key === l.key));

                const partLineCount = materials.coating.reduce<Record<string, number>>((acc, l) => {
                  acc[l.part] = (acc[l.part] || 0) + 1;
                  return acc;
                }, {});

                return (
                  <>
                    <div className="flex items-center gap-2 mb-2 border-b border-slate-200 pb-1">
                      <h3 className="text-sm font-semibold text-slate-900">Materials Needed</h3>
                      {anyOverridden && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-400 text-[10px] font-bold uppercase tracking-wide">
                          Custom Allocation
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {materials.coating.map((line) => (
                        <MaterialCard
                          key={line.key}
                          label={coatingCardLabel(line, (partLineCount[line.part] || 0) > 1)}
                          value={line.gallons.toFixed(1)}
                          unit={`gal / ${(line.gallons * 128).toFixed(0)} oz`}
                          overridden={coatingOverridden(line)}
                        />
                      ))}
                      {materials.tint.map((line) => (
                        <MaterialCard
                          key={line.key}
                          label={`Tint (${line.color})`}
                          value={line.oz.toFixed(1)}
                          unit="oz"
                          overridden={tintOverridden(line)}
                        />
                      ))}
                      <MaterialCard label="Chip" value={String(calculation.chipNeeded)} unit="boxes" />
                      <MaterialCard
                        label="Crack Fill"
                        value={calculation.crackFillGallons.toFixed(1)}
                        unit={`gal / ${(calculation.crackFillGallons * 128).toFixed(0)} oz`}
                      />
                    </div>
                    {materials.warnings.map((warning, idx) => (
                      <p key={idx} className="text-xs text-amber-700 mt-2">{warning}</p>
                    ))}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Notes - Full Width */}
          {job.notes && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-2 border-b border-slate-200 pb-1">Notes</h3>
              <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{job.notes}</p>
              </div>
            </div>
          )}

          {/* Evaluation */}
          {job.evaluation && (job.evaluation.moisture.length > 0 || job.evaluation.ph.length > 0 || job.evaluation.hardness.length > 0 || job.evaluation.cacl.length > 0) && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-2 border-b border-slate-200 pb-1">Evaluation</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {([['moisture', 'Moisture'], ['ph', 'pH'], ['hardness', 'Hardness'], ['cacl', 'CaCl']] as const).map(([field, label]) => {
                  const values = job.evaluation![field as keyof typeof job.evaluation];
                  if (!values || (values as number[]).length === 0) return null;
                  return (
                    <div key={field} className="bg-slate-50 p-3 rounded-lg">
                      <span className="text-xs text-slate-500 block mb-1">{label}</span>
                      <span className="text-sm font-semibold text-slate-900">{(values as number[]).join(', ')}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: letter portrait;
            margin: 0.4in;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .bg-slate-50, .bg-green-50, .bg-yellow-50 {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .bg-amber-50, .bg-amber-100, .bg-amber-200, .border-amber-400 {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .bg-green-500, .bg-slate-200 {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}
