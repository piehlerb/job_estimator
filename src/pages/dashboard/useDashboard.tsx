import { useState, useEffect, useMemo, useRef } from 'react';
import JobStarButton from '../../components/JobStarButton';
import { isHotJob, setJobHot } from '../../lib/hotJobs';
import { getJob } from '../../lib/db';
import { getAllJobs, deleteJob, updateJob, getDefaultCosts, getCosts, getPricing, getDefaultPricing, getAllCommTemplates } from '../../lib/db';
import { Job, JobCalculation, Costs, Pricing, JobStatus, JobReminder, CommunicationTemplate } from '../../types';
import { calculateJobOutputs } from '../../lib/calculations';
import { useAuth } from '../../contexts/AuthContext';
import { loadOlderJobsFromSupabase } from '../../lib/sync';
import { getJobWorkingSetCutoff } from '../../lib/jobSyncPolicy';
import { findPendingJobsWithoutActiveReminders } from '../../lib/reminderCoverage';
import { localToday, timestampToLocalDateString } from '../../lib/dateUtils';

export interface DashboardProps {
  onViewJobSheet: (id: string) => void;
  onNewJob: () => void;
  onEditJob: (id: string) => void;
}

export interface JobWithCalc {
  job: Job;
  calc: JobCalculation;
}

export interface ReminderItem {
  reminderId: string;
  jobId: string;
  jobName: string;
  subject: string;
  details?: string;
  dueAt: string;
}

export const ALL_STATUSES: JobStatus[] = ['Pending', 'Verbal', 'Won', 'Lost'];

export const FILTERS_STORAGE_KEY = 'dashboard_filters';

export const getSavedFilters = () => {
  try {
    return JSON.parse(localStorage.getItem(FILTERS_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

/**
 * State and handlers for Dashboard. The view (Dashboard.tsx) and its
 * section components read everything they need from the returned object.
 */
export function useDashboard({ onNewJob, onEditJob, onViewJobSheet }: DashboardProps) {
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
  const filteredAndSortedJobs = useMemo(() => {
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

    // Apply status filter
    if (statusFilter.length > 0) {
      filtered = filtered.filter(({ job }) =>
        statusFilter.includes(job.status)
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
  }, [jobsWithCalc, searchQuery, statusFilter, probabilityFilter, chipBlendFilter, selectedTagFilters, tagMatchMode, sortBy, showInactive]);

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

  return {
    permissions,
    canWriteJobs,
    isReadOnlyJobs,
    jobsWithCalc,
    setJobsWithCalc,
    loading,
    setLoading,
    hotJobsExpanded,
    setHotJobsExpanded,
    starError,
    setStarError,
    starringIds,
    setStarringIds,
    starRequests,
    hotJobs,
    toggleHotJob,
    starButton,
    _saved,
    sortBy,
    setSortBy,
    statusFilter,
    setStatusFilter,
    probabilityFilter,
    setProbabilityFilter,
    chipBlendFilter,
    setChipBlendFilter,
    selectedTagFilters,
    setSelectedTagFilters,
    tagMatchMode,
    setTagMatchMode,
    searchQuery,
    setSearchQuery,
    viewMode,
    setViewMode,
    showFilters,
    setShowFilters,
    showInactive,
    setShowInactive,
    selectedDay,
    setSelectedDay,
    showReminders,
    setShowReminders,
    selectedReminder,
    setSelectedReminder,
    updatingReminder,
    setUpdatingReminder,
    checkingMissingReminders,
    setCheckingMissingReminders,
    showMissingRemindersModal,
    setShowMissingRemindersModal,
    pendingJobsWithoutReminders,
    setPendingJobsWithoutReminders,
    nextReminderFor,
    setNextReminderFor,
    nextReminderForm,
    setNextReminderForm,
    commTemplates,
    setCommTemplates,
    overdueExpanded,
    setOverdueExpanded,
    expandedGroups,
    setExpandedGroups,
    showFilterSheet,
    setShowFilterSheet,
    dashboardPricing,
    setDashboardPricing,
    loadingOlderJobs,
    setLoadingOlderJobs,
    olderJobsCursor,
    setOlderJobsCursor,
    hasMoreOlderJobs,
    setHasMoreOlderJobs,
    olderJobsMessage,
    setOlderJobsMessage,
    loadJobs,
    handleLoadOlderJobs,
    availableChipBlends,
    availableTags,
    handleDeleteJob,
    handleStatusToggle,
    handleTagToggle,
    handleClearFilters,
    filteredAndSortedJobs,
    displayItems,
    toggleGroup,
    overdueReminders,
    remindersByDue,
    remindersNeedingAttentionCount,
    needsContactJobs,
    dayItems,
    dayTotalCount,
    isSelectedDayToday,
    selectedDayLabel,
    selectedReminderDetails,
    updateReminderForJob,
    handleCompleteReminder,
    handleCreateNextReminder,
    handleDeleteReminder,
    handleFindMissingReminders,
    getStatusColor,
    getMarginColor,
    activeFilterCount,
    isFiltered,
    onNewJob,
    onEditJob,
    onViewJobSheet,
  };
}

export type DashboardModel = ReturnType<typeof useDashboard>;
