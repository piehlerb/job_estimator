import { Plus, Trash2, FileText, Search, Bell, Check, X, ChevronDown, ChevronLeft, ChevronRight, Link, Shuffle, PhoneCall, SlidersHorizontal, Calendar, Clock, Wrench, FileSearch, AlertTriangle } from 'lucide-react';
import { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import { Star, MoreHorizontal, Pencil } from 'lucide-react';
import JobStarButton from '../components/JobStarButton';
import { isHotJob, setJobHot } from '../lib/hotJobs';
import { getJob } from '../lib/db';
import { getAllJobs, deleteJob, updateJob, getDefaultCosts, getCosts, getPricing, getDefaultPricing, getAllCommTemplates } from '../lib/db';
import { Job, JobCalculation, Costs, Pricing, JobStatus, JobReminder, CommunicationTemplate } from '../types';
import { calculateJobOutputs } from '../lib/calculations';
import { useAuth } from '../contexts/AuthContext';
import { loadOlderJobsFromSupabase } from '../lib/sync';
import { getJobWorkingSetCutoff } from '../lib/jobSyncPolicy';
import { findPendingJobsWithoutActiveReminders } from '../lib/reminderCoverage';
import { localToday, timestampToLocalDateString, addDaysToLocalDate } from '../lib/dateUtils';

interface DashboardProps {
  onViewJobSheet: (id: string) => void;
  onNewJob: () => void;
  onEditJob: (id: string) => void;
}

interface JobWithCalc {
  job: Job;
  calc: JobCalculation;
}

interface ReminderItem {
  reminderId: string;
  jobId: string;
  jobName: string;
  subject: string;
  details?: string;
  dueAt: string;
}

const ALL_STATUSES: JobStatus[] = ['Pending', 'Verbal', 'Won', 'Lost'];

const FILTERS_STORAGE_KEY = 'dashboard_filters';

const getSavedFilters = () => {
  try {
    return JSON.parse(localStorage.getItem(FILTERS_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

export default function Dashboard({ onNewJob, onEditJob, onViewJobSheet }: DashboardProps) {
  const { permissions } = useAuth();
  const canWriteJobs = permissions.jobs === 'write';
  const isReadOnlyJobs = permissions.jobs === 'read';
  const [jobsWithCalc, setJobsWithCalc] = useState<JobWithCalc[]>([]);
  const [loading, setLoading] = useState(true);
  const [hotJobsExpanded, setHotJobsExpanded] = useState(() => {
    try { return localStorage.getItem('dashboard_hot_jobs_expanded_v1') === 'true'; } catch { return false; }
  });
  const [starError, setStarError] = useState('');
  const [starringIds, setStarringIds] = useState<Set<string>>(new Set());
  const starRequests = useRef(new Set<string>());
  const hotJobs = useMemo(() => jobsWithCalc.filter(({ job }) => !job.deleted && isHotJob(job))
    .sort((a, b) => (a.job.name || '').localeCompare(b.job.name || '')), [jobsWithCalc]);

  const toggleHotJob = async (job: Job) => {
    if (!canWriteJobs || starRequests.current.has(job.id)) return;
    starRequests.current.add(job.id);
    setStarringIds(new Set(starRequests.current));
    setStarError('');
    try {
      const latest = await getJob(job.id);
      if (!latest) throw new Error('This job is no longer available.');
      const updated = setJobHot(latest, !isHotJob(latest));
      await updateJob(updated);
      setJobsWithCalc(current => current.map(item => item.job.id === job.id ? { ...item, job: updated } : item));
    } catch {
      setStarError('Could not save the star. Please try again.');
    } finally {
      starRequests.current.delete(job.id);
      setStarringIds(new Set(starRequests.current));
    }
  };

  const starButton = (job: Job) => canWriteJobs ? (
    <JobStarButton job={job} disabled={starringIds.has(job.id)} onToggle={toggleHotJob} />
  ) : null;

  // Filter/sort state — persisted to localStorage so it survives navigation away and back
  const _saved = getSavedFilters();
  const [sortBy, setSortBy] = useState<'date' | 'price' | 'margin'>(_saved.sortBy ?? 'date');
  const [statusFilter, setStatusFilter] = useState<JobStatus[]>(_saved.statusFilter ?? ['Pending', 'Verbal', 'Won']);
  const [probabilityFilter, setProbabilityFilter] = useState<number>(_saved.probabilityFilter ?? 0);
  const [chipBlendFilter, setChipBlendFilter] = useState<string>(_saved.chipBlendFilter ?? '');
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>(_saved.selectedTagFilters ?? []);
  const [tagMatchMode, setTagMatchMode] = useState<'any' | 'all'>(_saved.tagMatchMode ?? 'any');
  const [searchQuery, setSearchQuery] = useState<string>(_saved.searchQuery ?? '');
  const [viewMode, setViewMode] = useState<'jobs' | 'needs-contact' | 'today' | 'reminders'>(_saved.viewMode ?? 'jobs');
  const [showFilters, setShowFilters] = useState<boolean>(_saved.showFilters ?? false);
  const [showInactive, setShowInactive] = useState<boolean>(_saved.showInactive ?? false);
  // Day shown on the Today tab — resets to today whenever the tab is opened
  const [selectedDay, setSelectedDay] = useState<string>(localToday());

  const [showReminders, setShowReminders] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<ReminderItem | null>(null);
  const [updatingReminder, setUpdatingReminder] = useState(false);
  const [checkingMissingReminders, setCheckingMissingReminders] = useState(false);
  const [showMissingRemindersModal, setShowMissingRemindersModal] = useState(false);
  const [pendingJobsWithoutReminders, setPendingJobsWithoutReminders] = useState<Job[]>([]);
  const [nextReminderFor, setNextReminderFor] = useState<{ jobId: string; jobName: string; customerName?: string } | null>(null);
  const [nextReminderForm, setNextReminderForm] = useState({ subject: '', dueDate: '', dueTime: '', details: '' });
  const [commTemplates, setCommTemplates] = useState<CommunicationTemplate[]>([]);
  const [overdueExpanded, setOverdueExpanded] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [rowMenu, setRowMenu] = useState<{ jobId: string; top: number; right: number } | null>(null);
  const [dashboardPricing, setDashboardPricing] = useState<Pricing>(getDefaultPricing());
  const [loadingOlderJobs, setLoadingOlderJobs] = useState(false);
  const [olderJobsCursor, setOlderJobsCursor] = useState(() => getJobWorkingSetCutoff().date);
  const [hasMoreOlderJobs, setHasMoreOlderJobs] = useState(true);
  const [olderJobsMessage, setOlderJobsMessage] = useState('');

  // Persist filter/sort state whenever it changes
  useEffect(() => {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify({
      sortBy, statusFilter, probabilityFilter, chipBlendFilter,
      selectedTagFilters, tagMatchMode, searchQuery, viewMode, showFilters, showInactive,
    }));
  }, [sortBy, statusFilter, probabilityFilter, chipBlendFilter, selectedTagFilters, tagMatchMode, searchQuery, viewMode, showFilters, showInactive]);

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
      const [allJobs, currentCosts, currentPricing, templates] = await Promise.all([
        getAllJobs(),
        getCosts(),
        getPricing(),
        getAllCommTemplates(),
      ]);
      setCommTemplates(templates);
      const costs = currentCosts || getDefaultCosts();
      const pricing = currentPricing || getDefaultPricing();
      setDashboardPricing({ ...getDefaultPricing(), ...pricing });

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
            products: job.products,
            includeBasecoatTint: job.includeBasecoatTint || false,
            includeTopcoatTint: job.includeTopcoatTint || false,
            antiSlip: job.antiSlip || false,
            abrasionResistance: job.abrasionResistance || false,
            cyclo1Topcoat: job.cyclo1Topcoat || false,
            cyclo1Coats: job.cyclo1Coats || 0,
            coatingRemoval: job.coatingRemoval || 'None',
            moistureMitigation: job.moistureMitigation || false,
            tags: job.tags,
            spreadRateOverrides: job.spreadRateOverrides,
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

  const handleLoadOlderJobs = async () => {
    if (loadingOlderJobs || !hasMoreOlderJobs) return;

    setLoadingOlderJobs(true);
    setOlderJobsMessage('');

    try {
      const result = await loadOlderJobsFromSupabase({
        beforeInstallDate: olderJobsCursor,
        limit: 100,
      });

      if (result.errors.length > 0) {
        setOlderJobsMessage(result.errors[0]);
        return;
      }

      if (result.oldestInstallDate) {
        setOlderJobsCursor(result.oldestInstallDate);
      }
      setHasMoreOlderJobs(result.hasMore ?? false);

      if (result.recordsPulled === 0) {
        setOlderJobsMessage('No older jobs found.');
      } else {
        setOlderJobsMessage(`${result.recordsPulled} older job${result.recordsPulled === 1 ? '' : 's'} loaded.`);
        await loadJobs();
      }
    } finally {
      setLoadingOlderJobs(false);
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

  // Get unique tags from all jobs
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    jobsWithCalc.forEach(({ job }) => {
      (job.tags || []).forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [jobsWithCalc]);

  const handleDeleteJob = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this job?')) {
      try {
        // Capture groupId before deletion so we can clean up afterwards
        const deletingJob = jobsWithCalc.find(({ job }) => job.id === id)?.job;
        const groupId = deletingJob?.groupId;

        await deleteJob(id);

        // If the job belonged to a group, check if only 1 sibling remains
        // and if so, ungroup that sibling (a group of 1 is meaningless)
        if (groupId) {
          const allJobs = await getAllJobs();
          const remaining = allJobs.filter(j => j.groupId === groupId && !j.deleted);
          if (remaining.length === 1) {
            const lone = remaining[0];
            await updateJob({
              ...lone,
              groupId: undefined,
              groupType: undefined,
              isPrimaryEstimate: undefined,
              updatedAt: new Date().toISOString(),
              synced: false,
            });
          }
        }

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

  const handleTagToggle = (tag: string) => {
    setSelectedTagFilters((prev) => (
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag]
    ));
  };

  const handleClearFilters = () => {
    setStatusFilter(['Pending', 'Verbal', 'Won']);
    setProbabilityFilter(0);
    setChipBlendFilter('');
    setSelectedTagFilters([]);
    setTagMatchMode('any');
    setSearchQuery('');
    setSortBy('date');
  };

  // Filter and sort jobs
  const jobsBeforeStatusFilter = useMemo(() => {
    let filtered = jobsWithCalc;

    // Hide Won jobs whose install date is 5+ days in the past (unless showing inactive)
    if (!showInactive) {
      const fiveDaysAgoMs = Date.now() - 5 * 24 * 60 * 60 * 1000;
      filtered = filtered.filter(({ job }) => {
        if (job.status !== 'Won' || !job.installDate) return true;
        const installMs = new Date(job.installDate + 'T12:00:00').getTime();
        return isNaN(installMs) || installMs > fiveDaysAgoMs;
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(({ job }) =>
        (job.name || '').toLowerCase().includes(query) ||
        (job.customerName || '').toLowerCase().includes(query)
      );
    }

    // Apply probability filter
    if (probabilityFilter > 0) {
      filtered = filtered.filter(({ job }) => (job.probability ?? 20) >= probabilityFilter);
    }

    // Apply chip blend filter
    if (chipBlendFilter) {
      filtered = filtered.filter(({ job }) => job.chipBlend === chipBlendFilter);
    }

    // Apply tag filters (any/all)
    if (selectedTagFilters.length > 0) {
      filtered = filtered.filter(({ job }) => {
        const jobTags = job.tags || [];
        if (tagMatchMode === 'all') {
          return selectedTagFilters.every((tag) => jobTags.includes(tag));
        }
        return selectedTagFilters.some((tag) => jobTags.includes(tag));
      });
    }

    return filtered;
  }, [jobsWithCalc, searchQuery, probabilityFilter, chipBlendFilter, selectedTagFilters, tagMatchMode, showInactive]);

  // Per-status counts for the status chips (reflect every filter except status itself)
  const statusCounts = useMemo(() => {
    const counts: Record<JobStatus, number> = { Pending: 0, Verbal: 0, Won: 0, Lost: 0 };
    for (const { job } of jobsBeforeStatusFilter) {
      if (job.status in counts) counts[job.status]++;
    }
    return counts;
  }, [jobsBeforeStatusFilter]);

  const filteredAndSortedJobs = useMemo(() => {
    const filtered = statusFilter.length > 0
      ? jobsBeforeStatusFilter.filter(({ job }) => statusFilter.includes(job.status))
      : jobsBeforeStatusFilter;

    // Sort
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return b.job.totalPrice - a.job.totalPrice;
        case 'margin': {
          const marginA = a.job.totalPrice > 0 ? ((a.job.totalPrice - a.calc.totalCosts) / a.job.totalPrice) * 100 : 0;
          const marginB = b.job.totalPrice > 0 ? ((b.job.totalPrice - b.calc.totalCosts) / b.job.totalPrice) * 100 : 0;
          return marginB - marginA;
        }
        case 'date':
        default:
          return new Date(b.job.createdAt).getTime() - new Date(a.job.createdAt).getTime();
      }
    });
  }, [jobsBeforeStatusFilter, statusFilter, sortBy]);

  type GroupDisplayItem = {
    type: 'group';
    groupId: string;
    groupType: 'alternative' | 'bundled';
    customerName: string;
    jobs: JobWithCalc[];
    sortKey: number;
    aggregateTotalPrice: number;
    aggregateTotalCosts: number;
  };
  type JobDisplayItem = { type: 'job'; jobWithCalc: JobWithCalc; sortKey: number };
  type DisplayItem = GroupDisplayItem | JobDisplayItem;

  const displayItems = useMemo((): DisplayItem[] => {
    const groupMap = new Map<string, JobWithCalc[]>();
    const ungrouped: JobWithCalc[] = [];

    for (const jwc of filteredAndSortedJobs) {
      if (jwc.job.groupId) {
        const existing = groupMap.get(jwc.job.groupId) || [];
        existing.push(jwc);
        groupMap.set(jwc.job.groupId, existing);
      } else {
        ungrouped.push(jwc);
      }
    }

    const items: DisplayItem[] = [];
    for (const [groupId, jobs] of groupMap.entries()) {
      const sortKey = Math.max(...jobs.map(j => new Date(j.job.createdAt).getTime()));
      const customerName = jobs[0]?.job.customerName || 'Unknown Customer';
      const groupType = jobs[0]?.job.groupType || 'alternative';
      const aggregateTotalPrice = jobs.reduce((s, j) => s + j.job.totalPrice, 0);
      const aggregateTotalCosts = jobs.reduce((s, j) => s + j.calc.totalCosts, 0);
      items.push({ type: 'group', groupId, groupType, customerName, jobs, sortKey, aggregateTotalPrice, aggregateTotalCosts });
    }
    for (const jwc of ungrouped) {
      items.push({ type: 'job', jobWithCalc: jwc, sortKey: new Date(jwc.job.createdAt).getTime() });
    }
    return items.sort((a, b) => b.sortKey - a.sortKey);
  }, [filteredAndSortedJobs]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const overdueReminders = useMemo(() => {
    const todayStr = localToday();
    const items: (ReminderItem & { customerName?: string })[] = [];

    jobsWithCalc.forEach(({ job }) => {
      if (job.status !== 'Pending') return;
      (job.reminders || [])
        .filter(r => !r.completed && r.dueDate <= todayStr)
        .forEach(r => {
          items.push({
            reminderId: r.id,
            jobId: job.id,
            jobName: job.name || 'Untitled Job',
            subject: r.subject,
            details: r.details,
            dueAt: r.dueAt,
            customerName: job.customerName,
          });
        });
    });

    return items.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  }, [jobsWithCalc]);

  const remindersByDue = useMemo((): ReminderItem[] => {
    const allReminders: ReminderItem[] = [];

    jobsWithCalc.forEach(({ job }) => {
      (job.reminders || [])
        .filter((reminder) => !reminder.completed)
        .forEach((reminder) => {
          allReminders.push({
            reminderId: reminder.id,
            jobId: job.id,
            jobName: job.name || 'Untitled Job',
            subject: reminder.subject,
            details: reminder.details,
            dueAt: reminder.dueAt,
          });
        });
    });

    return allReminders.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  }, [jobsWithCalc]);

  const remindersNeedingAttentionCount = useMemo(() => {
    const startOfTomorrow = new Date();
    startOfTomorrow.setHours(24, 0, 0, 0);
    return remindersByDue.filter((reminder) => new Date(reminder.dueAt).getTime() < startOfTomorrow.getTime()).length;
  }, [remindersByDue]);

  const needsContactJobs = useMemo(() => {
    const staleContactDays = dashboardPricing.staleContactDays ?? 30;
    const cutoffMs = staleContactDays * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const getLastContactDate = (job: Job): Date => {
      const candidates: Date[] = [];

      // Completed reminders count as contact
      (job.reminders || []).filter(r => r.completed).forEach(r => {
        candidates.push(new Date(r.dueAt));
      });

      // Logged follow-ups count as contact
      (job.followUps || []).forEach(f => {
        candidates.push(new Date(f.date + 'T12:00:00'));
      });

      if (candidates.length > 0) {
        return candidates.reduce((latest, d) => d > latest ? d : latest);
      }
      return new Date(job.estimateDate || job.createdAt);
    };

    return jobsWithCalc
      .filter(({ job }) => {
        if (job.status !== 'Pending' && job.status !== 'Verbal') return false;
        const hasScheduledReminder = (job.reminders || []).some(
          r => !r.completed && new Date(r.dueAt).getTime() > now
        );
        if (hasScheduledReminder) return false;
        return (now - getLastContactDate(job).getTime()) > cutoffMs;
      })
      .map(({ job }) => ({
        job,
        daysSince: Math.floor((now - getLastContactDate(job).getTime()) / (24 * 60 * 60 * 1000)),
      }))
      .sort((a, b) => b.daysSince - a.daysSince);
  }, [jobsWithCalc, dashboardPricing]);

  const dayItems = useMemo(() => {
    const dayMs = new Date(selectedDay + 'T12:00:00').getTime();
    const msPerDay = 24 * 60 * 60 * 1000;

    const installs: { job: Job; dayNumber: number; totalDays: number }[] = [];
    const estimates: { job: Job }[] = [];
    const reminders: { job: Job; reminder: JobReminder }[] = [];

    for (const { job } of jobsWithCalc) {
      if (job.status === 'Won' && job.installDate) {
        const startMs = new Date(job.installDate + 'T12:00:00').getTime();
        const days = job.installDays || 1;
        const endMs = startMs + (days - 1) * msPerDay;
        if (dayMs >= startMs && dayMs <= endMs) {
          const dayNumber = Math.round((dayMs - startMs) / msPerDay) + 1;
          installs.push({ job, dayNumber, totalDays: days });
        }
      }

      if ((job.estimateDate || timestampToLocalDateString(job.createdAt)) === selectedDay) {
        estimates.push({ job });
      }

      (job.reminders || []).forEach(r => {
        if (!r.completed && r.dueDate === selectedDay) {
          reminders.push({ job, reminder: r });
        }
      });
    }

    reminders.sort((a, b) => a.reminder.dueTime.localeCompare(b.reminder.dueTime));

    return { installs, estimates, reminders };
  }, [jobsWithCalc, selectedDay]);

  const dayTotalCount = dayItems.installs.length + dayItems.estimates.length + dayItems.reminders.length;

  const isSelectedDayToday = selectedDay === localToday();
  const selectedDayLabel = useMemo(() => {
    const d = new Date(selectedDay + 'T12:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }, [selectedDay]);

  const selectedReminderDetails = useMemo(() => {
    if (!selectedReminder) return null;
    const jobEntry = jobsWithCalc.find(({ job }) => job.id === selectedReminder.jobId);
    if (!jobEntry) return null;
    const reminder = (jobEntry.job.reminders || []).find((r) => r.id === selectedReminder.reminderId);
    if (!reminder) return null;
    return {
      job: jobEntry.job,
      reminder,
    };
  }, [selectedReminder, jobsWithCalc]);

  const updateReminderForJob = async (
    jobId: string,
    reminderUpdater: (currentReminders: JobReminder[]) => JobReminder[]
  ) => {
    // Reminders live on the job record, so changing them is a job write
    if (!canWriteJobs) return;
    const jobEntry = jobsWithCalc.find(({ job }) => job.id === jobId);
    if (!jobEntry) return;

    const currentReminders = [...(jobEntry.job.reminders || [])];
    const updatedReminders = reminderUpdater(currentReminders);
    const updatedJob: Job = {
      ...jobEntry.job,
      reminders: updatedReminders.length > 0 ? updatedReminders : undefined,
      updatedAt: new Date().toISOString(),
      synced: false,
    };
    await updateJob(updatedJob);
    await loadJobs();
  };

  const handleCompleteReminder = async (reminderItem: ReminderItem) => {
    setUpdatingReminder(true);
    try {
      await updateReminderForJob(reminderItem.jobId, (currentReminders) => (
        currentReminders.map((r) => (
          r.id === reminderItem.reminderId
            ? { ...r, completed: true, updatedAt: new Date().toISOString() }
            : r
        ))
      ));
      setSelectedReminder(null);
      const jobEntry = jobsWithCalc.find(({ job }) => job.id === reminderItem.jobId);
      setNextReminderFor({ jobId: reminderItem.jobId, jobName: reminderItem.jobName, customerName: jobEntry?.job.customerName });
      setNextReminderForm({ subject: '', dueDate: '', dueTime: '', details: '' });
    } catch (error) {
      console.error('Error completing reminder:', error);
      alert('Error completing reminder.');
    } finally {
      setUpdatingReminder(false);
    }
  };

  const handleCreateNextReminder = async () => {
    if (!nextReminderFor) return;
    if (!nextReminderForm.subject.trim() || !nextReminderForm.dueDate || !nextReminderForm.dueTime) {
      alert('Please enter a subject, date, and time.');
      return;
    }
    setUpdatingReminder(true);
    try {
      const dueAt = new Date(`${nextReminderForm.dueDate}T${nextReminderForm.dueTime}`).toISOString();
      const now = new Date().toISOString();
      const newReminder: JobReminder = {
        id: crypto.randomUUID(),
        subject: nextReminderForm.subject.trim(),
        details: nextReminderForm.details.trim() || undefined,
        dueDate: nextReminderForm.dueDate,
        dueTime: nextReminderForm.dueTime,
        dueAt,
        createdAt: now,
        updatedAt: now,
      };
      await updateReminderForJob(nextReminderFor.jobId, (currentReminders) => [...currentReminders, newReminder]);
      setNextReminderFor(null);
    } catch (error) {
      console.error('Error creating next reminder:', error);
      alert('Error creating reminder.');
    } finally {
      setUpdatingReminder(false);
    }
  };

  const handleDeleteReminder = async (reminderItem: ReminderItem) => {
    if (!window.confirm('Delete this reminder?')) return;
    setUpdatingReminder(true);
    try {
      await updateReminderForJob(reminderItem.jobId, (currentReminders) => (
        currentReminders.filter((r) => r.id !== reminderItem.reminderId)
      ));
      setSelectedReminder(null);
    } catch (error) {
      console.error('Error deleting reminder:', error);
      alert('Error deleting reminder.');
    } finally {
      setUpdatingReminder(false);
    }
  };

  const handleFindMissingReminders = async () => {
    setCheckingMissingReminders(true);
    try {
      const allJobs = await getAllJobs();
      setPendingJobsWithoutReminders(findPendingJobsWithoutActiveReminders(allJobs));
      setShowMissingRemindersModal(true);
    } catch (error) {
      console.error('Error checking pending jobs without reminders:', error);
      alert('Error checking pending jobs without reminders. Please try again.');
    } finally {
      setCheckingMissingReminders(false);
    }
  };

  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case 'Won': return 'bg-[#dcfce7] text-[#15803d]';
      case 'Lost': return 'bg-[#e2e8f0] text-[#475569]';
      case 'Pending': return 'bg-[#fef9c3] text-[#a16207]';
      case 'Verbal': return 'bg-[#dbeafe] text-[#1d4ed8]';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getMarginColor = (pct: number) => {
    if (pct >= 35) return 'text-[#15803d]';
    if (pct >= 22) return 'text-[#a16207]';
    return 'text-[#dc2626]';
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    const isDefaultStatus = statusFilter.length === 3 && statusFilter.includes('Pending') && statusFilter.includes('Verbal') && statusFilter.includes('Won');
    if (!isDefaultStatus) count++;
    if (probabilityFilter > 0) count++;
    if (chipBlendFilter) count++;
    if (selectedTagFilters.length > 0) count++;
    return count;
  }, [statusFilter, probabilityFilter, chipBlendFilter, selectedTagFilters]);

  const isFiltered = activeFilterCount > 0 || !!searchQuery;
  // Filters that live behind the desktop "More filters" button (status has its own chips)
  const moreFilterCount = (probabilityFilter > 0 ? 1 : 0) + (chipBlendFilter ? 1 : 0) + (selectedTagFilters.length > 0 ? 1 : 0);

  // Simplified read-only view for members without write access to jobs.
  // Shows just job name, status, install date, and customer address.
  if (isReadOnlyJobs) {
    const readOnlyJobs = [...jobsWithCalc]
      .filter(({ job }) => job.status === 'Won' || job.status === 'Verbal' || job.status === 'Pending')
      .sort((a, b) => {
        const aDate = a.job.installDate || '';
        const bDate = b.job.installDate || '';
        if (aDate && bDate) return aDate.localeCompare(bDate);
        if (aDate) return -1;
        if (bDate) return 1;
        return 0;
      });

    const formatInstallDate = (d?: string) => {
      if (!d) return '—';
      const [y, m, day] = d.split('-').map(Number);
      if (!y || !m || !day) return d;
      return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const statusBadge = (status: JobStatus) => {
      const cls =
        status === 'Won' ? 'bg-green-100 text-green-800 border-green-200'
        : status === 'Verbal' ? 'bg-blue-100 text-blue-800 border-blue-200'
        : status === 'Pending' ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
        : 'bg-slate-100 text-slate-700 border-slate-200';
      return <span className={`inline-flex items-center text-xs font-medium rounded-full border px-2 py-0.5 ${cls}`}>{status}</span>;
    };

    return (
      <div className="max-w-7xl mx-auto p-3 sm:p-6">
        <div className="flex items-baseline gap-2.5 mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">Dashboard</h2>
          <span className="text-xs text-slate-400">{readOnlyJobs.length}</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading jobs...</div>
        ) : readOnlyJobs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No jobs to display.</div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Job Name</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Install Date</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Customer Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {readOnlyJobs.map(({ job }) => (
                  <tr
                    key={job.id}
                    onClick={() => onViewJobSheet(job.id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">{job.name || 'Untitled Job'}</td>
                    <td className="px-4 py-3">{statusBadge(job.status)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatInstallDate(job.installDate)}</td>
                    <td className="px-4 py-3 text-slate-600">{job.customerAddress || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  const marginOf = (price: number, costs: number) => (price > 0 ? ((price - costs) / price) * 100 : 0);
  const formatPrice = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const formatJobDate = (job: Job) => {
    if (job.estimateDate) {
      const [y, m, d] = job.estimateDate.split('-').map(Number);
      if (y && m && d) return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return new Date(job.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  const toggleHotJobsExpanded = () => {
    const expanded = !hotJobsExpanded;
    setHotJobsExpanded(expanded);
    try { localStorage.setItem('dashboard_hot_jobs_expanded_v1', String(expanded)); } catch { /* Storage may be unavailable. */ }
  };
  const openRowMenu = (event: React.MouseEvent<HTMLButtonElement>, jobId: string) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setRowMenu(prev => prev?.jobId === jobId ? null : { jobId, top: rect.bottom + 4, right: window.innerWidth - rect.right });
  };
  const rowMenuJob = rowMenu ? jobsWithCalc.find(({ job }) => job.id === rowMenu.jobId)?.job : undefined;

  const tabs: { id: typeof viewMode; label: string; longLabel: string; count: number; alert?: boolean }[] = [
    { id: 'jobs', label: 'Jobs', longLabel: 'Jobs', count: filteredAndSortedJobs.length },
    { id: 'needs-contact', label: 'Contact', longLabel: 'Needs contact', count: needsContactJobs.length },
    { id: 'today', label: 'Today', longLabel: 'Today', count: dayTotalCount },
    { id: 'reminders', label: 'Reminders', longLabel: 'Reminders', count: remindersByDue.length, alert: remindersNeedingAttentionCount > 0 },
  ];

  const hotJobsEmptyText = loading ? 'Loading hot jobs…' : 'Star a job to pin it here for the whole team.';

  // Desktop table row, shared by standalone jobs and jobs inside a group
  const renderJobRow = ({ job, calc }: JobWithCalc, inGroup: boolean) => {
    const marginPct = marginOf(job.totalPrice, calc.totalCosts);
    const meta = [job.customerName, job.floorFootage ? `${job.floorFootage} ft²` : '', job.chipBlend].filter(Boolean).join(' · ');
    return (
      <tr key={job.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => onEditJob(job.id)}>
        <td className={`py-3 pr-4 ${inGroup ? 'pl-10' : 'pl-4'}`}>
          <div className="text-[15px] font-bold text-slate-900">{job.name || 'Untitled Job'}</div>
          {meta && <div className="mt-0.5 text-[13px] text-slate-600">{meta}</div>}
        </td>
        <td className="px-4 py-3">
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getStatusColor(job.status)}`}>{job.status}</span>
        </td>
        <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">{formatJobDate(job)}</td>
        <td className="num px-4 py-3 text-right text-[15px] font-extrabold text-slate-900">{formatPrice(job.totalPrice)}</td>
        <td className={`num px-4 py-3 text-right text-sm font-bold ${getMarginColor(marginPct)}`}>{marginPct.toFixed(0)}%</td>
        <td className="px-2 py-1.5 text-right whitespace-nowrap">
          {starButton(job)}
          <button type="button" aria-label={`More actions for ${job.name || 'Untitled Job'}`} aria-haspopup="menu"
            aria-expanded={rowMenu?.jobId === job.id} onClick={(e) => openRowMenu(e, job.id)}
            className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gf-lime">
            <MoreHorizontal size={18} />
          </button>
        </td>
      </tr>
    );
  };

  // Mobile card, shared by standalone jobs and jobs inside a group
  const renderJobCard = ({ job, calc }: JobWithCalc) => {
    const marginPct = marginOf(job.totalPrice, calc.totalCosts);
    const meta = [job.customerName, formatJobDate(job)].filter(Boolean).join(' · ');
    return (
      <div key={job.id} onClick={() => onEditJob(job.id)}
        className="bg-white border border-slate-200 rounded-[14px] pl-4 pr-2 py-2 cursor-pointer active:bg-slate-50 transition-colors">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-base font-bold text-slate-900">{job.name || 'Untitled Job'}</span>
          <span className="num shrink-0 text-[17px] font-extrabold text-slate-900">{formatPrice(job.totalPrice)}</span>
          {canWriteJobs ? starButton(job) : <span className="w-2" />}
        </div>
        <div className="flex items-center gap-2 pr-2 pb-1.5 text-[13px] text-slate-600">
          <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-bold ${getStatusColor(job.status)}`}>{job.status}</span>
          <span className="min-w-0 flex-1 truncate">{meta}</span>
          <span className={`num shrink-0 font-bold ${getMarginColor(marginPct)}`}>{marginPct.toFixed(0)}% margin</span>
        </div>
      </div>
    );
  };

  const loadOlderFooter = (hasMoreOlderJobs || olderJobsMessage) ? (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3.5 md:border-t md:border-slate-200 text-[13px] text-slate-600">
      <span>{olderJobsMessage || `Showing ${filteredAndSortedJobs.length} of ${jobsWithCalc.length} loaded jobs`}</span>
      {hasMoreOlderJobs && (
        <button type="button" onClick={handleLoadOlderJobs} disabled={loadingOlderJobs}
          className="min-h-11 md:min-h-9 px-3.5 rounded-lg bg-white border border-slate-300 text-[13px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed">
          {loadingOlderJobs ? 'Loading…' : 'Load older jobs'}
        </button>
      )}
    </div>
  ) : null;

  return (
    <div className="max-w-[1400px] mx-auto min-h-full bg-[#f6f7f9] md:bg-transparent md:px-5 lg:px-8 md:py-7">
      {/* Mobile search — visually extends the dark Layout header */}
      <div className="md:hidden bg-[#0a0a0a] px-4 pb-3.5">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
          <input
            type="search"
            aria-label="Search jobs or customers"
            placeholder="Search jobs or customers"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 bg-[#1c1c1c] border border-[#333] text-white rounded-[10px] pl-10 pr-3.5 text-[15px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-gf-lime"
          />
        </div>
      </div>

      {/* Desktop header */}
      <div className="hidden md:flex flex-wrap items-center gap-4 mb-5">
        <div className="flex-1 min-w-[200px]">
          <h1 className="font-heading font-bold text-[28px] leading-tight text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            {filteredAndSortedJobs.length === jobsWithCalc.length
              ? `${jobsWithCalc.length} jobs`
              : `${filteredAndSortedJobs.length} of ${jobsWithCalc.length} jobs shown`}
          </p>
        </div>
        <div className="relative flex-1 min-w-[240px] max-w-[420px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="search"
            aria-label="Search jobs or customers"
            placeholder="Search jobs or customers"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 bg-white border border-slate-300 rounded-[10px] pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-gf-lime"
          />
        </div>
        {canWriteJobs && (
          <button onClick={onNewJob}
            className="flex items-center gap-2 h-11 px-[18px] rounded-[10px] bg-gf-dark-green text-white text-sm font-bold hover:bg-[#3f631a] transition-colors">
            <Plus size={16} strokeWidth={2.5} />
            New job
          </button>
        )}
      </div>

      <div className="lg:flex lg:items-start lg:gap-6">
        <section className="min-w-0 lg:flex-1 md:bg-white md:border md:border-slate-200 md:rounded-[14px] md:overflow-hidden">
          {/* View tabs — one accent colour; only reminders needing attention show red */}
          <div className="sticky top-0 z-10 md:static">
            <div role="tablist" aria-label="Dashboard views" className="scrollbar-hide flex md:gap-1 bg-white border-b border-slate-200 md:px-3 overflow-x-auto">
              {tabs.map((tab) => {
                const selected = viewMode === tab.id;
                return (
                  <button key={tab.id} type="button" role="tab" aria-selected={selected}
                    onClick={() => { setViewMode(tab.id); if (tab.id === 'today') setSelectedDay(localToday()); }}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 md:gap-2 h-12 md:h-[52px] px-2 md:px-3 text-sm whitespace-nowrap border-b-[3px] transition-colors ${
                      selected ? 'font-extrabold text-slate-900 border-gf-lime' : 'font-semibold text-slate-600 border-transparent hover:text-slate-900'
                    }`}>
                    <span className="md:hidden">{tab.label}</span>
                    <span className="hidden md:inline">{tab.longLabel}</span>
                    {tab.count > 0 && (
                      <span className={`num min-w-[20px] px-1.5 md:px-2 py-0.5 rounded-full text-xs text-center ${
                        tab.alert ? 'bg-red-100 text-red-800 font-extrabold' : 'bg-slate-100 text-slate-700 font-bold'
                      } ${tab.alert || tab.id === viewMode ? '' : 'hidden md:inline'}`}>{tab.count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Find missing reminders */}
          {viewMode === 'reminders' && (
            <div className="flex items-center justify-end px-4 py-2 bg-white border-b border-slate-100">
              <button
                type="button"
                onClick={handleFindMissingReminders}
                disabled={checkingMissingReminders}
                className="inline-flex items-center gap-1.5 min-h-11 md:min-h-9 px-3 text-[13px] font-bold text-gf-dark-green rounded-lg hover:bg-green-50 transition-colors disabled:opacity-60"
              >
                <Search size={14} />
                {checkingMissingReminders ? 'Checking…' : 'Find jobs missing a reminder'}
              </button>
            </div>
          )}

          {starError && <p role="alert" className="px-4 pt-3 text-sm text-red-700">{starError}</p>}

          {/* Hot jobs strip — phones and tablets (desktop shows the side panel instead) */}
          <section aria-labelledby="hot-jobs-heading" className="lg:hidden px-4 pt-2">
            <div className="flex items-center gap-1.5">
              <Star size={14} className="text-amber-700" fill="currentColor" />
              <h2 id="hot-jobs-heading" className="flex-1 text-[13px] font-extrabold text-slate-900">Hot jobs · {hotJobs.length}</h2>
              <button type="button" aria-expanded={hotJobsExpanded} aria-controls="hot-jobs-list" onClick={toggleHotJobsExpanded}
                className="min-h-11 px-1 text-[13px] font-bold text-slate-600">
                {hotJobsExpanded ? 'Hide' : 'Show'}
              </button>
            </div>
            <div id="hot-jobs-list" className={hotJobsExpanded ? 'pb-1' : 'hidden'}>
              {hotJobs.length === 0 ? (
                <p className="text-[13px] text-slate-600">{hotJobsEmptyText}</p>
              ) : (
                <ul className="scrollbar-hide flex gap-2 overflow-x-auto -mr-4 pr-4">
                  {hotJobs.map(({ job }) => (
                    <li key={job.id} className="w-[168px] shrink-0">
                      <button type="button" onClick={() => onEditJob(job.id)}
                        className="w-full text-left px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gf-lime">
                        <span className="block truncate text-sm font-bold text-slate-900">{job.name || 'Untitled Job'}</span>
                        <span className="block truncate mt-0.5 text-[13px] text-slate-600">{job.status} · {formatPrice(job.totalPrice)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Mobile toolbar (Jobs tab only) */}
          {viewMode === 'jobs' && (
            <div className="md:hidden flex items-center gap-2 px-4 py-2">
              <button
                onClick={() => setShowFilterSheet(true)}
                className="min-w-0 flex items-center gap-2 h-11 px-3.5 rounded-[10px] border border-slate-300 bg-white text-[13px] font-bold text-slate-700"
              >
                <SlidersHorizontal size={14} className="shrink-0" />
                <span className="truncate">{statusFilter.join(', ')}</span>
                {activeFilterCount > 0 && (
                  <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-gf-dark-green text-white text-[11px] font-bold">{activeFilterCount}</span>
                )}
              </button>
              <div className="flex-1" />
              <select
                aria-label="Sort jobs"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'price' | 'margin')}
                className="shrink-0 h-11 px-2 rounded-[10px] border-0 bg-transparent text-[13px] font-bold text-slate-700"
              >
                <option value="date">Recent</option>
                <option value="price">Price</option>
                <option value="margin">Margin</option>
              </select>
            </div>
          )}

          {/* Desktop toolbar (Jobs tab only) */}
          {viewMode === 'jobs' && (
            <div className="hidden md:flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-200">
              <div role="group" aria-label="Status" className="flex flex-wrap items-center gap-1.5">
                {ALL_STATUSES.map((status) => {
                  const pressed = statusFilter.includes(status);
                  return (
                    <button key={status} type="button" aria-pressed={pressed} onClick={() => handleStatusToggle(status)}
                      className={`h-9 px-3.5 rounded-full border text-[13px] transition-colors ${
                        pressed ? 'bg-slate-900 border-slate-900 text-white font-bold' : 'bg-white border-slate-300 text-slate-600 font-semibold hover:bg-slate-50'
                      }`}>
                      {status} · <span className="num">{statusCounts[status]}</span>
                    </button>
                  );
                })}
                <span className="w-px h-5 bg-slate-200 mx-1" aria-hidden="true" />
                <button type="button" aria-pressed={showInactive} onClick={() => setShowInactive(p => !p)}
                  title="Also show Won jobs installed more than 5 days ago"
                  className={`h-9 px-3.5 rounded-full border text-[13px] transition-colors ${
                    showInactive ? 'bg-slate-900 border-slate-900 text-white font-bold' : 'bg-white border-slate-300 text-slate-600 font-semibold hover:bg-slate-50'
                  }`}>
                  Past installs
                </button>
              </div>
              <div className="flex items-center gap-2 ml-auto">
              {isFiltered && (
                <button onClick={handleClearFilters}
                  className="flex items-center gap-1 h-9 px-2.5 rounded-lg text-[13px] font-bold text-red-700 hover:bg-red-50 transition-colors">
                  <X size={14} />
                  Clear
                </button>
              )}
              <button type="button" aria-expanded={showFilters} onClick={() => setShowFilters(p => !p)}
                className={`flex items-center gap-2 h-9 px-3.5 rounded-lg border text-[13px] font-bold transition-colors ${
                  showFilters ? 'bg-slate-100 border-slate-300 text-slate-900' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}>
                <SlidersHorizontal size={14} />
                More filters
                {moreFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gf-dark-green text-white text-[11px] font-bold">{moreFilterCount}</span>
                )}
              </button>
              <label className="flex items-center gap-2 text-[13px] text-slate-600">
                Sort
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'date' | 'price' | 'margin')}
                  className="h-9 px-2.5 border border-slate-300 rounded-lg bg-white text-[13px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-gf-lime"
                >
                  <option value="date">Most recent</option>
                  <option value="price">Price</option>
                  <option value="margin">Margin</option>
                </select>
              </label>
              </div>
            </div>
          )}

          {/* Desktop "More filters" panel */}
          {viewMode === 'jobs' && showFilters && (
            <div className="hidden md:flex flex-wrap items-start gap-x-8 gap-y-3 bg-slate-50 border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-600 mr-1">Probability</span>
                {[0, 20, 40, 60, 80, 100].map(p => (
                  <button key={p} type="button" aria-pressed={probabilityFilter === p} onClick={() => setProbabilityFilter(p)}
                    className={`h-8 px-3 rounded-full border text-xs transition-colors ${probabilityFilter === p ? 'bg-slate-900 border-slate-900 text-white font-bold' : 'bg-white border-slate-300 text-slate-600 font-semibold hover:bg-slate-100'}`}>
                    {p === 0 ? 'Any' : `≥${p}%`}
                  </button>
                ))}
              </div>
              {availableChipBlends.length > 0 && (
                <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                  Chip blend
                  <select value={chipBlendFilter} onChange={(e) => setChipBlendFilter(e.target.value)}
                    className="h-8 px-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-gf-lime bg-white">
                    <option value="">All blends</option>
                    {availableChipBlends.map((blend) => <option key={blend} value={blend}>{blend}</option>)}
                  </select>
                </label>
              )}
              {availableTags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-600 mr-1">Tags</span>
                  <select aria-label="Tag match mode" value={tagMatchMode} onChange={(e) => setTagMatchMode(e.target.value as 'any' | 'all')}
                    className="h-8 px-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 bg-white">
                    <option value="any">Match any</option>
                    <option value="all">Match all</option>
                  </select>
                  {availableTags.map((tag) => {
                    const pressed = selectedTagFilters.includes(tag);
                    return (
                      <button key={tag} type="button" aria-pressed={pressed} onClick={() => handleTagToggle(tag)}
                        className={`h-8 px-3 rounded-full border text-xs transition-colors ${pressed ? 'bg-slate-900 border-slate-900 text-white font-bold' : 'bg-white border-slate-300 text-slate-600 font-semibold hover:bg-slate-100'}`}>
                        {tag}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

      {/* Overdue reminders banner */}
      {viewMode === 'reminders' && overdueReminders.length > 0 && (
        <div className="border-b border-red-200 bg-red-50">
          <button
            type="button"
            onClick={() => setOverdueExpanded(p => !p)}
            className="w-full flex items-center gap-2 px-3 sm:px-6 py-2.5 text-left"
          >
            <AlertTriangle size={14} className="text-red-500 shrink-0" />
            <span className="text-sm font-semibold text-red-700 flex-1">
              {overdueReminders.length} Overdue Reminder{overdueReminders.length !== 1 ? 's' : ''}
            </span>
            {overdueExpanded
              ? <ChevronDown size={14} className="text-red-400 shrink-0" />
              : <ChevronRight size={14} className="text-red-400 shrink-0" />
            }
          </button>
          {overdueExpanded && (
            <div className="divide-y divide-red-100">
              {overdueReminders.map((reminder) => {
                const daysOverdue = Math.floor(
                  (new Date(localToday() + 'T00:00:00').getTime() -
                   new Date(reminder.dueAt).getTime()) / (24 * 60 * 60 * 1000)
                );
                return (
                  <div key={`${reminder.jobId}-${reminder.reminderId}`}
                    className="flex items-start gap-3 px-3 sm:px-6 py-2.5 hover:bg-red-100/50 transition-colors">
                    <button onClick={() => onEditJob(reminder.jobId)} className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-medium text-slate-900 truncate">{reminder.subject}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {reminder.jobName}{reminder.customerName ? ` · ${reminder.customerName}` : ''}
                      </div>
                      <div className="text-xs font-medium text-red-600 mt-0.5">
                        {daysOverdue === 0 ? 'Due today' : daysOverdue === 1 ? '1 day overdue' : `${daysOverdue} days overdue`}
                        {' · '}{new Date(reminder.dueAt).toLocaleDateString()}
                      </div>
                    </button>
                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      <button type="button" onClick={() => handleCompleteReminder(reminder)}
                        className="p-1.5 rounded text-green-600 hover:bg-green-100 transition-colors" title="Mark complete" disabled={updatingReminder}>
                        <Check size={14} />
                      </button>
                      <button type="button" onClick={() => handleDeleteReminder(reminder)}
                        className="p-1.5 rounded text-red-600 hover:bg-red-100 transition-colors" title="Delete reminder" disabled={updatingReminder}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========== TAB CONTENT =========== */}

      {/* Needs Contact tab */}
      {viewMode === 'needs-contact' && (
        <div className="md:bg-white md:divide-y md:divide-slate-100">
          {needsContactJobs.length === 0 ? (
            <div className="p-12 text-center">
              <PhoneCall size={24} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-500">No pending jobs need contact right now.</p>
            </div>
          ) : (
            <div className="px-3.5 md:px-0 py-2 md:py-0 flex flex-col gap-2 md:gap-0">
              {needsContactJobs.map(({ job, daysSince }) => (
                <button key={job.id} onClick={() => onEditJob(job.id)}
                  className="w-full bg-white border border-[#fed7aa] md:border-0 md:border-b md:border-slate-100 rounded-[14px] md:rounded-none px-4 md:px-6 py-3.5 md:py-3 flex items-center gap-3 text-left hover:bg-orange-50/60 active:bg-orange-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-[14.5px] font-bold text-[#0f172a] truncate">{job.name || 'Untitled Job'}</div>
                    {job.customerName && <div className="text-xs text-slate-400 mt-0.5">{job.customerName}</div>}
                  </div>
                  <span className={`num text-[15px] font-extrabold shrink-0 ${daysSince > 60 ? 'text-red-500' : 'text-[#ea580c]'}`}>{daysSince}d</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Today tab */}
      {viewMode === 'today' && (
        <div className="md:bg-white">
          {/* Day navigation */}
          <div className="flex items-center gap-2 px-3.5 md:px-6 py-2.5 bg-white border-b border-slate-200">
            <button
              type="button"
              onClick={() => setSelectedDay(d => addDaysToLocalDate(d, -1))}
              aria-label="Previous day"
              className="flex items-center justify-center w-9 h-9 rounded-[10px] border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <ChevronLeft size={17} />
            </button>
            <div className="flex-1 text-center min-w-0">
              <div className="text-[14px] font-bold text-slate-900 truncate">
                {isSelectedDayToday ? 'Today' : selectedDayLabel}
              </div>
              {!isSelectedDayToday && (
                <button
                  type="button"
                  onClick={() => setSelectedDay(localToday())}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Back to today
                </button>
              )}
              {isSelectedDayToday && (
                <div className="text-[11px] font-medium text-slate-400">{selectedDayLabel}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedDay(d => addDaysToLocalDate(d, 1))}
              aria-label="Next day"
              className="flex items-center justify-center w-9 h-9 rounded-[10px] border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <ChevronRight size={17} />
            </button>
          </div>
          {dayTotalCount === 0 ? (
            <div className="p-12 text-center">
              <Calendar size={24} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-500">
                Nothing scheduled for {isSelectedDayToday ? 'today' : selectedDayLabel}.
              </p>
            </div>
          ) : (
            <div className="px-3.5 md:px-0 py-3 md:py-0 space-y-3.5 md:space-y-0 md:divide-y md:divide-slate-200">
              {dayItems.installs.length > 0 && (
                <div>
                  <div className="text-[11px] font-extrabold text-[#15803d] tracking-[0.5px] uppercase mb-[7px] pl-1 md:hidden">{isSelectedDayToday ? 'Installs Today' : 'Installs'}</div>
                  <div className="hidden md:flex items-center gap-2 px-6 py-2 bg-green-50">
                    <Wrench size={13} className="text-green-600" />
                    <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Installs</span>
                    <span className="text-[10px] font-bold text-green-600">({dayItems.installs.length})</span>
                  </div>
                  <div className="flex flex-col gap-2 md:gap-0 md:divide-y md:divide-slate-100">
                    {dayItems.installs.map(({ job, dayNumber, totalDays }) => (
                      <button key={job.id} onClick={() => onEditJob(job.id)}
                        className="w-full bg-white border border-[#bbf7d0] border-l-[3px] border-l-[#22c55e] md:border-0 md:border-b md:border-slate-100 rounded-[13px] md:rounded-none px-[15px] md:px-6 py-[13px] md:py-3 flex items-center gap-3 text-left hover:bg-green-50/60 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="text-[14.5px] font-bold text-[#0f172a] truncate">{job.name || 'Untitled Job'}</div>
                          {job.customerName && <div className="text-xs text-slate-400 mt-0.5">{job.customerName}</div>}
                        </div>
                        {totalDays > 1 && (
                          <span className="text-xs font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded shrink-0">Day {dayNumber}/{totalDays}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {dayItems.estimates.length > 0 && (
                <div>
                  <div className="text-[11px] font-extrabold text-purple-700 tracking-[0.5px] uppercase mb-[7px] pl-1 md:hidden">{isSelectedDayToday ? 'Estimates Today' : 'Estimates'}</div>
                  <div className="hidden md:flex items-center gap-2 px-6 py-2 bg-purple-50">
                    <FileSearch size={13} className="text-purple-600" />
                    <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Estimates</span>
                    <span className="text-[10px] font-bold text-purple-600">({dayItems.estimates.length})</span>
                  </div>
                  <div className="flex flex-col gap-2 md:gap-0 md:divide-y md:divide-slate-100">
                    {dayItems.estimates.map(({ job }) => (
                      <button key={job.id} onClick={() => onEditJob(job.id)}
                        className="w-full bg-white border border-slate-200 md:border-0 md:border-b md:border-slate-100 rounded-[13px] md:rounded-none px-[15px] md:px-6 py-[13px] md:py-3 flex items-center gap-3 text-left hover:bg-purple-50/60 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="text-[14.5px] font-bold text-[#0f172a] truncate">{job.name || 'Untitled Job'}</div>
                          {job.customerName && <div className="text-xs text-slate-400 mt-0.5">{job.customerName}</div>}
                        </div>
                        <span className={`shrink-0 px-[9px] py-[3px] rounded-full text-[11px] font-extrabold ${getStatusColor(job.status)}`}>{job.status}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {dayItems.reminders.length > 0 && (
                <div>
                  <div className="text-[11px] font-extrabold text-[#1d4ed8] tracking-[0.5px] uppercase mb-[7px] pl-1 md:hidden">{isSelectedDayToday ? 'Reminders Today' : 'Reminders'}</div>
                  <div className="hidden md:flex items-center gap-2 px-6 py-2 bg-blue-50">
                    <Bell size={13} className="text-blue-600" />
                    <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Reminders</span>
                    <span className="text-[10px] font-bold text-blue-600">({dayItems.reminders.length})</span>
                  </div>
                  <div className="flex flex-col gap-2 md:gap-0 md:divide-y md:divide-slate-100">
                    {dayItems.reminders.map(({ job, reminder }) => (
                      <button key={reminder.id} onClick={() => onEditJob(job.id)}
                        className="w-full bg-white border border-[#bfdbfe] border-l-[3px] border-l-[#3b82f6] md:border-0 md:border-b md:border-slate-100 rounded-[13px] md:rounded-none px-[15px] md:px-6 py-[13px] md:py-3 flex items-center gap-3 text-left hover:bg-blue-50/60 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="text-[14.5px] font-bold text-[#0f172a] truncate">{reminder.subject}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{job.name || 'Untitled Job'}{job.customerName ? ` · ${job.customerName}` : ''}</div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-blue-600 shrink-0">
                          <Clock size={11} />
                          <span>{reminder.dueTime}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Reminders tab */}
      {viewMode === 'reminders' && (
        <div className="md:bg-white">
          {remindersByDue.length === 0 ? (
            <div className="p-12 text-center">
              <Bell size={24} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-500">No pending reminders.</p>
            </div>
          ) : (
            <div className="px-3.5 md:px-0 py-2.5 md:py-0 flex flex-col gap-2 md:gap-0 md:divide-y md:divide-slate-100">
              {remindersByDue.map((reminder) => {
                const now = Date.now();
                const dueAtTime = new Date(reminder.dueAt).getTime();
                const startOfTomorrow = new Date();
                startOfTomorrow.setHours(24, 0, 0, 0);
                const isPastDue = dueAtTime < now;
                const isDueTodayOrPast = dueAtTime < startOfTomorrow.getTime();
                return (
                  <div key={`${reminder.jobId}-${reminder.reminderId}`}
                    className={`bg-white border border-slate-200 md:border-0 md:border-b md:border-slate-100 rounded-[14px] md:rounded-none px-4 md:px-6 py-3.5 md:py-3 flex items-start gap-3 ${
                      isPastDue ? 'md:bg-red-50' : isDueTodayOrPast ? 'md:bg-amber-50' : ''
                    }`}>
                    <button onClick={() => onEditJob(reminder.jobId)} className="flex-1 min-w-0 text-left">
                      <div className="text-[14.5px] font-bold text-[#0f172a] truncate">{reminder.subject}</div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">{reminder.jobName}</div>
                      {reminder.details && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{reminder.details}</p>}
                      <p className={`num text-xs font-bold mt-1.5 ${isPastDue ? 'text-[#dc2626]' : isDueTodayOrPast ? 'text-[#a16207]' : 'text-slate-500'}`}>
                        {new Date(reminder.dueAt).toLocaleString()}
                      </p>
                    </button>
                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      <button type="button" onClick={() => handleCompleteReminder(reminder)}
                        className="p-1.5 rounded text-green-600 hover:bg-green-50 transition-colors" title="Mark complete" disabled={updatingReminder}>
                        <Check size={14} />
                      </button>
                      <button type="button" onClick={() => handleDeleteReminder(reminder)}
                        className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors" title="Delete reminder" disabled={updatingReminder}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Jobs tab content */}
      {viewMode !== 'jobs' ? null : loading ? (
        <div className="p-12 text-center text-sm text-slate-600">Loading jobs…</div>
      ) : filteredAndSortedJobs.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-sm text-slate-600 mb-4">
            {jobsWithCalc.length === 0 ? 'No jobs yet. Create your first job to get started.' : 'No jobs match the current filters.'}
          </p>
          {jobsWithCalc.length === 0 && canWriteJobs && (
            <button onClick={onNewJob} className="inline-flex items-center gap-2 h-11 px-4 bg-gf-dark-green text-white rounded-[10px] font-bold hover:bg-[#3f631a] transition-colors text-sm">
              <Plus size={16} /> Create job
            </button>
          )}
          {jobsWithCalc.length > 0 && isFiltered && (
            <button onClick={handleClearFilters} className="inline-flex items-center h-11 px-4 rounded-[10px] border border-slate-300 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50">
              Clear filters
            </button>
          )}
          {(hasMoreOlderJobs || olderJobsMessage) && (
            <div className="mt-3 flex flex-col items-center gap-2">
              {hasMoreOlderJobs && (
                <button type="button" onClick={handleLoadOlderJobs} disabled={loadingOlderJobs}
                  className="min-h-11 md:min-h-9 px-3.5 rounded-lg bg-white border border-slate-300 text-[13px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed">
                  {loadingOlderJobs ? 'Loading…' : 'Load older jobs'}
                </button>
              )}
              {olderJobsMessage && <p className="text-xs text-slate-600 text-center">{olderJobsMessage}</p>}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="md:hidden px-4 pt-1 pb-3 flex flex-col gap-2.5">
            {displayItems.map((item) => {
              if (item.type !== 'group') return renderJobCard(item.jobWithCalc);
              const isExpanded = expandedGroups.has(item.groupId);
              const isBundled = item.groupType === 'bundled';
              const aggMarginPct = marginOf(item.aggregateTotalPrice, item.aggregateTotalCosts);
              return (
                <div key={item.groupId} className="bg-slate-100 border border-slate-200 rounded-[14px] overflow-hidden">
                  <button type="button" aria-expanded={isExpanded} onClick={() => toggleGroup(item.groupId)}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-left">
                    {isBundled
                      ? <Link size={16} className="text-slate-600 shrink-0" />
                      : <Shuffle size={16} className="text-slate-600 shrink-0" />
                    }
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-base font-bold text-slate-900">{item.customerName}</span>
                      <span className="block mt-0.5 text-[13px] text-slate-600">
                        {isBundled ? `Bundle of ${item.jobs.length} jobs` : `${item.jobs.length} alternative estimates`}
                      </span>
                    </span>
                    {isBundled && (
                      <span className="shrink-0 text-right">
                        <span className="num block text-[17px] font-extrabold text-slate-900">{formatPrice(item.aggregateTotalPrice)}</span>
                        <span className={`num block text-[13px] font-bold ${getMarginColor(aggMarginPct)}`}>{aggMarginPct.toFixed(0)}% margin</span>
                      </span>
                    )}
                    <ChevronDown size={18} className={`text-slate-500 shrink-0 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                  </button>
                  {isExpanded && (
                    <div className="px-2.5 pb-2.5 flex flex-col gap-2">
                      {item.jobs.map(renderJobCard)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="text-left text-xs text-slate-600">
                  <th scope="col" className="px-4 py-3 font-bold">Job</th>
                  <th scope="col" className="px-4 py-3 font-bold">Status</th>
                  <th scope="col" className="px-4 py-3 font-bold">Estimate</th>
                  <th scope="col" className="px-4 py-3 font-bold text-right">Price</th>
                  <th scope="col" className="px-4 py-3 font-bold text-right">Margin</th>
                  <th scope="col" className="px-2 py-3 w-[104px]"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map((item) => {
                  if (item.type !== 'group') return renderJobRow(item.jobWithCalc, false);
                  const isExpanded = expandedGroups.has(item.groupId);
                  const isBundled = item.groupType === 'bundled';
                  const aggMarginPct = marginOf(item.aggregateTotalPrice, item.aggregateTotalCosts);
                  return (
                    <Fragment key={`group-${item.groupId}`}>
                      <tr className="border-t border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer" onClick={() => toggleGroup(item.groupId)}>
                        <td className="px-4 py-3" colSpan={isBundled ? 3 : 6}>
                          <button type="button" aria-expanded={isExpanded} className="flex items-center gap-2 text-left">
                            <ChevronRight size={14} className={`text-slate-500 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            <span>
                              <span className="block text-[15px] font-bold text-slate-900">{item.customerName}</span>
                              <span className="block mt-0.5 text-[13px] text-slate-600">
                                {isBundled ? `Bundle of ${item.jobs.length} jobs` : `${item.jobs.length} alternative estimates`}
                              </span>
                            </span>
                          </button>
                        </td>
                        {isBundled && (
                          <>
                            <td className="num px-4 py-3 text-right text-[15px] font-extrabold text-slate-900">{formatPrice(item.aggregateTotalPrice)}</td>
                            <td className={`num px-4 py-3 text-right text-sm font-bold ${getMarginColor(aggMarginPct)}`}>{aggMarginPct.toFixed(0)}%</td>
                            <td className="px-2 py-3" />
                          </>
                        )}
                      </tr>
                      {isExpanded && item.jobs.map((jwc) => renderJobRow(jwc, true))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {loadOlderFooter}
        </>
      )}
        </section>

        {/* Hot jobs side panel — desktop */}
        <aside aria-labelledby="hot-jobs-panel-heading" className="hidden lg:flex flex-col gap-3 w-[280px] shrink-0 bg-white border border-slate-200 rounded-[14px] p-4">
          <div className="flex items-center gap-2">
            <Star size={16} className="text-amber-700" fill="currentColor" />
            <h2 id="hot-jobs-panel-heading" className="flex-1 font-heading text-base font-bold text-slate-900">Hot jobs</h2>
            <span className="num text-[13px] text-slate-600">{hotJobs.length}</span>
          </div>
          {hotJobs.length > 0 && (
            <ul className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
              {hotJobs.map(({ job }) => (
                <li key={job.id} className="flex items-center rounded-[10px] border border-slate-200 hover:border-slate-300 transition-colors">
                  <button type="button" onClick={() => onEditJob(job.id)}
                    className="min-w-0 flex-1 pl-3 py-2.5 text-left rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gf-lime">
                    <span className="flex justify-between gap-2 text-sm font-bold text-slate-900">
                      <span className="truncate">{job.name || 'Untitled Job'}</span>
                      <span className="num shrink-0">{formatPrice(job.totalPrice)}</span>
                    </span>
                    <span className="block truncate mt-0.5 text-[13px] text-slate-600">{job.customerName || 'No customer'} · {job.status}</span>
                  </button>
                  {starButton(job)}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-600">{hotJobs.length === 0 ? hotJobsEmptyText : 'Star any job to pin it here for the whole team.'}</p>
        </aside>
      </div>

      {/* Row actions menu (desktop table) */}
      {rowMenu && rowMenuJob && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setRowMenu(null)} />
          <div role="menu" style={{ top: rowMenu.top, right: rowMenu.right }}
            className="fixed z-50 w-44 py-1 bg-white border border-slate-200 rounded-[10px] shadow-lg text-sm font-semibold text-slate-700">
            <button type="button" role="menuitem" onClick={() => { setRowMenu(null); onEditJob(rowMenuJob.id); }}
              className="w-full flex items-center gap-2.5 px-3 h-10 text-left hover:bg-slate-50">
              <Pencil size={15} /> Edit job
            </button>
            <button type="button" role="menuitem" onClick={() => { setRowMenu(null); onViewJobSheet(rowMenuJob.id); }}
              className="w-full flex items-center gap-2.5 px-3 h-10 text-left hover:bg-slate-50">
              <FileText size={15} /> Job sheet
            </button>
            {canWriteJobs && (
              <button type="button" role="menuitem" onClick={() => { setRowMenu(null); handleDeleteJob(rowMenuJob.id); }}
                className="w-full flex items-center gap-2.5 px-3 h-10 text-left text-red-700 hover:bg-red-50">
                <Trash2 size={15} /> Delete
              </button>
            )}
          </div>
        </>
      )}

      {/* Mobile filter bottom sheet */}
      {showFilterSheet && (
        <>
          <div className="md:hidden fixed inset-0 z-40 bg-slate-900/45" onClick={() => setShowFilterSheet(false)} />
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-[41] bg-white rounded-t-[22px] px-5 pt-[18px] pb-7 animate-sheet-up">
            <div className="w-[38px] h-1 bg-slate-300 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-4">
              <span className="font-heading font-extrabold text-[18px]">Filters</span>
              <button onClick={() => { handleClearFilters(); setShowFilterSheet(false); }}
                className="text-[13px] font-bold text-red-600">Clear all</button>
            </div>
            <div className="text-[11px] font-extrabold text-slate-400 tracking-[0.5px] uppercase mb-2">Status</div>
            <div className="flex gap-[7px] flex-wrap mb-[18px]">
              {ALL_STATUSES.map((status) => (
                <button key={status} onClick={() => handleStatusToggle(status)}
                  className={`px-[15px] py-2 rounded-full border text-[13px] font-bold transition-colors ${
                    statusFilter.includes(status) ? getStatusColor(status) + ' border-transparent' : 'bg-white border-slate-200 text-slate-400'
                  }`}>
                  {status}
                </button>
              ))}
            </div>
            <label className="flex items-center justify-between gap-3 min-h-11 mb-[18px] text-sm font-bold text-slate-700">
              Show past installs
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="w-5 h-5 accent-gf-dark-green" />
            </label>
            <div className="text-[11px] font-extrabold text-slate-400 tracking-[0.5px] uppercase mb-2">Min Probability</div>
            <div className="flex gap-[7px] flex-wrap mb-[22px]">
              {[0, 20, 40, 60, 80, 100].map(p => (
                <button key={p} onClick={() => setProbabilityFilter(p)}
                  className={`px-[15px] py-2 rounded-full border text-[13px] font-bold transition-colors ${
                    probabilityFilter === p ? 'bg-blue-100 text-blue-800 border-transparent' : 'bg-white border-slate-200 text-slate-400'
                  }`}>
                  {p === 0 ? 'Any' : `≥${p}%`}
                </button>
              ))}
            </div>
            <button onClick={() => setShowFilterSheet(false)}
              className="w-full py-[15px] rounded-[13px] bg-gradient-to-r from-gf-lime to-gf-dark-green text-white text-[15px] font-extrabold">
              Show results
            </button>
          </div>
        </>
      )}

      {/* Reminder modals (unchanged) */}
      {showReminders && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Reminders</h3>
                <p className="text-xs text-slate-500">{remindersByDue.length} total, {remindersNeedingAttentionCount} due today or earlier</p>
              </div>
              <button type="button" onClick={() => setShowReminders(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5">
              {remindersByDue.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No reminders found.</p>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                  {remindersByDue.map((reminder) => {
                    const now = Date.now();
                    const dueAtTime = new Date(reminder.dueAt).getTime();
                    const startOfTomorrow = new Date();
                    startOfTomorrow.setHours(24, 0, 0, 0);
                    const isPastDue = dueAtTime < now;
                    const isDueTodayOrPast = dueAtTime < startOfTomorrow.getTime();
                    return (
                      <div key={`${reminder.jobId}-${reminder.reminderId}`}
                        className={`w-full text-left p-3 border rounded-lg transition-colors hover:bg-white ${
                          isPastDue ? 'border-red-200 bg-red-50' : isDueTodayOrPast ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'
                        }`}>
                        <div className="flex items-start justify-between gap-3">
                          <button type="button" onClick={() => setSelectedReminder(reminder)} className="flex-1 text-left">
                            <p className="text-sm font-semibold text-slate-900">{reminder.subject}</p>
                            <p className="text-xs text-slate-600 mt-0.5">{reminder.jobName}</p>
                            {reminder.details && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{reminder.details}</p>}
                            <p className={`text-xs font-medium mt-1 ${isPastDue ? 'text-red-700' : isDueTodayOrPast ? 'text-amber-700' : 'text-slate-600'}`}>
                              {new Date(reminder.dueAt).toLocaleString()}
                            </p>
                          </button>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleCompleteReminder(reminder); }}
                              className="p-1.5 rounded text-green-600 hover:bg-green-50 transition-colors" title="Mark complete" disabled={updatingReminder}>
                              <Check size={14} />
                            </button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteReminder(reminder); }}
                              className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors" title="Delete reminder" disabled={updatingReminder}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {nextReminderFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Create Next Reminder</h3>
              <button type="button" onClick={() => setNextReminderFor(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-slate-600">
                Reminder completed for <span className="font-medium text-slate-900">{nextReminderFor.jobName || 'this job'}</span>. Schedule a follow-up?
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
                <input type="text" value={nextReminderForm.subject}
                  onChange={(e) => setNextReminderForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="e.g. Follow up call"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                  <input type="date" value={nextReminderForm.dueDate}
                    onChange={(e) => setNextReminderForm((f) => ({ ...f, dueDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Time</label>
                  <input type="time" value={nextReminderForm.dueTime}
                    onChange={(e) => setNextReminderForm((f) => ({ ...f, dueTime: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime" />
                </div>
              </div>
              {commTemplates.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Template (optional)</label>
                  <select defaultValue=""
                    onChange={(e) => {
                      const tpl = commTemplates.find(t => t.id === e.target.value);
                      if (tpl) {
                        const firstName = (nextReminderFor?.customerName || '').trim().split(' ')[0] || '[Name]';
                        setNextReminderForm((f) => ({ ...f, details: tpl.body.replace(/\[Name\]/gi, firstName) }));
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime">
                    <option value="">— Select a template —</option>
                    {commTemplates.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Message / Details (optional)</label>
                <textarea value={nextReminderForm.details}
                  onChange={(e) => setNextReminderForm((f) => ({ ...f, details: e.target.value }))}
                  rows={2} placeholder="Additional notes..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime resize-none" />
              </div>
              <div className="pt-1 flex items-center justify-end gap-2">
                <button type="button" onClick={handleCreateNextReminder} disabled={updatingReminder}
                  className="px-3 py-2 text-sm font-medium text-white bg-gf-lime rounded-lg hover:bg-gf-dark-green transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed">
                  Create Reminder
                </button>
                <button type="button" onClick={() => setNextReminderFor(null)}
                  className="px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                  No Thanks
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedReminder && selectedReminderDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Reminder</h3>
              <button type="button" onClick={() => setSelectedReminder(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <div>
                <p className="text-xs text-slate-500">Job</p>
                <p className="text-sm font-medium text-slate-900">{selectedReminderDetails.job.name || 'Untitled Job'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Subject</p>
                <p className="text-sm font-medium text-slate-900">{selectedReminderDetails.reminder.subject}</p>
              </div>
              {selectedReminderDetails.reminder.details && (
                <div>
                  <p className="text-xs text-slate-500">Details</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedReminderDetails.reminder.details}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-500">Due</p>
                <p className="text-sm text-slate-700">{new Date(selectedReminderDetails.reminder.dueAt).toLocaleString()}</p>
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button type="button" onClick={() => handleCompleteReminder(selectedReminder)} disabled={updatingReminder}
                  className="px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed">
                  Mark Complete
                </button>
                <button type="button" onClick={() => handleDeleteReminder(selectedReminder)} disabled={updatingReminder}
                  className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed">
                  Delete
                </button>
                <button type="button" onClick={() => setSelectedReminder(null)}
                  className="px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showMissingRemindersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="missing-reminders-modal-title"
            className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 id="missing-reminders-modal-title" className="text-lg font-semibold text-slate-900">
                Pending Estimates Without Reminders
              </h2>
              <button
                type="button"
                onClick={() => setShowMissingRemindersModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5">
              {pendingJobsWithoutReminders.length === 0 ? (
                <p className="text-sm text-slate-600">All pending estimates have an active reminder.</p>
              ) : (
                <div className="max-h-[60vh] overflow-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {pendingJobsWithoutReminders.map((missingJob) => {
                    const estimateDate = missingJob.estimateDate || missingJob.createdAt.slice(0, 10);
                    return (
                      <div key={missingJob.id} className="flex flex-col gap-3 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{missingJob.name}</p>
                          <p className="text-xs text-slate-600">
                            {missingJob.customerName || 'No customer'} - Estimate {new Date(`${estimateDate}T12:00:00`).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setShowMissingRemindersModal(false); onEditJob(missingJob.id); }}
                          className="inline-flex items-center justify-center rounded-lg bg-gf-lime px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gf-dark-green"
                        >
                          Open
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
