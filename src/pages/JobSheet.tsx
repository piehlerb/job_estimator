import { ArrowLeft, Printer } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getJob } from '../lib/db';
import { Job, JobCalculation } from '../types';
import { calculateJobOutputs } from '../lib/calculations';

interface JobSheetProps {
  jobId: string;
  onBack: () => void;
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
            includeBasecoatTint: loadedJob.includeBasecoatTint || false,
            includeTopcoatTint: loadedJob.includeTopcoatTint || false,
            antiSlip: loadedJob.antiSlip || false,
            abrasionResistance: loadedJob.abrasionResistance || false,
            cyclo1Topcoat: loadedJob.cyclo1Topcoat || false,
            cyclo1Coats: loadedJob.cyclo1Coats || 0,
            coatingRemoval: loadedJob.coatingRemoval || 'None',
            moistureMitigation: loadedJob.moistureMitigation || false,
            installSchedule: loadedJob.installSchedule,
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
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
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

              {/* Options */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2 border-b border-slate-200 pb-1">Options</h3>
                <div className="grid grid-cols-2 gap-1 text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-3 h-3 rounded ${job.abrasionResistance ? 'bg-green-500' : 'bg-slate-200'}`}></span>
                    <span className="text-slate-700">Abrasion Resistance</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-3 h-3 rounded ${job.antiSlip ? 'bg-green-500' : 'bg-slate-200'}`}></span>
                    <span className="text-slate-700">Anti-Slip</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-3 h-3 rounded ${job.coatingRemoval !== 'None' ? 'bg-green-500' : 'bg-slate-200'}`}></span>
                    <span className="text-slate-700">Coating Removal: {job.coatingRemoval || 'None'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Materials */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-2 border-b border-slate-200 pb-1">Materials Needed</h3>
              {calculation && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-green-50 p-3 rounded-lg text-center">
                    <span className="text-xs text-gf-dark-green block">Basecoat</span>
                    <span className="text-xl font-bold text-gf-dark-green">{calculation.baseGallons.toFixed(1)}</span>
                    <span className="text-xs text-gf-dark-green block">gallons</span>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg text-center">
                    <span className="text-xs text-gf-dark-green block">Topcoat</span>
                    <span className="text-xl font-bold text-gf-dark-green">{calculation.topGallons.toFixed(1)}</span>
                    <span className="text-xs text-gf-dark-green block">gallons</span>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg text-center">
                    <span className="text-xs text-gf-dark-green block">Chip</span>
                    <span className="text-xl font-bold text-gf-dark-green">{calculation.chipNeeded}</span>
                    <span className="text-xs text-gf-dark-green block">boxes</span>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg text-center">
                    <span className="text-xs text-gf-dark-green block">Crack Fill</span>
                    <span className="text-xl font-bold text-gf-dark-green">{calculation.crackFillGallons.toFixed(1)}</span>
                    <span className="text-xs text-gf-dark-green block">gallons</span>
                  </div>
                </div>
              )}
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
          .bg-green-500, .bg-slate-200 {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}
