import { Plus, Trash2, FileText } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { getAllJobs, deleteJob, getDefaultCosts, getCosts, getPricing, getDefaultPricing } from '../lib/db';
import { Job, JobCalculation, Costs, Pricing, JobStatus } from '../types';
import { calculateJobOutputs } from '../lib/calculations';

interface DashboardProps {
  onViewJobSheet: (id: string) => void;
  onNewJob: () => void;
  onEditJob: (id: string) => void;
}

interface JobWithCalc {
  job: Job;
  calc: JobCalculation;
}

const ALL_STATUSES: JobStatus[] = ['Pending', 'Won', 'Lost'];

export default function Dashboard({ onNewJob, onEditJob, onViewJobSheet }: DashboardProps) {
  const [jobsWithCalc, setJobsWithCalc] = useState<JobWithCalc[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'date' | 'price' | 'margin'>('date');

  // Filter state - default to showing Pending and Won
  const [statusFilter, setStatusFilter] = useState<JobStatus[]>(['Pending', 'Won']);
  const [chipBlendFilter, setChipBlendFilter] = useState<string>('');

  useEffect(() => {
    loadJobs();
  }, []);

  // Auto-refresh when sync completes
  useEffect(() => {
    const handleSyncComplete = () => {
      console.log('Sync completed, refreshing dashboard data...');
      loadJobs();
    };

    window.addEventListener('syncComplete', handleSyncComplete);

    return () => {
      window.removeEventListener('syncComplete', handleSyncComplete);
    };
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const [allJobs, currentCosts, currentPricing] = await Promise.all([
        getAllJobs(),
        getCosts(),
        getPricing(),
      ]);
      const costs = currentCosts || getDefaultCosts();
      const pricing = currentPricing || getDefaultPricing();

      // Calculate values for each job using their snapshots
      const withCalc = allJobs.map((job) => {
        // Merge costs snapshot with defaults, then use current costs for new fields
        // that may not exist in older snapshots
        const mergedCosts: Costs = {
          ...getDefaultCosts(),
          ...job.costsSnapshot,
          // Use current costs for new additive fields if snapshot doesn't have them
          antiSlipCostPerGal: job.costsSnapshot.antiSlipCostPerGal ?? costs.antiSlipCostPerGal,
          abrasionResistanceCostPerGal: job.costsSnapshot.abrasionResistanceCostPerGal ?? costs.abrasionResistanceCostPerGal,
        };
        const mergedPricing: Pricing = job.pricingSnapshot
          ? { ...getDefaultPricing(), ...job.pricingSnapshot }
          : pricing;
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
            cyclo1Coats: job.cyclo1Coats || 1,
            coatingRemoval: job.coatingRemoval || 'None',
            moistureMitigation: job.moistureMitigation || false,
          },
          job.systemSnapshot,
          mergedCosts,
          job.laborersSnapshot,
          mergedPricing
        );
        return { job, calc };
      });
      setJobsWithCalc(withCalc);
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique chip blends from all jobs
  const availableChipBlends = useMemo(() => {
    const blends = new Set<string>();
    jobsWithCalc.forEach(({ job }) => {
      if (job.chipBlend) {
        blends.add(job.chipBlend);
      }
    });
    return Array.from(blends).sort();
  }, [jobsWithCalc]);

  const handleDeleteJob = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this job?')) {
      try {
        await deleteJob(id);
        await loadJobs();
      } catch (error) {
        console.error('Error deleting job:', error);
        alert('Error deleting job');
      }
    }
  };

  const handleStatusToggle = (status: JobStatus) => {
    setStatusFilter(prev => {
      if (prev.includes(status)) {
        // Don't allow removing all statuses
        if (prev.length === 1) return prev;
        return prev.filter(s => s !== status);
      } else {
        return [...prev, status];
      }
    });
  };

  // Filter and sort jobs
  const filteredAndSortedJobs = useMemo(() => {
    let filtered = jobsWithCalc;

    // Apply status filter
    if (statusFilter.length > 0) {
      filtered = filtered.filter(({ job }) => statusFilter.includes(job.status));
    }

    // Apply chip blend filter
    if (chipBlendFilter) {
      filtered = filtered.filter(({ job }) => job.chipBlend === chipBlendFilter);
    }

    // Sort
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return b.job.totalPrice - a.job.totalPrice;
        case 'margin':
          const marginA = a.job.totalPrice > 0 ? ((a.job.totalPrice - a.calc.totalCosts) / a.job.totalPrice) * 100 : 0;
          const marginB = b.job.totalPrice > 0 ? ((b.job.totalPrice - b.calc.totalCosts) / b.job.totalPrice) * 100 : 0;
          return marginB - marginA;
        case 'date':
        default:
          return new Date(b.job.createdAt).getTime() - new Date(a.job.createdAt).getTime();
      }
    });
  }, [jobsWithCalc, statusFilter, chipBlendFilter, sortBy]);

  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case 'Won': return 'bg-green-100 text-green-800';
      case 'Lost': return 'bg-red-100 text-red-800';
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 md:mb-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Dashboard</h2>
          <p className="text-sm sm:text-base text-slate-600 mt-1">
            {filteredAndSortedJobs.length} of {jobsWithCalc.length} jobs shown
          </p>
        </div>
        <button
          onClick={onNewJob}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm sm:text-base"
        >
          <Plus size={18} className="sm:w-5 sm:h-5" />
          New Job
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {/* Filters and Sort Section */}
        <div className="p-3 sm:p-4 md:p-6 border-b border-slate-200">
          <div className="flex flex-col gap-3">
            {/* Title and Sort */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-2">
              <h3 className="text-base sm:text-lg font-semibold text-slate-900">Jobs</h3>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <label className="text-xs sm:text-sm text-slate-600 font-medium">Sort:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'date' | 'price' | 'margin')}
                  className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="date">Recent</option>
                  <option value="price">Price (High to Low)</option>
                  <option value="margin">Margin (High to Low)</option>
                </select>
              </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              {/* Status Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-xs sm:text-sm text-slate-600 font-medium">Status:</label>
                <div className="flex gap-1.5 flex-wrap">
                  {ALL_STATUSES.map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusToggle(status)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        statusFilter.includes(status)
                          ? getStatusColor(status)
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chip Blend Filter */}
              {availableChipBlends.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="text-xs sm:text-sm text-slate-600 font-medium">Chip:</label>
                  <select
                    value={chipBlendFilter}
                    onChange={(e) => setChipBlendFilter(e.target.value)}
                    className="px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Blends</option>
                    {availableChipBlends.map((blend) => (
                      <option key={blend} value={blend}>{blend}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-6 sm:p-8 text-center">
            <p className="text-sm sm:text-base text-slate-600">Loading jobs...</p>
          </div>
        ) : filteredAndSortedJobs.length === 0 ? (
          <div className="p-6 sm:p-8 text-center">
            <p className="text-sm sm:text-base text-slate-600 mb-4">
              {jobsWithCalc.length === 0
                ? "No jobs yet. Create your first job to get started!"
                : "No jobs match the current filters."}
            </p>
            {jobsWithCalc.length === 0 && (
              <button
                onClick={onNewJob}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus size={18} />
                Create Job
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-slate-200">
              {filteredAndSortedJobs.map(({ job, calc }) => {
                const marginPct = job.totalPrice > 0 ? ((job.totalPrice - calc.totalCosts) / job.totalPrice) * 100 : 0;
                return (
                  <div
                    key={job.id}
                    className="p-3 sm:p-4 hover:bg-slate-50 transition-colors"
                    onClick={() => onEditJob(job.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="text-sm font-semibold text-slate-900 truncate">{job.name || 'Untitled Job'}</h4>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getStatusColor(job.status)}`}>
                            {job.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{new Date(job.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewJobSheet(job.id);
                          }}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                          title="Job Sheet"
                        >
                          <FileText size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteJob(job.id);
                          }}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-slate-500">Cost</p>
                        <p className="font-medium text-slate-900">${calc.totalCosts.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Price</p>
                        <p className="font-semibold text-slate-900">${job.totalPrice.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Actual Margin</p>
                        <p className={`font-semibold ${marginPct >= 30 ? 'text-green-600' : 'text-orange-600'}`}>
                          {marginPct.toFixed(0)}%
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 lg:px-6 py-3 text-left text-sm font-semibold text-slate-700">Job Name</th>
                    <th className="px-4 lg:px-6 py-3 text-center text-sm font-semibold text-slate-700">Status</th>
                    <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Total Cost</th>
                    <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Total Price</th>
                    <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Actual Margin</th>
                    <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Date</th>
                    <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedJobs.map(({ job, calc }) => {
                    const marginPct = job.totalPrice > 0 ? ((job.totalPrice - calc.totalCosts) / job.totalPrice) * 100 : 0;
                    return (
                      <tr
                        key={job.id}
                        className="border-b border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => onEditJob(job.id)}
                      >
                        <td className="px-4 lg:px-6 py-4 text-sm font-medium text-slate-900">{job.name || 'Untitled Job'}</td>
                        <td className="px-4 lg:px-6 py-4 text-sm text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-sm text-slate-600 text-right">${calc.totalCosts.toFixed(0)}</td>
                        <td className="px-4 lg:px-6 py-4 text-sm font-semibold text-slate-900 text-right">
                          ${job.totalPrice.toFixed(0)}
                        </td>
                        <td className={`px-4 lg:px-6 py-4 text-sm font-semibold text-right ${marginPct >= 30 ? 'text-green-600' : 'text-orange-600'}`}>
                          {marginPct.toFixed(0)}%
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-sm text-slate-600 text-right">
                          {new Date(job.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-sm text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onViewJobSheet(job.id);
                              }}
                              className="text-green-600 hover:text-green-800"
                              title="Job Sheet"
                            >
                              <FileText size={18} />
                            </button>
                            <button className="text-blue-600 hover:text-blue-800 font-medium text-xs lg:text-sm">Edit</button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteJob(job.id);
                              }}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
