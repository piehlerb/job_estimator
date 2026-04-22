import { useEffect, useMemo, useState } from 'react';
import { getAllJobs, getAllLaborers, getCosts, getDefaultCosts, getPricing, getDefaultPricing } from '../lib/db';
import { calculateJobOutputs, calculateActualCosts } from '../lib/calculations';
import { ActualCosts, Costs, Job, JobCalculation, JobStatus, Laborer, Pricing } from '../types';

interface JobWithCalc {
  job: Job;
  calc: JobCalculation;
  mergedCosts: Costs;
  mergedPricing: Pricing;
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

interface MonthlyWonRow {
  job: Job;
  calc: JobCalculation;
  estMargin: number;
  actuals: ActualCosts | null;
}

interface EmployeeHoursRow {
  laborerId: string;
  laborerName: string;
  totalHours: number;
  jobCount: number;
}

const ALL_STATUSES: JobStatus[] = ['Pending', 'Verbal', 'Won', 'Lost'];
type DateRangePreset = 'all' | '30d' | '90d' | 'ytd' | 'custom';
type DateFieldMode = 'install' | 'created';
type ReportView = 'tags' | 'monthly-won' | 'employee-hours';

function getDefaultEmpStart() {
  const d = new Date();
  d.setDate(d.getDate() - 13);
  return d.toISOString().slice(0, 10);
}

export default function Reporting() {
  const [jobsWithCalc, setJobsWithCalc] = useState<JobWithCalc[]>([]);
  const [allLaborers, setAllLaborers] = useState<Laborer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ReportView>('tags');

  // Tag report filters
  const [statusFilter, setStatusFilter] = useState<JobStatus[]>(['Pending', 'Verbal', 'Won', 'Lost']);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagMatchMode, setTagMatchMode] = useState<'any' | 'all'>('any');
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('all');
  const [dateFieldMode, setDateFieldMode] = useState<DateFieldMode>('install');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Employee hours date range
  const [empStartDate, setEmpStartDate] = useState(getDefaultEmpStart);
  const [empEndDate, setEmpEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allJobs, currentCosts, currentPricing, laborers] = await Promise.all([
        getAllJobs(),
        getCosts(),
        getPricing(),
        getAllLaborers(),
      ]);
      setAllLaborers(laborers.filter((l) => !l.deleted));
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
        return { job, calc, mergedCosts, mergedPricing };
      });

      setJobsWithCalc(withCalc);
    } catch (error) {
      console.error('Error loading reporting data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ==================== TAG REPORT ====================

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
    const UNTAGGED = '(Untagged)';

    filteredJobs.forEach(({ job, calc }) => {
      const tags = job.tags || [];
      const tagsToProcess = tags.length > 0 ? tags : [UNTAGGED];

      tagsToProcess.forEach((tag) => {
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

    const tagged = Array.from(map.values())
      .filter((a) => a.tag !== UNTAGGED)
      .sort((a, b) => b.totalPrice - a.totalPrice);
    const untagged = map.get(UNTAGGED);
    return untagged ? [...tagged, untagged] : tagged;
  }, [filteredJobs]);

  // ==================== MONTHLY WON JOBS ====================

  const monthlyWonData = useMemo((): MonthlyWonRow[] => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    return jobsWithCalc
      .filter(({ job }) => {
        if (job.status !== 'Won' || !job.installDate) return false;
        const d = new Date(`${job.installDate}T00:00:00`);
        return d >= monthStart && d <= monthEnd;
      })
      .map(({ job, calc, mergedCosts, mergedPricing }) => {
        const estMargin = job.totalPrice - calc.totalCosts;

        let actuals: ActualCosts | null = null;
        if (job.actualInstallSchedule && job.actualInstallSchedule.length > 0) {
          actuals = calculateActualCosts(
            {
              actualSchedule: job.actualInstallSchedule,
              actualBaseCoatGallons: job.actualBaseCoatGallons || 0,
              actualTopCoatGallons: job.actualTopCoatGallons || 0,
              actualCyclo1Gallons: job.actualCyclo1Gallons || 0,
              actualTintOz: job.actualTintOz || 0,
              actualChipBoxes: job.actualChipBoxes || 0,
              actualCrackRepairOz: job.actualCrackRepairOz || 0,
              chipBoxCost: job.systemSnapshot?.boxCost ?? 0,
              totalPrice: job.totalPrice,
              installDays: job.installDays,
              installDate: job.installDate,
              travelDistance: job.travelDistance,
              disableGasHeater: job.disableGasHeater,
            },
            mergedCosts,
            mergedPricing,
            job.laborersSnapshot
          );
        }

        return { job, calc, estMargin, actuals };
      })
      .sort((a, b) => a.job.installDate.localeCompare(b.job.installDate));
  }, [jobsWithCalc]);

  const monthlyWonSummary = useMemo(() => {
    const jobCount = monthlyWonData.length;
    const totalRevenue = monthlyWonData.reduce((s, r) => s + r.job.totalPrice, 0);
    const totalEstMargin = monthlyWonData.reduce((s, r) => s + r.estMargin, 0);
    const jobsWithActuals = monthlyWonData.filter((r) => r.actuals !== null);
    const totalActualMargin = jobsWithActuals.reduce((s, r) => s + (r.actuals?.actualMargin ?? 0), 0);
    const estMarginPct = totalRevenue > 0 ? (totalEstMargin / totalRevenue) * 100 : 0;
    const actualRevenue = jobsWithActuals.reduce((s, r) => s + r.job.totalPrice, 0);
    const actualMarginPct = actualRevenue > 0 ? (totalActualMargin / actualRevenue) * 100 : 0;
    return { jobCount, totalRevenue, totalEstMargin, estMarginPct, jobsWithActuals: jobsWithActuals.length, totalActualMargin, actualMarginPct };
  }, [monthlyWonData]);

  // ==================== EMPLOYEE HOURS ====================

  const employeeHoursData = useMemo((): EmployeeHoursRow[] => {
    const start = empStartDate ? new Date(`${empStartDate}T00:00:00`) : null;
    const end = empEndDate ? new Date(`${empEndDate}T23:59:59`) : null;

    const map = new Map<string, { name: string; hours: number; jobIds: Set<string> }>();

    jobsWithCalc.forEach(({ job }) => {
      if (job.status !== 'Won' || !job.installDate) return;
      const d = new Date(`${job.installDate}T00:00:00`);
      if (start && d < start) return;
      if (end && d > end) return;

      if (!job.actualInstallSchedule || job.actualInstallSchedule.length === 0) return;
      const schedule = job.actualInstallSchedule;

      schedule.forEach((day) => {
        day.laborerIds.forEach((laborerId) => {
          const laborer =
            job.laborersSnapshot.find((l) => l.id === laborerId) ??
            allLaborers.find((l) => l.id === laborerId);
          const name = laborer?.name ?? `Unknown (${laborerId.slice(0, 8)})`;

          if (!map.has(laborerId)) {
            map.set(laborerId, { name, hours: 0, jobIds: new Set() });
          }
          const entry = map.get(laborerId)!;
          entry.hours += day.hours;
          entry.jobIds.add(job.id);
        });
      });
    });

    return Array.from(map.entries())
      .map(([laborerId, data]) => ({
        laborerId,
        laborerName: data.name,
        totalHours: data.hours,
        jobCount: data.jobIds.size,
      }))
      .sort((a, b) => b.totalHours - a.totalHours);
  }, [jobsWithCalc, allLaborers, empStartDate, empEndDate]);

  const empTotals = useMemo(() => ({
    totalHours: employeeHoursData.reduce((s, r) => s + r.totalHours, 0),
    uniqueJobs: new Set(employeeHoursData.map((r) => r.laborerId)).size,
  }), [employeeHoursData]);

  // ==================== HANDLERS ====================

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

  const currentMonthLabel = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  // ==================== RENDER ====================

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Reporting</h1>
        <p className="text-sm sm:text-base text-slate-600 mt-1">Reports and analytics</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-4 sm:mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        {([
          { id: 'tags', label: 'Tag Report' },
          { id: 'monthly-won', label: 'Monthly Won Jobs' },
          { id: 'employee-hours', label: 'Employee Hours' },
        ] as { id: ReportView; label: string }[]).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveView(id)}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              activeView === id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center text-slate-600">
          Loading reports...
        </div>
      ) : (
        <>
          {/* ===== TAG REPORT ===== */}
          {activeView === 'tags' && (
            <>
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
                    No jobs match the current filters.
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
                          const isUntagged = row.tag === '(Untagged)';
                          return (
                            <tr key={row.tag} className={`border-b border-slate-200 ${isUntagged ? 'bg-slate-50' : ''}`}>
                              <td className={`px-4 lg:px-6 py-4 text-sm font-medium ${isUntagged ? 'text-slate-400 italic' : 'text-slate-900'}`}>{row.tag}</td>
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

          {/* ===== MONTHLY WON JOBS ===== */}
          {activeView === 'monthly-won' && (
            <>
              <div className="mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-semibold text-slate-900">{currentMonthLabel}</h2>
                <p className="text-sm text-slate-500 mt-0.5">Won jobs with install date in the current month</p>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
                  <p className="text-xs text-slate-500">Jobs Won</p>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900">{monthlyWonSummary.jobCount}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
                  <p className="text-xs text-slate-500">Total Revenue</p>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900">{formatCurrency(monthlyWonSummary.totalRevenue)}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
                  <p className="text-xs text-slate-500">Est. Margin</p>
                  <p className="text-xl sm:text-2xl font-bold text-green-600">{formatCurrency(monthlyWonSummary.totalEstMargin)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{monthlyWonSummary.estMarginPct.toFixed(1)}%</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
                  <p className="text-xs text-slate-500">Actual Margin</p>
                  {monthlyWonSummary.jobsWithActuals > 0 ? (
                    <>
                      <p className="text-xl sm:text-2xl font-bold text-green-600">{formatCurrency(monthlyWonSummary.totalActualMargin)}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{monthlyWonSummary.actualMarginPct.toFixed(1)}% · {monthlyWonSummary.jobsWithActuals} of {monthlyWonSummary.jobCount} jobs</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xl sm:text-2xl font-bold text-slate-300">—</p>
                      <p className="text-xs text-slate-400 mt-0.5">No actuals recorded</p>
                    </>
                  )}
                </div>
              </div>

              {/* Jobs table */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-3 sm:p-4 border-b border-slate-200">
                  <h3 className="text-base font-semibold text-slate-900">Job Detail</h3>
                </div>
                {monthlyWonData.length === 0 ? (
                  <div className="p-6 sm:p-8 text-center text-slate-600 text-sm">
                    No won jobs with an install date in {currentMonthLabel}.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Job</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Install Date</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Revenue</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Est. Costs</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Est. Margin</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Est. Margin %</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Actual Margin</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Actual Margin %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyWonData.map(({ job, calc, estMargin, actuals }) => {
                          const estPct = job.totalPrice > 0 ? (estMargin / job.totalPrice) * 100 : 0;
                          return (
                            <tr key={job.id} className="border-b border-slate-200 hover:bg-slate-50">
                              <td className="px-4 py-3 text-sm font-medium text-slate-900">{job.name}</td>
                              <td className="px-4 py-3 text-sm text-slate-600">{job.installDate}</td>
                              <td className="px-4 py-3 text-sm text-right text-slate-700">{formatCurrency(job.totalPrice)}</td>
                              <td className="px-4 py-3 text-sm text-right text-slate-600">{formatCurrency(calc.totalCosts)}</td>
                              <td className="px-4 py-3 text-sm text-right text-green-700">{formatCurrency(estMargin)}</td>
                              <td className="px-4 py-3 text-sm text-right text-green-700">{estPct.toFixed(1)}%</td>
                              {actuals ? (
                                <>
                                  <td className="px-4 py-3 text-sm text-right text-green-700">{formatCurrency(actuals.actualMargin)}</td>
                                  <td className="px-4 py-3 text-sm text-right text-green-700">{actuals.actualMarginPct.toFixed(1)}%</td>
                                </>
                              ) : (
                                <>
                                  <td className="px-4 py-3 text-sm text-right text-slate-300">—</td>
                                  <td className="px-4 py-3 text-sm text-right text-slate-300">—</td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 border-t-2 border-slate-300">
                          <td className="px-4 py-3 text-sm font-semibold text-slate-700" colSpan={2}>Total</td>
                          <td className="px-4 py-3 text-sm font-semibold text-right text-slate-700">{formatCurrency(monthlyWonSummary.totalRevenue)}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-right text-slate-600">{formatCurrency(monthlyWonData.reduce((s, r) => s + r.calc.totalCosts, 0))}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-right text-green-700">{formatCurrency(monthlyWonSummary.totalEstMargin)}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-right text-green-700">{monthlyWonSummary.estMarginPct.toFixed(1)}%</td>
                          {monthlyWonSummary.jobsWithActuals > 0 ? (
                            <>
                              <td className="px-4 py-3 text-sm font-semibold text-right text-green-700">{formatCurrency(monthlyWonSummary.totalActualMargin)}</td>
                              <td className="px-4 py-3 text-sm font-semibold text-right text-green-700">{monthlyWonSummary.actualMarginPct.toFixed(1)}%</td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3 text-sm font-semibold text-right text-slate-300">—</td>
                              <td className="px-4 py-3 text-sm font-semibold text-right text-slate-300">—</td>
                            </>
                          )}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ===== EMPLOYEE HOURS ===== */}
          {activeView === 'employee-hours' && (
            <>
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 mb-4 sm:mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <label className="text-xs sm:text-sm text-slate-600 font-medium whitespace-nowrap">Install Date Range:</label>
                  <input
                    type="date"
                    value={empStartDate}
                    onChange={(e) => setEmpStartDate(e.target.value)}
                    className="px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-gf-lime"
                  />
                  <span className="text-slate-400 text-sm">to</span>
                  <input
                    type="date"
                    value={empEndDate}
                    onChange={(e) => setEmpEndDate(e.target.value)}
                    className="px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-gf-lime"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setEmpStartDate(getDefaultEmpStart());
                      setEmpEndDate(new Date().toISOString().slice(0, 10));
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Last 14 Days
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-2">Shows hours from won jobs with actuals recorded and an install date in this range.</p>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
                  <p className="text-xs text-slate-500">Total Hours</p>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900">{empTotals.totalHours.toFixed(1)}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
                  <p className="text-xs text-slate-500">Employees</p>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900">{employeeHoursData.length}</p>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-3 sm:p-4 border-b border-slate-200">
                  <h3 className="text-base font-semibold text-slate-900">Hours by Employee</h3>
                </div>
                {employeeHoursData.length === 0 ? (
                  <div className="p-6 sm:p-8 text-center text-slate-600 text-sm">
                    No won jobs with install dates in the selected range.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Employee</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Jobs</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Total Hours</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Avg Hours/Job</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeHoursData.map((row) => (
                          <tr key={row.laborerId} className="border-b border-slate-200 hover:bg-slate-50">
                            <td className="px-4 py-3 text-sm font-medium text-slate-900">{row.laborerName}</td>
                            <td className="px-4 py-3 text-sm text-right text-slate-700">{row.jobCount}</td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">{row.totalHours.toFixed(1)}</td>
                            <td className="px-4 py-3 text-sm text-right text-slate-600">
                              {row.jobCount > 0 ? (row.totalHours / row.jobCount).toFixed(1) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 border-t-2 border-slate-300">
                          <td className="px-4 py-3 text-sm font-semibold text-slate-700">Total</td>
                          <td className="px-4 py-3 text-sm font-semibold text-right text-slate-700">
                            {/* unique jobs across all employees */}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-right text-slate-900">{empTotals.totalHours.toFixed(1)}</td>
                          <td className="px-4 py-3" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
