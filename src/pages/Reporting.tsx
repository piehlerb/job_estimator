import { useEffect, useMemo, useState } from 'react';
import { getAllJobs, getCosts, getDefaultCosts, getPricing, getDefaultPricing } from '../lib/db';
import { calculateJobOutputs } from '../lib/calculations';
import { Costs, Job, JobCalculation, JobStatus, Pricing } from '../types';

interface JobWithCalc {
  job: Job;
  calc: JobCalculation;
}

interface TagAggregate {
  tag: string;
  jobs: number;
  won: number;
  verbal: number;
  pending: number;
  lost: number;
  totalPrice: number;
  totalCosts: number;
  totalMargin: number;
}

const ALL_STATUSES: JobStatus[] = ['Pending', 'Verbal', 'Won', 'Lost'];
type DateRangePreset = 'all' | '30d' | '90d' | 'ytd' | 'custom';
type DateFieldMode = 'install' | 'created';

export default function Reporting() {
  const [jobsWithCalc, setJobsWithCalc] = useState<JobWithCalc[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<JobStatus[]>(['Pending', 'Verbal', 'Won', 'Lost']);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagMatchMode, setTagMatchMode] = useState<'any' | 'all'>('any');
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('all');
  const [dateFieldMode, setDateFieldMode] = useState<DateFieldMode>('install');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allJobs, currentCosts, currentPricing] = await Promise.all([
        getAllJobs(),
        getCosts(),
        getPricing(),
      ]);
      const costs = currentCosts || getDefaultCosts();
      const pricing = currentPricing || getDefaultPricing();

      const withCalc = allJobs.map((job) => {
        const mergedCosts: Costs = {
          ...getDefaultCosts(),
          ...job.costsSnapshot,
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
            cyclo1Coats: job.cyclo1Coats || 0,
            coatingRemoval: job.coatingRemoval || 'None',
            moistureMitigation: job.moistureMitigation || false,
            installSchedule: job.installSchedule,
            tags: job.tags,
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
      console.error('Error loading reporting data:', error);
    } finally {
      setLoading(false);
    }
  };

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    jobsWithCalc.forEach(({ job }) => {
      (job.tags || []).forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [jobsWithCalc]);

  const filteredJobs = useMemo(() => {
    const today = new Date();
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const matchesDateRange = (job: Job) => {
      if (dateRangePreset === 'all') return true;
      const installDate = job.installDate;
      const createdAt = job.createdAt;

      const dateValue = dateFieldMode === 'install'
        ? (installDate ? `${installDate}T00:00:00` : '')
        : createdAt;
      if (!dateValue) return false;

      const selectedDate = new Date(dateValue);
      if (Number.isNaN(selectedDate.getTime())) return false;

      if (dateRangePreset === 'custom') {
        if (customStartDate) {
          const start = new Date(`${customStartDate}T00:00:00`);
          if (selectedDate < start) return false;
        }
        if (customEndDate) {
          const end = new Date(`${customEndDate}T23:59:59`);
          if (selectedDate > end) return false;
        }
        return true;
      }

      if (dateRangePreset === 'ytd') {
        const startOfYear = new Date(todayDateOnly.getFullYear(), 0, 1);
        return selectedDate >= startOfYear && selectedDate <= todayDateOnly;
      }

      const days = dateRangePreset === '30d' ? 30 : 90;
      const start = new Date(todayDateOnly);
      start.setDate(start.getDate() - days);
      return selectedDate >= start && selectedDate <= todayDateOnly;
    };

    let filtered = jobsWithCalc.filter(({ job }) =>
      statusFilter.includes(job.status) && matchesDateRange(job)
    );

    if (selectedTags.length > 0) {
      filtered = filtered.filter(({ job }) => {
        const jobTags = job.tags || [];
        if (tagMatchMode === 'all') {
          return selectedTags.every((tag) => jobTags.includes(tag));
        }
        return selectedTags.some((tag) => jobTags.includes(tag));
      });
    }

    return filtered;
  }, [jobsWithCalc, statusFilter, selectedTags, tagMatchMode, dateRangePreset, dateFieldMode, customStartDate, customEndDate]);

  const summary = useMemo(() => {
    const totals = filteredJobs.reduce((acc, { job, calc }) => {
      acc.totalPrice += job.totalPrice;
      acc.totalCosts += calc.totalCosts;
      acc.totalMargin += job.totalPrice - calc.totalCosts;
      return acc;
    }, { totalPrice: 0, totalCosts: 0, totalMargin: 0 });

    const marginPct = totals.totalPrice > 0 ? (totals.totalMargin / totals.totalPrice) * 100 : 0;

    return {
      totalJobs: filteredJobs.length,
      ...totals,
      marginPct,
    };
  }, [filteredJobs]);

  const tagAggregates = useMemo(() => {
    const map = new Map<string, TagAggregate>();

    filteredJobs.forEach(({ job, calc }) => {
      (job.tags || []).forEach((tag) => {
        if (!map.has(tag)) {
          map.set(tag, {
            tag,
            jobs: 0,
            won: 0,
            verbal: 0,
            pending: 0,
            lost: 0,
            totalPrice: 0,
            totalCosts: 0,
            totalMargin: 0,
          });
        }

        const entry = map.get(tag)!;
        entry.jobs += 1;
        entry.totalPrice += job.totalPrice;
        entry.totalCosts += calc.totalCosts;
        entry.totalMargin += job.totalPrice - calc.totalCosts;

        if (job.status === 'Won') entry.won += 1;
        if (job.status === 'Verbal') entry.verbal += 1;
        if (job.status === 'Pending') entry.pending += 1;
        if (job.status === 'Lost') entry.lost += 1;
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalPrice - a.totalPrice);
  }, [filteredJobs]);

  const handleStatusToggle = (status: JobStatus) => {
    setStatusFilter((prev) => {
      if (prev.includes(status)) {
        if (prev.length === 1) return prev;
        return prev.filter((s) => s !== status);
      }
      return [...prev, status];
    });
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) => (
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag]
    ));
  };

  const formatCurrency = (value: number) => (
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
  );

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-4 sm:mb-6 md:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Reporting</h1>
        <p className="text-sm sm:text-base text-slate-600 mt-1">Tag-based counts, revenue, and margin reporting</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 md:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs sm:text-sm text-slate-600 font-medium">Status:</label>
            {ALL_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => handleStatusToggle(status)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter.includes(status) ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <label className="text-xs sm:text-sm text-slate-600 font-medium">Date Range:</label>
            <select
              value={dateFieldMode}
              onChange={(e) => setDateFieldMode(e.target.value as DateFieldMode)}
              className="px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-gf-lime"
            >
              <option value="install">Install Date</option>
              <option value="created">Created Date</option>
            </select>
            <select
              value={dateRangePreset}
              onChange={(e) => setDateRangePreset(e.target.value as DateRangePreset)}
              className="px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-gf-lime"
            >
              <option value="all">All Time</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="ytd">Year to Date</option>
              <option value="custom">Custom</option>
            </select>
            {dateRangePreset === 'custom' && (
              <>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-gf-lime"
                />
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-gf-lime"
                />
              </>
            )}
          </div>

          {availableTags.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-xs sm:text-sm text-slate-600 font-medium">Tag Match:</label>
                <button
                  type="button"
                  onClick={() => setTagMatchMode('any')}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    tagMatchMode === 'any' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  Any
                </button>
                <button
                  type="button"
                  onClick={() => setTagMatchMode('all')}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    tagMatchMode === 'all' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  All
                </button>
                {selectedTags.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedTags([])}
                    className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTagToggle(tag)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedTags.includes(tag)
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center text-slate-600">
          Loading reports...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
              <p className="text-xs text-slate-500">Jobs</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900">{summary.totalJobs}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
              <p className="text-xs text-slate-500">Total Revenue</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900">{formatCurrency(summary.totalPrice)}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
              <p className="text-xs text-slate-500">Total Margin</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600">{formatCurrency(summary.totalMargin)}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
              <p className="text-xs text-slate-500">Margin %</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600">{summary.marginPct.toFixed(1)}%</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-3 sm:p-4 md:p-6 border-b border-slate-200">
              <h3 className="text-base sm:text-lg font-semibold text-slate-900">By Tag</h3>
            </div>

            {tagAggregates.length === 0 ? (
              <div className="p-6 sm:p-8 text-center text-slate-600 text-sm sm:text-base">
                No tagged jobs match the current filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 lg:px-6 py-3 text-left text-sm font-semibold text-slate-700">Tag</th>
                      <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Jobs</th>
                      <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Won</th>
                      <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Verbal</th>
                      <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Pending</th>
                      <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Lost</th>
                      <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Revenue</th>
                      <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Margin</th>
                      <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tagAggregates.map((row) => {
                      const marginPct = row.totalPrice > 0 ? (row.totalMargin / row.totalPrice) * 100 : 0;
                      return (
                        <tr key={row.tag} className="border-b border-slate-200">
                          <td className="px-4 lg:px-6 py-4 text-sm font-medium text-slate-900">{row.tag}</td>
                          <td className="px-4 lg:px-6 py-4 text-sm text-right text-slate-700">{row.jobs}</td>
                          <td className="px-4 lg:px-6 py-4 text-sm text-right text-green-700">{row.won}</td>
                          <td className="px-4 lg:px-6 py-4 text-sm text-right text-blue-700">{row.verbal}</td>
                          <td className="px-4 lg:px-6 py-4 text-sm text-right text-amber-700">{row.pending}</td>
                          <td className="px-4 lg:px-6 py-4 text-sm text-right text-red-700">{row.lost}</td>
                          <td className="px-4 lg:px-6 py-4 text-sm text-right text-slate-700">{formatCurrency(row.totalPrice)}</td>
                          <td className="px-4 lg:px-6 py-4 text-sm text-right text-green-700">{formatCurrency(row.totalMargin)}</td>
                          <td className="px-4 lg:px-6 py-4 text-sm text-right text-green-700">{marginPct.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
