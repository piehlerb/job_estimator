import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAllAdSpend, getAllJobs, getAllLaborers, getAllLeadAppointments, getAllLeads, getCosts, getDefaultCosts, getPricing, getDefaultPricing, setAdSpendForMonth, updateJob } from '../lib/db';
import { calculateJobOutputs, calculateActualCosts } from '../lib/calculations';
import { ActualCosts, AdSpend, Costs, Job, JobCalculation, JobStatus, Laborer, Lead, LeadAppointment, LeadStage, Pricing } from '../types';
import { loadAllHistoricalJobsFromSupabase } from '../lib/sync';
import ZipGeographyReport from '../components/ZipGeographyReport';
import LeadCreatedDateReport from '../components/LeadCreatedDateReport';
import { applyZipToAddress } from '../lib/zipGeography';

interface JobWithCalc {
  job: Job;
  calc: JobCalculation;
  mergedCosts: Costs;
  mergedPricing: Pricing;
  mergedLaborers: Laborer[];
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

interface LeadMonthRow {
  month: string; // YYYY-MM
  leads: number;
  booked: number;
  decided: number;
  open: number;
  won: number;
  spend: number | null; // null = no spend entered for this month
  bySource: Record<string, number>; // lead counts per source for this month
}

interface LeadSourceRow {
  source: string;
  leads: number;
  booked: number;
  decided: number;
  open: number;
  won: number;
}

const ALL_STATUSES: JobStatus[] = ['Pending', 'Verbal', 'Won', 'Lost'];
type DateRangePreset = 'all' | '30d' | '90d' | 'ytd' | 'custom';
type DateFieldMode = 'install' | 'created';
type ReportView = 'tags' | 'monthly-won' | 'employee-hours' | 'expenses' | 'lead-tracking' | 'leads-by-created-date' | 'zip-geography';

// Stages at or beyond "Estimate Booked" — the lead converted to a booking
const BOOKED_LEAD_STAGES = new Set<LeadStage>(['Estimate Booked', 'Estimate Completed', 'Quoted', 'Won']);
// Terminal stages — the lead is decided even if it never booked
const TERMINAL_LEAD_STAGES = new Set<LeadStage>(['Won', 'Lost', 'Disqualified']);

const NO_SOURCE = '(No Source)';

function leadSourceName(lead: Lead): string {
  return (lead.source || '').trim() || NO_SOURCE;
}

function classifyLead(lead: Lead, leadsWithAppointments: Set<string>) {
  // Booked = ever had an appointment, or stage reached Estimate Booked or beyond
  const booked = leadsWithAppointments.has(lead.id) || BOOKED_LEAD_STAGES.has(lead.stage);
  // Decided = booked or closed out without booking (Lost/Disqualified)
  const decided = booked || TERMINAL_LEAD_STAGES.has(lead.stage);
  return { booked, decided, won: lead.stage === 'Won' };
}

function monthKeyFromDate(value?: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  return new Date(year, mon - 1, 1).toLocaleString('default', { month: 'short', year: 'numeric' });
}

function getDefaultEmpStart() {
  const d = new Date();
  d.setDate(d.getDate() - 13);
  return d.toISOString().slice(0, 10);
}

function getDefaultExpStart() {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}

interface ReportingProps {
  onEditJob: (id: string) => void;
}

export default function Reporting({ onEditJob }: ReportingProps) {
  const [jobsWithCalc, setJobsWithCalc] = useState<JobWithCalc[]>([]);
  const [allLaborers, setAllLaborers] = useState<Laborer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyMessage, setHistoryMessage] = useState('');
  const [activeView, setActiveView] = useState<ReportView>('tags');

  // Tag report filters
  const [statusFilter, setStatusFilter] = useState<JobStatus[]>(['Pending', 'Verbal', 'Won', 'Lost']);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagMatchMode, setTagMatchMode] = useState<'any' | 'all'>('any');
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('all');
  const [dateFieldMode, setDateFieldMode] = useState<DateFieldMode>('install');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Monthly won jobs month offset (0 = current month, -1 = last month, +1 = next month)
  const [monthOffset, setMonthOffset] = useState(0);

  // Employee hours date range
  const [empStartDate, setEmpStartDate] = useState(getDefaultEmpStart);
  const [empEndDate, setEmpEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Expenses report date range (defaults to year-to-date)
  const [expStartDate, setExpStartDate] = useState(getDefaultExpStart);
  const [expEndDate, setExpEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Lead tracking data
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadAppointments, setLeadAppointments] = useState<LeadAppointment[]>([]);
  const [adSpendRecords, setAdSpendRecords] = useState<AdSpend[]>([]);
  const [spendDrafts, setSpendDrafts] = useState<Record<string, string>>({});
  const [savingSpendMonth, setSavingSpendMonth] = useState<string | null>(null);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allJobs, currentCosts, currentPricing, laborers, allLeads, allAppointments, allAdSpend] = await Promise.all([
        getAllJobs(),
        getCosts(),
        getPricing(),
        getAllLaborers(),
        getAllLeads(),
        getAllLeadAppointments(),
        getAllAdSpend(),
      ]);
      setAllLaborers(laborers.filter((l) => !l.deleted));
      setLeads(allLeads);
      setLeadAppointments(allAppointments);
      setAdSpendRecords(allAdSpend);
      const costs = currentCosts || getDefaultCosts();
      const pricing = currentPricing || getDefaultPricing();

      const activeLaborers = laborers.filter((l) => !l.deleted);

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
        // Mirror JobForm: prefer current laborer rates; fall back to snapshot for deleted laborers
        const mergedLaborers: Laborer[] = [
          ...activeLaborers,
          ...job.laborersSnapshot.filter((sl) => !activeLaborers.some((al) => al.id === sl.id)),
        ];
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
          mergedLaborers,
          mergedPricing
        );
        return { job, calc, mergedCosts, mergedPricing, mergedLaborers };
      });

      setJobsWithCalc(withCalc);
    } catch (error) {
      console.error('Error loading reporting data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLoadFullHistory = useCallback(async () => {
    if (loadingHistory) return;

    setLoadingHistory(true);
    setHistoryMessage('');

    try {
      const result = await loadAllHistoricalJobsFromSupabase();

      if (result.errors.length > 0) {
        setHistoryMessage(result.errors[0]);
        return;
      }

      setHistoryMessage(`${result.recordsPulled} historical job${result.recordsPulled === 1 ? '' : 's'} loaded.`);
      await loadData();
    } finally {
      setLoadingHistory(false);
    }
  }, [loadData, loadingHistory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const zipGeographyJobs = useMemo(
    () => jobsWithCalc.map(({ job }) => job),
    [jobsWithCalc]
  );

  const handleApplyZip = useCallback(async (jobIds: readonly string[], zip: string) => {
    const requestedIds = new Set(jobIds);
    const now = new Date().toISOString();
    const updates = jobsWithCalc
      .map(({ job }) => job)
      .filter((job) => requestedIds.has(job.id))
      .map((job) => ({
        ...job,
        customerAddress: applyZipToAddress(job.customerAddress, zip),
        updatedAt: now,
        synced: false,
      }));

    if (updates.length !== requestedIds.size) {
      throw new Error('Some matching jobs are no longer loaded. Refresh the report and try again.');
    }

    const results = await Promise.allSettled(updates.map((job) => updateJob(job)));
    await loadData();
    const failed = results.filter((result) => result.status === 'rejected');
    if (failed.length > 0) {
      throw new Error(`${failed.length} ${failed.length === 1 ? 'job' : 'jobs'} could not be updated. The report was refreshed to show the saved results.`);
    }
  }, [jobsWithCalc, loadData]);

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
    const monthStart = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0, 23, 59, 59);

    return jobsWithCalc
      .filter(({ job }) => {
        if (job.status !== 'Won' || !job.installDate) return false;
        const d = new Date(`${job.installDate}T00:00:00`);
        return d >= monthStart && d <= monthEnd;
      })
      .map(({ job, calc, mergedCosts, mergedPricing, mergedLaborers }) => {
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
              actualMoistureMitigationGallons: job.actualMoistureMitigationGallons || 0,
              chipBoxCost: job.systemSnapshot?.boxCost ?? 0,
              totalPrice: job.totalPrice,
              installDays: job.installDays,
              installDate: job.installDate,
              travelDistance: job.travelDistance,
              disableGasHeater: job.disableGasHeater,
            },
            mergedCosts,
            mergedPricing,
            mergedLaborers
          );
        }

        return { job, calc, estMargin, actuals };
      })
      .sort((a, b) => a.job.installDate.localeCompare(b.job.installDate));
  }, [jobsWithCalc, monthOffset]);

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

  // ==================== EXPENSES ====================

  const expensesData = useMemo(() => {
    const start = expStartDate ? new Date(`${expStartDate}T00:00:00`) : null;
    const end = expEndDate ? new Date(`${expEndDate}T23:59:59`) : null;

    const categories: { label: string; field: keyof ActualCosts }[] = [
      { label: 'Chip', field: 'actualChipCost' },
      { label: 'Base Coat', field: 'actualBaseCost' },
      { label: 'Top Coat', field: 'actualTopCost' },
      { label: 'Cyclo 1', field: 'actualCyclo1Cost' },
      { label: 'Tint', field: 'actualTintCost' },
      { label: 'Crack Repair', field: 'actualCrackRepairCost' },
      { label: 'Moisture Mitigation', field: 'actualMoistureMitigationCost' },
      { label: 'Gas – Generator', field: 'actualGasGeneratorCost' },
      { label: 'Gas – Heater', field: 'actualGasHeaterCost' },
      { label: 'Gas – Travel', field: 'actualGasTravelCost' },
      { label: 'Labor', field: 'actualLaborCost' },
      { label: 'Consumables', field: 'actualConsumablesCost' },
      { label: 'Royalty', field: 'actualRoyaltyCost' },
      { label: 'Adjustments', field: 'actualExpenseAdjustment' },
    ];

    const totals = new Map<string, number>(categories.map((c) => [c.field, 0]));
    let jobCount = 0;

    jobsWithCalc.forEach(({ job, mergedCosts, mergedPricing, mergedLaborers }) => {
      if (job.status !== 'Won' || !job.installDate) return;
      const d = new Date(`${job.installDate}T00:00:00`);
      if (start && d < start) return;
      if (end && d > end) return;
      if (!job.actualInstallSchedule || job.actualInstallSchedule.length === 0) return;

      const actuals = calculateActualCosts(
        {
          actualSchedule: job.actualInstallSchedule,
          actualBaseCoatGallons: job.actualBaseCoatGallons || 0,
          actualTopCoatGallons: job.actualTopCoatGallons || 0,
          actualCyclo1Gallons: job.actualCyclo1Gallons || 0,
          actualTintOz: job.actualTintOz || 0,
          actualChipBoxes: job.actualChipBoxes || 0,
          actualCrackRepairOz: job.actualCrackRepairOz || 0,
          actualMoistureMitigationGallons: job.actualMoistureMitigationGallons || 0,
          chipBoxCost: job.systemSnapshot?.boxCost ?? 0,
          totalPrice: job.totalPrice,
          installDays: job.installDays,
          installDate: job.installDate,
          travelDistance: job.travelDistance,
          disableGasHeater: job.disableGasHeater,
          actualExpenseAdjustment: job.actualExpenseAdjustment,
        },
        mergedCosts,
        mergedPricing,
        mergedLaborers
      );

      jobCount += 1;
      categories.forEach(({ field }) => {
        totals.set(field, (totals.get(field) ?? 0) + actuals[field]);
      });
    });

    const rows = categories.map(({ label, field }) => ({
      label,
      field,
      total: totals.get(field) ?? 0,
    }));
    const grandTotal = rows.reduce((s, r) => s + r.total, 0);

    return { rows, grandTotal, jobCount };
  }, [jobsWithCalc, expStartDate, expEndDate]);

  // ==================== LEAD TRACKING ====================

  const availableLeadSources = useMemo(() => {
    const sources = new Set(leads.map(leadSourceName));
    const named = Array.from(sources).filter((s) => s !== NO_SOURCE).sort((a, b) => a.localeCompare(b));
    return sources.has(NO_SOURCE) ? [...named, NO_SOURCE] : named;
  }, [leads]);

  const sourceFilteredLeads = useMemo(() => (
    selectedSources.length === 0
      ? leads
      : leads.filter((lead) => selectedSources.includes(leadSourceName(lead)))
  ), [leads, selectedSources]);

  // Source columns for the monthly table (respects the source filter)
  const leadSourceColumns = useMemo(() => {
    const sources = new Set(sourceFilteredLeads.map(leadSourceName));
    const named = Array.from(sources).filter((s) => s !== NO_SOURCE).sort((a, b) => a.localeCompare(b));
    return sources.has(NO_SOURCE) ? [...named, NO_SOURCE] : named;
  }, [sourceFilteredLeads]);

  const leadTrackingRows = useMemo((): LeadMonthRow[] => {
    const spendByMonth = new Map<string, number>();
    adSpendRecords.forEach((r) => spendByMonth.set(r.month, r.amount));

    const leadsWithAppointments = new Set(leadAppointments.map((a) => a.leadId));

    // Bucket leads by the month they came in
    const byMonth = new Map<string, { leads: number; booked: number; decided: number; won: number; bySource: Record<string, number> }>();
    sourceFilteredLeads.forEach((lead) => {
      const month = monthKeyFromDate(lead.firstSeenAt || lead.createdAt);
      if (!month) return;

      if (!byMonth.has(month)) {
        byMonth.set(month, { leads: 0, booked: 0, decided: 0, won: 0, bySource: {} });
      }
      const entry = byMonth.get(month)!;
      const { booked, decided, won } = classifyLead(lead, leadsWithAppointments);
      const source = leadSourceName(lead);
      entry.leads += 1;
      entry.bySource[source] = (entry.bySource[source] || 0) + 1;
      if (booked) entry.booked += 1;
      if (decided) entry.decided += 1;
      if (won) entry.won += 1;
    });

    // Continuous month range: earliest month with data through the current month
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthsWithData = [...byMonth.keys(), ...spendByMonth.keys()];
    const firstMonth = monthsWithData.length > 0
      ? monthsWithData.reduce((min, m) => (m < min ? m : min), currentMonth)
      : currentMonth;

    const rows: LeadMonthRow[] = [];
    const [startYear, startMon] = firstMonth.split('-').map(Number);
    const cursor = new Date(startYear, startMon - 1, 1);
    while (true) {
      const month = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      if (month > currentMonth) break;
      const entry = byMonth.get(month) || { leads: 0, booked: 0, decided: 0, won: 0, bySource: {} };
      rows.push({
        month,
        leads: entry.leads,
        booked: entry.booked,
        decided: entry.decided,
        open: entry.leads - entry.decided,
        won: entry.won,
        spend: spendByMonth.has(month) ? spendByMonth.get(month)! : null,
        bySource: entry.bySource,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return rows.reverse(); // newest first
  }, [sourceFilteredLeads, leadAppointments, adSpendRecords]);

  const leadTrackingTotals = useMemo(() => {
    const totals = leadTrackingRows.reduce(
      (acc, row) => {
        acc.leads += row.leads;
        acc.booked += row.booked;
        acc.decided += row.decided;
        acc.open += row.open;
        acc.won += row.won;
        acc.spend += row.spend ?? 0;
        Object.entries(row.bySource).forEach(([source, count]) => {
          acc.bySource[source] = (acc.bySource[source] || 0) + count;
        });
        return acc;
      },
      { leads: 0, booked: 0, decided: 0, open: 0, won: 0, spend: 0, bySource: {} as Record<string, number> }
    );
    return {
      ...totals,
      costPerLead: totals.leads > 0 ? totals.spend / totals.leads : null,
      bookingPct: totals.leads > 0 ? (totals.booked / totals.leads) * 100 : null,
      decidedBookingPct: totals.decided > 0 ? (totals.booked / totals.decided) * 100 : null,
    };
  }, [leadTrackingRows]);

  // Per-source breakdown across all months (unaffected by the source filter chips)
  const leadSourceRows = useMemo((): LeadSourceRow[] => {
    const leadsWithAppointments = new Set(leadAppointments.map((a) => a.leadId));
    const bySource = new Map<string, LeadSourceRow>();

    leads.forEach((lead) => {
      const source = leadSourceName(lead);
      if (!bySource.has(source)) {
        bySource.set(source, { source, leads: 0, booked: 0, decided: 0, open: 0, won: 0 });
      }
      const entry = bySource.get(source)!;
      const { booked, decided, won } = classifyLead(lead, leadsWithAppointments);
      entry.leads += 1;
      if (booked) entry.booked += 1;
      if (decided) entry.decided += 1;
      else entry.open += 1;
      if (won) entry.won += 1;
    });

    const named = Array.from(bySource.values())
      .filter((r) => r.source !== NO_SOURCE)
      .sort((a, b) => b.leads - a.leads);
    const noSource = bySource.get(NO_SOURCE);
    return noSource ? [...named, noSource] : named;
  }, [leads, leadAppointments]);

  const handleSaveSpend = async (month: string) => {
    const draft = spendDrafts[month];
    if (draft === undefined) return; // untouched

    const existing = adSpendRecords.find((r) => r.month === month);
    if (draft.trim() === '' && !existing) {
      // Nothing entered and nothing stored — leave as "no spend recorded"
      setSpendDrafts((prev) => {
        const next = { ...prev };
        delete next[month];
        return next;
      });
      return;
    }

    const amount = draft.trim() === '' ? 0 : Number(draft);
    if (Number.isNaN(amount) || amount < 0) return;
    if (existing && existing.amount === amount) {
      setSpendDrafts((prev) => {
        const next = { ...prev };
        delete next[month];
        return next;
      });
      return;
    }

    setSavingSpendMonth(month);
    try {
      const saved = await setAdSpendForMonth(month, amount);
      setAdSpendRecords((prev) => {
        const others = prev.filter((r) => r.id !== saved.id);
        return [...others, saved];
      });
      setSpendDrafts((prev) => {
        const next = { ...prev };
        delete next[month];
        return next;
      });
    } catch (error) {
      console.error('Error saving ad spend:', error);
    } finally {
      setSavingSpendMonth(null);
    }
  };

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

  const selectedMonth = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  }, [monthOffset]);
  const currentMonthLabel = selectedMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  // ==================== RENDER ====================

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Reporting</h1>
        <p className="text-sm sm:text-base text-slate-600 mt-1">Reports and analytics</p>
      </div>

      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center gap-2">
        <button
          type="button"
          onClick={handleLoadFullHistory}
          disabled={loadingHistory}
          className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loadingHistory ? 'Loading History...' : 'Load Full Job History'}
        </button>
        {historyMessage && (
          <p className="text-xs text-slate-500">{historyMessage}</p>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1 mb-4 sm:mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        {([
          { id: 'tags', label: 'Tag Report' },
          { id: 'monthly-won', label: 'Monthly Won Jobs' },
          { id: 'employee-hours', label: 'Employee Hours' },
          { id: 'expenses', label: 'Expenses' },
          { id: 'lead-tracking', label: 'Lead Tracking' },
          { id: 'leads-by-created-date', label: 'Leads by Date' },
          { id: 'zip-geography', label: 'ZIP Geography' },
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
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMonthOffset((prev) => prev - 1)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                    aria-label="Previous month"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg sm:text-xl font-semibold text-slate-900">{currentMonthLabel}</h2>
                    {monthOffset !== 0 && (
                      <button
                        type="button"
                        onClick={() => setMonthOffset(0)}
                        className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
                      >
                        Today
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setMonthOffset((prev) => prev + 1)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                    aria-label="Next month"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">Won jobs with install date in {monthOffset === 0 ? 'the current month' : currentMonthLabel}</p>
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
                            <tr
                              key={job.id}
                              className="border-b border-slate-200 hover:bg-slate-50 cursor-pointer"
                              onClick={() => onEditJob(job.id)}
                            >
                              <td className="px-4 py-3 text-sm font-medium text-gf-dark-green hover:underline">{job.name}</td>
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

          {/* ===== EXPENSES ===== */}
          {activeView === 'expenses' && (
            <>
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 mb-4 sm:mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <label className="text-xs sm:text-sm text-slate-600 font-medium whitespace-nowrap">Install Date Range:</label>
                  <input
                    type="date"
                    value={expStartDate}
                    onChange={(e) => setExpStartDate(e.target.value)}
                    className="px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-gf-lime"
                  />
                  <span className="text-slate-400 text-sm">to</span>
                  <input
                    type="date"
                    value={expEndDate}
                    onChange={(e) => setExpEndDate(e.target.value)}
                    className="px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-gf-lime"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setExpStartDate(getDefaultExpStart());
                      setExpEndDate(new Date().toISOString().slice(0, 10));
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Year to Date
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-2">Shows actual expenses from won jobs with actuals recorded and an install date in this range.</p>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
                  <p className="text-xs text-slate-500">Jobs with Actuals</p>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900">{expensesData.jobCount}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
                  <p className="text-xs text-slate-500">Total Expenses</p>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900">{formatCurrency(expensesData.grandTotal)}</p>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-3 sm:p-4 border-b border-slate-200">
                  <h3 className="text-base font-semibold text-slate-900">Expenses by Category</h3>
                </div>
                {expensesData.jobCount === 0 ? (
                  <div className="p-6 sm:p-8 text-center text-slate-600 text-sm">
                    No Won jobs with actuals in this date range.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Category</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Total</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">% of Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expensesData.rows.map((row) => {
                          const isZero = row.total === 0;
                          const pct = expensesData.grandTotal !== 0 ? (row.total / expensesData.grandTotal) * 100 : 0;
                          return (
                            <tr key={row.field} className="border-b border-slate-200 hover:bg-slate-50">
                              <td className={`px-4 py-3 text-sm font-medium ${isZero ? 'text-slate-400' : 'text-slate-900'}`}>{row.label}</td>
                              {isZero ? (
                                <>
                                  <td className="px-4 py-3 text-sm text-right text-slate-300">—</td>
                                  <td className="px-4 py-3 text-sm text-right text-slate-300">—</td>
                                </>
                              ) : (
                                <>
                                  <td className={`px-4 py-3 text-sm text-right ${row.total < 0 ? 'text-red-600' : 'text-slate-700'}`}>{formatCurrency(row.total)}</td>
                                  <td className="px-4 py-3 text-sm text-right text-slate-600">{pct.toFixed(1)}%</td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 border-t-2 border-slate-300 font-semibold">
                          <td className="px-4 py-3 text-sm font-semibold text-slate-700">Total</td>
                          <td className="px-4 py-3 text-sm font-semibold text-right text-slate-900">{formatCurrency(expensesData.grandTotal)}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-right text-slate-700">100.0%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ===== ZIP GEOGRAPHY ===== */}
          {activeView === 'zip-geography' && (
            <ZipGeographyReport
              jobs={zipGeographyJobs}
              onApplyZip={handleApplyZip}
              onEditJob={onEditJob}
            />
          )}

          {/* ===== LEADS BY CREATED DATE ===== */}
          {activeView === 'leads-by-created-date' && <LeadCreatedDateReport leads={leads} />}

          {/* ===== LEAD TRACKING ===== */}
          {activeView === 'lead-tracking' && (
            <>
              {/* Source filter */}
              {availableLeadSources.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 mb-4 sm:mb-6">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-xs sm:text-sm text-slate-600 font-medium">Source:</label>
                    {availableLeadSources.map((source) => (
                      <button
                        key={source}
                        type="button"
                        onClick={() => setSelectedSources((prev) => (
                          prev.includes(source)
                            ? prev.filter((s) => s !== source)
                            : [...prev, source]
                        ))}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          selectedSources.includes(source)
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        } ${source === NO_SOURCE ? 'italic' : ''}`}
                      >
                        {source}
                      </button>
                    ))}
                    {selectedSources.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedSources([])}
                        className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Filters the monthly table and summary cards. Ad spend is entered per month regardless of source —
                    filter to your paid source(s) to see cost per lead for just those leads.
                  </p>
                </div>
              )}

              {/* Summary cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
                  <p className="text-xs text-slate-500">Total Leads</p>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900">{leadTrackingTotals.leads}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
                  <p className="text-xs text-slate-500">Total Ad Spend</p>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900">{formatCurrency(leadTrackingTotals.spend)}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
                  <p className="text-xs text-slate-500">Cost / Lead</p>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900">
                    {leadTrackingTotals.costPerLead !== null && leadTrackingTotals.spend > 0
                      ? formatCurrency(leadTrackingTotals.costPerLead)
                      : '—'}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
                  <p className="text-xs text-slate-500">Lead → Booking</p>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900">
                    {leadTrackingTotals.bookingPct !== null ? `${leadTrackingTotals.bookingPct.toFixed(1)}%` : '—'}
                  </p>
                  {leadTrackingTotals.decidedBookingPct !== null && (
                    <p className="text-xs text-slate-400 mt-0.5">{leadTrackingTotals.decidedBookingPct.toFixed(1)}% of decided</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-3 sm:p-4 border-b border-slate-200">
                  <h3 className="text-base font-semibold text-slate-900">Leads by Month &amp; Source</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Leads are grouped by the month they came in, with a column per source. Enter your advertising spend for each month to see cost per lead.
                    Booked = the lead got an estimate appointment (or reached Estimate Booked or beyond).
                    Booking % (decided) only counts leads that booked or closed out (Lost/Disqualified) — it ignores leads still being
                    worked, so recent months aren't dragged down by leads that haven't had time to book yet.
                  </p>
                </div>
                {leadTrackingRows.length === 0 ? (
                  <div className="p-6 sm:p-8 text-center text-slate-600 text-sm">
                    No leads recorded yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Month</th>
                          {leadSourceColumns.map((source) => (
                            <th key={source} className={`px-3 py-3 text-right text-sm font-semibold whitespace-nowrap ${source === NO_SOURCE ? 'text-slate-400 italic' : 'text-slate-700'}`}>
                              {source}
                            </th>
                          ))}
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700 border-l border-slate-200">Leads</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Ad Spend</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Cost / Lead</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Booked</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Booking %</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Booking % (Decided)</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Still Open</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Won</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leadTrackingRows.map((row) => {
                          const draft = spendDrafts[row.month];
                          const spendValue = draft !== undefined ? draft : (row.spend !== null ? String(row.spend) : '');
                          const costPerLead = row.spend !== null && row.leads > 0 ? row.spend / row.leads : null;
                          const bookingPct = row.leads > 0 ? (row.booked / row.leads) * 100 : null;
                          const decidedPct = row.decided > 0 ? (row.booked / row.decided) * 100 : null;
                          return (
                            <tr key={row.month} className="border-b border-slate-200 hover:bg-slate-50">
                              <td className="px-4 py-3 text-sm font-medium text-slate-900 whitespace-nowrap">{monthLabel(row.month)}</td>
                              {leadSourceColumns.map((source) => {
                                const count = row.bySource[source] || 0;
                                return (
                                  <td key={source} className={`px-3 py-3 text-sm text-right ${count === 0 ? 'text-slate-300' : 'text-slate-700'}`}>
                                    {count === 0 ? '—' : count}
                                  </td>
                                );
                              })}
                              <td className="px-4 py-3 text-sm text-right font-medium text-slate-900 border-l border-slate-200">{row.leads}</td>
                              <td className="px-4 py-3 text-right">
                                <div className="inline-flex items-center gap-1 justify-end">
                                  <span className="text-sm text-slate-400">$</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    inputMode="decimal"
                                    value={spendValue}
                                    placeholder="0"
                                    disabled={savingSpendMonth === row.month}
                                    onChange={(e) => setSpendDrafts((prev) => ({ ...prev, [row.month]: e.target.value }))}
                                    onBlur={() => handleSaveSpend(row.month)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                    }}
                                    className="w-24 px-2 py-1 border border-slate-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-gf-lime disabled:opacity-60"
                                  />
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-slate-700">
                                {costPerLead !== null ? formatCurrency(costPerLead) : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-blue-700">{row.booked}</td>
                              <td className="px-4 py-3 text-sm text-right text-slate-700">
                                {bookingPct !== null ? `${bookingPct.toFixed(1)}%` : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-slate-700">
                                {decidedPct !== null ? `${decidedPct.toFixed(1)}%` : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-amber-700">{row.open}</td>
                              <td className="px-4 py-3 text-sm text-right text-green-700">{row.won}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 border-t-2 border-slate-300">
                          <td className="px-4 py-3 text-sm font-semibold text-slate-700">Total</td>
                          {leadSourceColumns.map((source) => (
                            <td key={source} className="px-3 py-3 text-sm font-semibold text-right text-slate-700">
                              {leadTrackingTotals.bySource[source] || 0}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-sm font-semibold text-right text-slate-900 border-l border-slate-200">{leadTrackingTotals.leads}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-right text-slate-700 pr-6">{formatCurrency(leadTrackingTotals.spend)}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-right text-slate-700">
                            {leadTrackingTotals.costPerLead !== null && leadTrackingTotals.spend > 0
                              ? formatCurrency(leadTrackingTotals.costPerLead)
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-right text-blue-700">{leadTrackingTotals.booked}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-right text-slate-700">
                            {leadTrackingTotals.bookingPct !== null ? `${leadTrackingTotals.bookingPct.toFixed(1)}%` : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-right text-slate-700">
                            {leadTrackingTotals.decidedBookingPct !== null ? `${leadTrackingTotals.decidedBookingPct.toFixed(1)}%` : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-right text-amber-700">{leadTrackingTotals.open}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-right text-green-700">{leadTrackingTotals.won}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Leads by Source */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mt-4 sm:mt-6">
                <div className="p-3 sm:p-4 border-b border-slate-200">
                  <h3 className="text-base font-semibold text-slate-900">Leads by Source</h3>
                  <p className="text-xs text-slate-400 mt-1">All leads across all months, broken down by where they came from.</p>
                </div>
                {leadSourceRows.length === 0 ? (
                  <div className="p-6 sm:p-8 text-center text-slate-600 text-sm">
                    No leads recorded yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Source</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Leads</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">% of Leads</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Booked</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Booking %</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Booking % (Decided)</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Still Open</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Won</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leadSourceRows.map((row) => {
                          const totalLeads = leads.length;
                          const shareOfLeads = totalLeads > 0 ? (row.leads / totalLeads) * 100 : null;
                          const bookingPct = row.leads > 0 ? (row.booked / row.leads) * 100 : null;
                          const decidedPct = row.decided > 0 ? (row.booked / row.decided) * 100 : null;
                          const isNoSource = row.source === NO_SOURCE;
                          return (
                            <tr key={row.source} className={`border-b border-slate-200 hover:bg-slate-50 ${isNoSource ? 'bg-slate-50' : ''}`}>
                              <td className={`px-4 py-3 text-sm font-medium ${isNoSource ? 'text-slate-400 italic' : 'text-slate-900'}`}>{row.source}</td>
                              <td className="px-4 py-3 text-sm text-right text-slate-700">{row.leads}</td>
                              <td className="px-4 py-3 text-sm text-right text-slate-600">
                                {shareOfLeads !== null ? `${shareOfLeads.toFixed(1)}%` : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-blue-700">{row.booked}</td>
                              <td className="px-4 py-3 text-sm text-right text-slate-700">
                                {bookingPct !== null ? `${bookingPct.toFixed(1)}%` : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-slate-700">
                                {decidedPct !== null ? `${decidedPct.toFixed(1)}%` : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-amber-700">{row.open}</td>
                              <td className="px-4 py-3 text-sm text-right text-green-700">{row.won}</td>
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
        </>
      )}
    </div>
  );
}
