import { Plus, Trash2, FileText, Search, Bell, Check, X, ChevronDown, ChevronRight, Link, Shuffle, PhoneCall, SlidersHorizontal } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { getAllJobs, deleteJob, updateJob, getDefaultCosts, getCosts, getPricing, getDefaultPricing } from '../lib/db';
import { Job, JobCalculation, Costs, Pricing, JobStatus, JobReminder } from '../types';
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

interface ReminderItem {
  reminderId: string;
  jobId: string;
  jobName: string;
  subject: string;
  details?: string;
  dueAt: string;
}

const ALL_STATUSES: JobStatus[] = ['Pending', 'Verbal', 'Won', 'Lost'];

export default function Dashboard({ onNewJob, onEditJob, onViewJobSheet }: DashboardProps) {
  const [jobsWithCalc, setJobsWithCalc] = useState<JobWithCalc[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'date' | 'price' | 'margin'>('date');

  // Filter state - default to showing Pending, Verbal, and Won
  const [statusFilter, setStatusFilter] = useState<JobStatus[]>(['Pending', 'Verbal', 'Won']);
  const [probabilityFilter, setProbabilityFilter] = useState<number>(0);
  const [chipBlendFilter, setChipBlendFilter] = useState<string>('');
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
  const [tagMatchMode, setTagMatchMode] = useState<'any' | 'all'>('any');
  const [searchQuery, setSearchQuery] = useState('');
  const [showReminders, setShowReminders] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<ReminderItem | null>(null);
  const [updatingReminder, setUpdatingReminder] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [dashboardPricing, setDashboardPricing] = useState<Pricing>(getDefaultPricing());
  const [viewMode, setViewMode] = useState<'jobs' | 'needs-contact'>('jobs');
  const [showFilters, setShowFilters] = useState(false);

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

  // Filter and sort jobs
  const filteredAndSortedJobs = useMemo(() => {
    let filtered = jobsWithCalc;

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
      filtered = filtered.filter(({ job }) => statusFilter.includes(job.status));
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
        case 'margin':
          const marginA = a.job.totalPrice > 0 ? ((a.job.totalPrice - a.calc.totalCosts) / a.job.totalPrice) * 100 : 0;
          const marginB = b.job.totalPrice > 0 ? ((b.job.totalPrice - b.calc.totalCosts) / b.job.totalPrice) * 100 : 0;
          return marginB - marginA;
        case 'date':
        default:
          return new Date(b.job.createdAt).getTime() - new Date(a.job.createdAt).getTime();
      }
    });
  }, [jobsWithCalc, searchQuery, statusFilter, probabilityFilter, chipBlendFilter, selectedTagFilters, tagMatchMode, sortBy]);

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
    } catch (error) {
      console.error('Error completing reminder:', error);
      alert('Error completing reminder.');
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

  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case 'Won': return 'bg-green-100 text-green-800';
      case 'Lost': return 'bg-red-100 text-red-800';
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'Verbal': return 'bg-blue-100 text-blue-800';
      default: return 'bg-slate-100 text-slate-800';
    }
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

  return (
    <div className="max-w-7xl mx-auto">
      {/* Sticky header + toolbar */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200">
        {/* Header row */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3">
          <div className="flex items-baseline gap-2.5">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">Dashboard</h2>
            <span className="text-xs text-slate-400">{filteredAndSortedJobs.length}/{jobsWithCalc.length}</span>
          </div>
          <button
            onClick={onNewJob}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gf-lime text-white rounded-lg font-semibold hover:bg-gf-dark-green transition-colors text-sm"
          >
            <Plus size={15} />
            New Job
          </button>
        </div>
        {/* Tab row */}
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setViewMode('jobs')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
              viewMode === 'jobs'
                ? 'text-gf-dark-green border-b-2 border-gf-lime -mb-px'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Jobs
            <span className={`text-[10px] font-bold ${viewMode === 'jobs' ? 'text-gf-dark-green' : 'text-slate-300'}`}>({filteredAndSortedJobs.length})</span>
          </button>
          <button
            onClick={() => setViewMode('needs-contact')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
              viewMode === 'needs-contact'
                ? 'text-orange-600 border-b-2 border-orange-400 -mb-px'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <PhoneCall size={12} />
            Contact
            {needsContactJobs.length > 0 && (
              <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                viewMode === 'needs-contact' ? 'bg-orange-100 text-orange-700' : 'bg-orange-100 text-orange-600'
              }`}>{needsContactJobs.length}</span>
            )}
          </button>
        </div>
        {/* Toolbar row */}
        <div className="flex items-center gap-2 px-3 sm:px-6 py-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gf-lime"
            />
          </div>
          {viewMode === 'jobs' && (
            <>
              <button
                onClick={() => setShowFilters(p => !p)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0 ${
                  showFilters || activeFilterCount > 0
                    ? 'bg-gf-lime/10 text-gf-dark-green border border-gf-lime/40'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <SlidersHorizontal size={13} />
                <span className="hidden sm:inline">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gf-lime text-white text-[10px] font-bold">{activeFilterCount}</span>
                )}
              </button>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'price' | 'margin')}
                className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gf-lime shrink-0"
              >
                <option value="date">Recent</option>
                <option value="price">Price ↓</option>
                <option value="margin">Margin ↓</option>
              </select>
            </>
          )}
          <button
            type="button"
            onClick={() => setShowReminders((prev) => !prev)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0 ${
              remindersNeedingAttentionCount > 0
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Bell size={13} />
            {remindersNeedingAttentionCount > 0 && <span className="font-bold">{remindersNeedingAttentionCount}</span>}
          </button>
        </div>
      </div>

      {/* Collapsible filter panel */}
      {showFilters && (
        <div className="bg-slate-50 border-b border-slate-200 px-3 sm:px-6 py-3 space-y-3">
          {/* Status + Probability in one row */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
              {ALL_STATUSES.map((status) => (
                <button key={status} onClick={() => handleStatusToggle(status)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${statusFilter.includes(status) ? getStatusColor(status) : 'bg-white border border-slate-200 text-slate-400'}`}>
                  {status}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Prob</span>
              {[0, 20, 40, 60, 80, 100].map(p => (
                <button key={p} onClick={() => setProbabilityFilter(p)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${probabilityFilter === p ? 'bg-blue-100 text-blue-800' : 'bg-white border border-slate-200 text-slate-400 hover:bg-slate-100'}`}>
                  {p === 0 ? 'Any' : `≥${p}%`}
                </button>
              ))}
            </div>
          </div>
          {/* Chip blend */}
          {availableChipBlends.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide shrink-0">Chip</span>
              <select value={chipBlendFilter} onChange={(e) => setChipBlendFilter(e.target.value)}
                className="px-2 py-1 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-gf-lime bg-white">
                <option value="">All Blends</option>
                {availableChipBlends.map((blend) => <option key={blend} value={blend}>{blend}</option>)}
              </select>
            </div>
          )}
          {/* Tags */}
          {availableTags.length > 0 && (
            <div className="flex items-start gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide shrink-0 pt-0.5">Tags</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button onClick={() => setTagMatchMode('any')}
                  className={`px-2 py-0.5 rounded text-xs font-medium ${tagMatchMode === 'any' ? 'bg-gf-lime/20 text-gf-dark-green' : 'text-slate-400 hover:text-slate-600'}`}>any</button>
                <button onClick={() => setTagMatchMode('all')}
                  className={`px-2 py-0.5 rounded text-xs font-medium ${tagMatchMode === 'all' ? 'bg-gf-lime/20 text-gf-dark-green' : 'text-slate-400 hover:text-slate-600'}`}>all</button>
                <span className="text-slate-200">|</span>
                {availableTags.map((tag) => (
                  <button key={tag} onClick={() => handleTagToggle(tag)}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${selectedTagFilters.includes(tag) ? 'bg-indigo-100 text-indigo-800' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                    {tag}
                  </button>
                ))}
                {selectedTagFilters.length > 0 && (
                  <button onClick={() => setSelectedTagFilters([])} className="text-xs text-slate-400 hover:text-slate-600 underline">clear</button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Needs Contact tab content */}
      {viewMode === 'needs-contact' && (
        <div className="bg-white divide-y divide-slate-100">
          {needsContactJobs.length === 0 ? (
            <div className="p-8 text-center">
              <PhoneCall size={24} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-500">No pending jobs need contact right now.</p>
            </div>
          ) : (
            needsContactJobs.map(({ job, daysSince }) => (
              <button key={job.id} onClick={() => onEditJob(job.id)}
                className="w-full flex items-center gap-3 px-3 sm:px-6 py-3 text-left hover:bg-orange-50/60 active:bg-orange-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{job.name || 'Untitled Job'}</div>
                  {job.customerName && <div className="text-xs text-slate-400">{job.customerName}</div>}
                </div>
                <span className={`text-sm font-bold shrink-0 ${daysSince > 60 ? 'text-red-500' : 'text-orange-500'}`}>{daysSince}d</span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Job list */}
      {viewMode === 'needs-contact' ? null : loading ? (
        <div className="p-8 text-center text-sm text-slate-500">Loading jobs...</div>
      ) : filteredAndSortedJobs.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-slate-500 mb-4">
            {jobsWithCalc.length === 0 ? "No jobs yet. Create your first job to get started!" : "No jobs match the current filters."}
          </p>
          {jobsWithCalc.length === 0 && (
            <button onClick={onNewJob} className="inline-flex items-center gap-2 px-4 py-2 bg-gf-lime text-white rounded-lg font-semibold hover:bg-gf-dark-green transition-colors text-sm">
              <Plus size={16} /> Create Job
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile list - compact 2-line rows */}
          <div className="md:hidden bg-white divide-y divide-slate-100">
            {displayItems.map((item) => {
              if (item.type === 'group') {
                const isExpanded = expandedGroups.has(item.groupId);
                const isBundled = item.groupType === 'bundled';
                const aggMarginPct = item.aggregateTotalPrice > 0 ? ((item.aggregateTotalPrice - item.aggregateTotalCosts) / item.aggregateTotalPrice) * 100 : 0;
                return (
                  <div key={item.groupId}>
                    <div
                      className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer ${isBundled ? 'bg-blue-50' : 'bg-purple-50'}`}
                      onClick={() => toggleGroup(item.groupId)}
                    >
                      {isExpanded ? <ChevronDown size={13} className="text-slate-400 shrink-0" /> : <ChevronRight size={13} className="text-slate-400 shrink-0" />}
                      {isBundled ? <Link size={12} className="text-blue-500 shrink-0" /> : <Shuffle size={12} className="text-purple-500 shrink-0" />}
                      <span className="text-sm font-semibold text-slate-800 truncate flex-1">{item.customerName}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isBundled ? 'bg-blue-200 text-blue-800' : 'bg-purple-200 text-purple-800'}`}>
                        {isBundled ? `${item.jobs.length}×` : `${item.jobs.length} opts`}
                      </span>
                      {isBundled && <span className={`text-xs font-bold ${aggMarginPct >= 30 ? 'text-green-600' : 'text-orange-500'}`}>{aggMarginPct.toFixed(0)}%</span>}
                    </div>
                    {isExpanded && item.jobs.map(({ job, calc }) => {
                      const marginPct = job.totalPrice > 0 ? ((job.totalPrice - calc.totalCosts) / job.totalPrice) * 100 : 0;
                      return (
                        <div key={job.id}
                          className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-slate-50 border-l-[3px] ${isBundled ? 'border-blue-300' : 'border-purple-300'}`}
                          onClick={() => onEditJob(job.id)}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-slate-900 truncate">{job.name || 'Untitled Job'}</span>
                              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${getStatusColor(job.status)}`}>{job.status}</span>
                            </div>
                            <div className="text-xs text-slate-400">${job.totalPrice.toFixed(0)} · <span className={marginPct >= 30 ? 'text-green-600' : 'text-orange-500'}>{marginPct.toFixed(0)}%</span></div>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <button onClick={(e) => { e.stopPropagation(); onViewJobSheet(job.id); }} className="p-1.5 text-slate-400 hover:text-green-600 rounded"><FileText size={14} /></button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteJob(job.id); }} className="p-1.5 text-slate-400 hover:text-red-500 rounded"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }
              const { job, calc } = item.jobWithCalc;
              const marginPct = job.totalPrice > 0 ? ((job.totalPrice - calc.totalCosts) / job.totalPrice) * 100 : 0;
              return (
                <div key={job.id}
                  className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-slate-50 active:bg-slate-100"
                  onClick={() => onEditJob(job.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-slate-900 truncate">{job.name || 'Untitled Job'}</span>
                      <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${getStatusColor(job.status)}`}>{job.status}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {job.customerName && <span className="mr-1.5">{job.customerName} ·</span>}
                      ${job.totalPrice.toFixed(0)} · <span className={marginPct >= 30 ? 'text-green-600' : 'text-orange-500'}>{marginPct.toFixed(0)}%</span>
                      {(job.tags || []).length > 0 && <span className="ml-1.5 text-slate-300">· {(job.tags || []).slice(0, 2).join(', ')}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button onClick={(e) => { e.stopPropagation(); onViewJobSheet(job.id); }} className="p-1.5 text-slate-400 hover:text-green-600 rounded"><FileText size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteJob(job.id); }} className="p-1.5 text-slate-400 hover:text-red-500 rounded"><Trash2 size={14} /></button>
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
                  {displayItems.map((item) => {
                    if (item.type === 'group') {
                      const isExpanded = expandedGroups.has(item.groupId);
                      const isBundled = item.groupType === 'bundled';
                      const aggMarginPct = item.aggregateTotalPrice > 0 ? ((item.aggregateTotalPrice - item.aggregateTotalCosts) / item.aggregateTotalPrice) * 100 : 0;
                      return (
                        <>
                          {/* Group header row (desktop) */}
                          <tr
                            key={`group-${item.groupId}`}
                            className={`border-b border-slate-200 cursor-pointer transition-colors ${isBundled ? 'bg-blue-50 hover:bg-blue-100' : 'bg-purple-50 hover:bg-purple-100'}`}
                            onClick={() => toggleGroup(item.groupId)}
                          >
                            <td className="px-4 lg:px-6 py-3 text-sm font-semibold text-slate-900" colSpan={isBundled ? 1 : 5}>
                              <div className="flex items-center gap-2">
                                {isExpanded ? <ChevronDown size={14} className="text-slate-500 flex-shrink-0" /> : <ChevronRight size={14} className="text-slate-500 flex-shrink-0" />}
                                {isBundled ? <Link size={13} className="text-blue-600 flex-shrink-0" /> : <Shuffle size={13} className="text-purple-600 flex-shrink-0" />}
                                <span>{item.customerName}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isBundled ? 'bg-blue-200 text-blue-800' : 'bg-purple-200 text-purple-800'}`}>
                                  {isBundled ? `Bundle · ${item.jobs.length} parts` : `${item.jobs.length} Alternatives`}
                                </span>
                              </div>
                            </td>
                            {isBundled && (
                              <>
                                <td className="px-4 lg:px-6 py-3 text-sm text-center text-slate-400">—</td>
                                <td className="px-4 lg:px-6 py-3 text-sm text-right text-slate-700 font-medium">${item.aggregateTotalCosts.toFixed(0)}</td>
                                <td className="px-4 lg:px-6 py-3 text-sm text-right font-semibold text-slate-900">${item.aggregateTotalPrice.toFixed(0)}</td>
                                <td className={`px-4 lg:px-6 py-3 text-sm text-right font-bold ${aggMarginPct >= 30 ? 'text-green-600' : 'text-orange-600'}`}>{aggMarginPct.toFixed(0)}%</td>
                                <td className="px-4 lg:px-6 py-3 text-sm text-right text-slate-400">—</td>
                                <td className="px-4 lg:px-6 py-3 text-sm text-right text-slate-400">—</td>
                              </>
                            )}
                          </tr>
                          {/* Group children (desktop) */}
                          {isExpanded && item.jobs.map(({ job, calc }) => {
                            const marginPct = job.totalPrice > 0 ? ((job.totalPrice - calc.totalCosts) / job.totalPrice) * 100 : 0;
                            return (
                              <tr
                                key={job.id}
                                className="border-b border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                                onClick={() => onEditJob(job.id)}
                              >
                                <td className="py-3 text-sm font-medium text-slate-900">
                                  <div className="flex items-center">
                                    <div className={`w-1 self-stretch mr-3 rounded-r ${isBundled ? 'bg-blue-300' : 'bg-purple-300'}`} style={{minHeight: '100%'}} />
                                    <div className="px-2 lg:px-3">
                                      <div>{job.name || 'Untitled Job'}</div>
                                      {(job.tags || []).length > 0 && (
                                        <div className="mt-0.5 flex flex-wrap gap-1">
                                          {(job.tags || []).slice(0, 3).map((tag) => (
                                            <span key={tag} className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">{tag}</span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 lg:px-6 py-3 text-sm text-center">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>{job.status}</span>
                                </td>
                                <td className="px-4 lg:px-6 py-3 text-sm text-slate-600 text-right">${calc.totalCosts.toFixed(0)}</td>
                                <td className="px-4 lg:px-6 py-3 text-sm font-semibold text-slate-900 text-right">${job.totalPrice.toFixed(0)}</td>
                                <td className={`px-4 lg:px-6 py-3 text-sm font-semibold text-right ${marginPct >= 30 ? 'text-green-600' : 'text-orange-600'}`}>{marginPct.toFixed(0)}%</td>
                                <td className="px-4 lg:px-6 py-3 text-sm text-slate-600 text-right">{new Date(job.createdAt).toLocaleDateString()}</td>
                                <td className="px-4 lg:px-6 py-3 text-sm text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button onClick={(e) => { e.stopPropagation(); onViewJobSheet(job.id); }} className="text-green-600 hover:text-green-800" title="Job Sheet"><FileText size={18} /></button>
                                    <button className="text-gf-dark-green hover:text-gf-dark-green font-medium text-xs lg:text-sm">Edit</button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteJob(job.id); }} className="text-red-600 hover:text-red-800"><Trash2 size={18} /></button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </>
                      );
                    }

                    const { job, calc } = item.jobWithCalc;
                    const marginPct = job.totalPrice > 0 ? ((job.totalPrice - calc.totalCosts) / job.totalPrice) * 100 : 0;
                    return (
                      <tr
                        key={job.id}
                        className="border-b border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => onEditJob(job.id)}
                      >
                        <td className="px-4 lg:px-6 py-4 text-sm font-medium text-slate-900">
                          <div>{job.name || 'Untitled Job'}</div>
                          {(job.tags || []).length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {(job.tags || []).slice(0, 3).map((tag) => (
                                <span key={tag} className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">{tag}</span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-sm text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>{job.status}</span>
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-sm text-slate-600 text-right">${calc.totalCosts.toFixed(0)}</td>
                        <td className="px-4 lg:px-6 py-4 text-sm font-semibold text-slate-900 text-right">${job.totalPrice.toFixed(0)}</td>
                        <td className={`px-4 lg:px-6 py-4 text-sm font-semibold text-right ${marginPct >= 30 ? 'text-green-600' : 'text-orange-600'}`}>{marginPct.toFixed(0)}%</td>
                        <td className="px-4 lg:px-6 py-4 text-sm text-slate-600 text-right">{new Date(job.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 lg:px-6 py-4 text-sm text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={(e) => { e.stopPropagation(); onViewJobSheet(job.id); }} className="text-green-600 hover:text-green-800" title="Job Sheet"><FileText size={18} /></button>
                            <button className="text-gf-dark-green hover:text-gf-dark-green font-medium text-xs lg:text-sm">Edit</button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteJob(job.id); }} className="text-red-600 hover:text-red-800"><Trash2 size={18} /></button>
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

      {showReminders && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Reminders</h3>
                <p className="text-xs text-slate-500">
                  {remindersByDue.length} total, {remindersNeedingAttentionCount} due today or earlier
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReminders(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
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
                      <div
                        key={`${reminder.jobId}-${reminder.reminderId}`}
                        className={`w-full text-left p-3 border rounded-lg transition-colors hover:bg-white ${
                          isPastDue
                            ? 'border-red-200 bg-red-50'
                            : isDueTodayOrPast
                              ? 'border-amber-200 bg-amber-50'
                              : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => setSelectedReminder(reminder)}
                            className="flex-1 text-left"
                          >
                            <p className="text-sm font-semibold text-slate-900">{reminder.subject}</p>
                            <p className="text-xs text-slate-600 mt-0.5">{reminder.jobName}</p>
                            {reminder.details && (
                              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{reminder.details}</p>
                            )}
                            <p className={`text-xs font-medium mt-1 ${
                              isPastDue ? 'text-red-700' : isDueTodayOrPast ? 'text-amber-700' : 'text-slate-600'
                            }`}>
                              {new Date(reminder.dueAt).toLocaleString()}
                            </p>
                          </button>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCompleteReminder(reminder);
                              }}
                              className="p-1.5 rounded text-green-600 hover:bg-green-50 transition-colors"
                              title="Mark complete"
                              disabled={updatingReminder}
                            >
                              <Check size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteReminder(reminder);
                              }}
                              className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete reminder"
                              disabled={updatingReminder}
                            >
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

      {selectedReminder && selectedReminderDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Reminder</h3>
              <button
                type="button"
                onClick={() => setSelectedReminder(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
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
                <button
                  type="button"
                  onClick={() => handleCompleteReminder(selectedReminder)}
                  disabled={updatingReminder}
                  className="px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                  Mark Complete
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteReminder(selectedReminder)}
                  disabled={updatingReminder}
                  className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReminder(null)}
                  className="px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


