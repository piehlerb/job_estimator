import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Edit2,
  ExternalLink,
  Filter,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { deleteLead, getAllJobs, getAllLeadAppointments, getAllLeads, updateLead } from '../lib/db';
import { LEAD_DISPOSITION_REASONS, LEAD_STAGES } from '../lib/leadPipeline';
import { applyLeadEdit } from '../lib/leadMutations';
import type { Job, Lead, LeadAppointment, LeadDispositionReason, LeadStage } from '../types';

interface LeadsProps {
  onNewJobFromLead: (leadId: string) => void;
  onEditJob: (jobId: string) => void;
}

const TERMINAL_STAGES = new Set<LeadStage>(['Won', 'Lost', 'Disqualified']);
const DISPOSITION_STAGES = new Set<LeadStage>(['Lost', 'Disqualified']);

type LeadEditForm = {
  name: string;
  phone: string;
  email: string;
  address: string;
  source: string;
  campaign: string;
  stage: LeadStage;
  dispositionReason: LeadDispositionReason | '';
  dispositionNotes: string;
};

const EMPTY_LEAD_FORM: LeadEditForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
  source: '',
  campaign: '',
  stage: 'New',
  dispositionReason: '',
  dispositionNotes: '',
};

function getLeadDisplayName(lead: Lead): string {
  return lead.name || lead.phone || lead.email || 'Unknown Lead';
}

function formFromLead(lead: Lead): LeadEditForm {
  return {
    name: lead.name || '',
    phone: lead.phone || '',
    email: lead.email || '',
    address: lead.address || '',
    source: lead.source || '',
    campaign: lead.campaign || '',
    stage: lead.stage,
    dispositionReason: lead.dispositionReason || '',
    dispositionNotes: lead.dispositionNotes || '',
  };
}

function formatDateTime(value?: string): string {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatRelativeDate(value?: string): string {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

function stageBadgeClass(stage: LeadStage): string {
  switch (stage) {
    case 'Won':
      return 'bg-green-100 text-green-800';
    case 'Lost':
      return 'bg-red-100 text-red-800';
    case 'Disqualified':
      return 'bg-slate-200 text-slate-700';
    case 'Estimate Booked':
    case 'Estimate Completed':
      return 'bg-blue-100 text-blue-800';
    case 'Quoted':
      return 'bg-purple-100 text-purple-800';
    case 'Contact Attempted':
    case 'Engaged':
      return 'bg-amber-100 text-amber-800';
    case 'New':
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function appointmentBadgeClass(status?: LeadAppointment['status']): string {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'canceled':
    case 'no_show':
      return 'bg-red-100 text-red-800';
    case 'rescheduled':
      return 'bg-amber-100 text-amber-800';
    case 'booked':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

export default function Leads({ onNewJobFromLead, onEditJob }: LeadsProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [appointments, setAppointments] = useState<LeadAppointment[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<LeadStage | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [editForm, setEditForm] = useState<LeadEditForm>(EMPTY_LEAD_FORM);
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allLeads, allAppointments, allJobs] = await Promise.all([
        getAllLeads(),
        getAllLeadAppointments(),
        getAllJobs(),
      ]);
      setLeads(allLeads);
      setAppointments(allAppointments);
      setJobs(allJobs);
    } catch (error) {
      console.error('Error loading leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const latestAppointmentByLead = useMemo(() => {
    const map = new Map<string, LeadAppointment>();
    appointments.forEach((appointment) => {
      const existing = map.get(appointment.leadId);
      const nextDate = new Date(appointment.scheduledStartAt || appointment.updatedAt || 0).getTime();
      const existingDate = existing
        ? new Date(existing.scheduledStartAt || existing.updatedAt || 0).getTime()
        : -Infinity;
      if (!existing || nextDate >= existingDate) {
        map.set(appointment.leadId, appointment);
      }
    });
    return map;
  }, [appointments]);

  const jobByLead = useMemo(() => {
    const map = new Map<string, Job>();
    jobs.forEach((job) => {
      if (job.leadId) {
        map.set(job.leadId, job);
      }
    });
    return map;
  }, [jobs]);

  const sourceOptions = useMemo(() => {
    return Array.from(new Set(leads.map((lead) => lead.source?.trim()).filter(Boolean) as string[]))
      .sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return leads
      .filter((lead) => !lead.deleted)
      .filter((lead) => stageFilter === 'all' || lead.stage === stageFilter)
      .filter((lead) => sourceFilter === 'all' || (lead.source || 'Unknown') === sourceFilter)
      .filter((lead) => {
        if (!normalizedQuery) return true;
        return [
          lead.name,
          lead.phone,
          lead.email,
          lead.address,
          lead.source,
          lead.campaign,
          lead.utmCampaign,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery));
      })
      .sort((a, b) => {
        const aDate = new Date(a.lastEventAt || a.updatedAt || a.createdAt).getTime();
        const bDate = new Date(b.lastEventAt || b.updatedAt || b.createdAt).getTime();
        return bDate - aDate;
      });
  }, [leads, query, stageFilter, sourceFilter]);

  const totals = useMemo(() => {
    const booked = filteredLeads.filter((lead) =>
      ['Estimate Booked', 'Estimate Completed', 'Quoted', 'Won'].includes(lead.stage)
    ).length;
    const won = filteredLeads.filter((lead) => lead.stage === 'Won').length;
    const disqualified = filteredLeads.filter((lead) => lead.stage === 'Disqualified').length;
    const pending = filteredLeads.filter((lead) =>
      ['New', 'Contact Attempted', 'Engaged'].includes(lead.stage)
    ).length;
    return {
      total: filteredLeads.length,
      pending,
      booked,
      won,
      disqualified,
    };
  }, [filteredLeads]);

  const handleLeadChange = async (lead: Lead, patch: Partial<Lead>) => {
    const now = new Date().toISOString();
    const nextStage = patch.stage || lead.stage;
    const nextLead: Lead = {
      ...lead,
      ...patch,
      closedAt: TERMINAL_STAGES.has(nextStage) ? lead.closedAt || now : undefined,
      updatedAt: now,
    };

    if ('stage' in patch && !DISPOSITION_STAGES.has(nextStage)) {
      nextLead.dispositionReason = undefined;
      nextLead.dispositionNotes = undefined;
    }

    setUpdatingLeadId(lead.id);
    try {
      await updateLead(nextLead);
      setLeads((current) => current.map((item) => (item.id === lead.id ? nextLead : item)));
    } catch (error) {
      console.error('Error updating lead:', error);
    } finally {
      setUpdatingLeadId(null);
    }
  };

  const openEditLead = (lead: Lead) => {
    setEditingLead(lead);
    setEditForm(formFromLead(lead));
    setEditError('');
  };

  const closeEditLead = () => {
    if (savingEdit) return;
    setEditingLead(null);
    setEditForm(EMPTY_LEAD_FORM);
    setEditError('');
  };

  const handleEditStageChange = (stage: LeadStage) => {
    setEditForm((current) => ({
      ...current,
      stage,
      ...(!DISPOSITION_STAGES.has(stage)
        ? { dispositionReason: '' as const, dispositionNotes: '' }
        : {}),
    }));
  };

  const handleSaveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingLead) return;

    const nextLead = applyLeadEdit(editingLead, editForm);

    setSavingEdit(true);
    setEditError('');
    try {
      await updateLead(nextLead);
      setLeads((current) => current.map((item) => (item.id === nextLead.id ? nextLead : item)));
      setEditingLead(null);
      setEditForm(EMPTY_LEAD_FORM);
    } catch (error) {
      console.error('Error saving lead:', error);
      setEditError('Unable to save this lead. Please try again.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteLead = async (lead: Lead) => {
    const linkedJob = jobByLead.get(lead.id);
    const displayName = getLeadDisplayName(lead);
    const confirmed = window.confirm(
      linkedJob
        ? `Delete ${displayName}? The linked job "${linkedJob.name || 'Untitled Job'}" will not be deleted.`
        : `Delete ${displayName}? This will hide the lead from this list.`
    );

    if (!confirmed) return;

    setDeletingLeadId(lead.id);
    try {
      await deleteLead(lead.id);
      setLeads((current) => current.filter((item) => item.id !== lead.id));
      if (editingLead?.id === lead.id) {
        setEditingLead(null);
        setEditForm(EMPTY_LEAD_FORM);
      }
    } catch (error) {
      console.error('Error deleting lead:', error);
      window.alert('Unable to delete this lead. Please try again.');
    } finally {
      setDeletingLeadId(null);
    }
  };

  const editCanSetDisposition = DISPOSITION_STAGES.has(editForm.stage);

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Leads</h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1">Track lead quality, bookings, and job conversion</p>
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
          <p className="text-xs text-slate-500">Leads</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{totals.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
          <p className="text-xs text-slate-500">Pending</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{totals.pending}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
          <p className="text-xs text-slate-500">Booked+</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{totals.booked}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
          <p className="text-xs text-slate-500">Won</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{totals.won}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
          <p className="text-xs text-slate-500">Disqualified</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{totals.disqualified}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 md:p-6 mb-4 sm:mb-6">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_220px]">
          <label className="relative block">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search leads..."
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gf-lime"
            />
          </label>

          <label className="relative block">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={stageFilter}
              onChange={(event) => setStageFilter(event.target.value as LeadStage | 'all')}
              className="w-full appearance-none rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gf-lime"
            >
              <option value="all">All stages</option>
              {LEAD_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </label>

          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gf-lime"
          >
            <option value="all">All sources</option>
            <option value="Unknown">Unknown source</option>
            {sourceOptions.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-600">Loading leads...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-8 text-center text-slate-600">No leads found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Lead</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Source</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Stage</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Disposition</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Appointment</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Job</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredLeads.map((lead) => {
                  const latestAppointment = latestAppointmentByLead.get(lead.id);
                  const linkedJob = jobByLead.get(lead.id);
                  const canSetDisposition = DISPOSITION_STAGES.has(lead.stage);
                  const displayName = getLeadDisplayName(lead);
                  const isLeadBusy = updatingLeadId === lead.id || deletingLeadId === lead.id;

                  return (
                    <tr key={lead.id} className="align-top hover:bg-slate-50/60">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-900">{displayName}</div>
                        <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                          {lead.phone && <div>{lead.phone}</div>}
                          {lead.email && <div>{lead.email}</div>}
                          {lead.address && <div className="max-w-xs truncate">{lead.address}</div>}
                          <div>Last event {formatRelativeDate(lead.lastEventAt || lead.updatedAt)}</div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditLead(lead)}
                            disabled={isLeadBusy}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Edit2 size={13} />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLead(lead)}
                            disabled={isLeadBusy}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingLeadId === lead.id ? (
                              <RefreshCw size={13} className="animate-spin" />
                            ) : (
                              <Trash2 size={13} />
                            )}
                            Delete
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-800">{lead.source || 'Unknown'}</div>
                        {lead.campaign && <div className="mt-1 text-xs text-slate-500">{lead.campaign}</div>}
                        {lead.utmCampaign && <div className="mt-1 text-xs text-slate-500">{lead.utmCampaign}</div>}
                      </td>

                      <td className="px-4 py-4 min-w-48">
                        <select
                          value={lead.stage}
                          disabled={updatingLeadId === lead.id}
                          onChange={(event) => handleLeadChange(lead, { stage: event.target.value as LeadStage })}
                          className={`w-full rounded-lg border-0 px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-gf-lime ${stageBadgeClass(lead.stage)}`}
                        >
                          {LEAD_STAGES.map((stage) => (
                            <option key={stage} value={stage}>
                              {stage}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-4 py-4 min-w-56">
                        <select
                          value={lead.dispositionReason || ''}
                          disabled={!canSetDisposition || updatingLeadId === lead.id}
                          onChange={(event) =>
                            handleLeadChange(lead, {
                              dispositionReason: event.target.value
                                ? (event.target.value as LeadDispositionReason)
                                : undefined,
                            })
                          }
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gf-lime disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          <option value="">{canSetDisposition ? 'No reason' : 'Only lost/disqualified'}</option>
                          {LEAD_DISPOSITION_REASONS.map((reason) => (
                            <option key={reason} value={reason}>
                              {reason}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-4 py-4 min-w-52">
                        {latestAppointment ? (
                          <div>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${appointmentBadgeClass(latestAppointment.status)}`}>
                              <CalendarDays size={13} />
                              {latestAppointment.status}
                            </span>
                            <div className="mt-2 text-sm font-medium text-slate-800">
                              {formatDateTime(latestAppointment.scheduledStartAt)}
                            </div>
                            {latestAppointment.calendarName && (
                              <div className="mt-1 text-xs text-slate-500">{latestAppointment.calendarName}</div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">
                            <Clock size={13} />
                            Not booked
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4 min-w-48">
                        {linkedJob ? (
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => onEditJob(linkedJob.id)}
                              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-700"
                            >
                              <ExternalLink size={14} />
                              Open Job
                            </button>
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              {linkedJob.status === 'Won' ? (
                                <CheckCircle2 size={13} className="text-green-600" />
                              ) : linkedJob.status === 'Lost' ? (
                                <XCircle size={13} className="text-red-600" />
                              ) : (
                                <Clock size={13} className="text-amber-600" />
                              )}
                              {linkedJob.status}
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onNewJobFromLead(lead.id)}
                            className="inline-flex items-center gap-2 rounded-lg bg-gf-lime px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-gf-dark-green"
                          >
                            <Plus size={14} />
                            Create Job
                          </button>
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-6">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Edit Lead</h2>
                <p className="text-xs text-slate-500">
                  Last event {formatRelativeDate(editingLead.lastEventAt || editingLead.updatedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditLead}
                disabled={savingEdit}
                title="Close"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
              {editError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {editError}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-slate-500">Name</span>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gf-lime"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase text-slate-500">Phone</span>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gf-lime"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase text-slate-500">Email</span>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gf-lime"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase text-slate-500">Source</span>
                  <input
                    type="text"
                    value={editForm.source}
                    onChange={(event) => setEditForm((current) => ({ ...current, source: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gf-lime"
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="text-xs font-semibold uppercase text-slate-500">Address</span>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={(event) => setEditForm((current) => ({ ...current, address: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gf-lime"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase text-slate-500">Campaign</span>
                  <input
                    type="text"
                    value={editForm.campaign}
                    onChange={(event) => setEditForm((current) => ({ ...current, campaign: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gf-lime"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase text-slate-500">Stage</span>
                  <select
                    value={editForm.stage}
                    onChange={(event) => handleEditStageChange(event.target.value as LeadStage)}
                    className={`mt-1 w-full rounded-lg border-0 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-gf-lime ${stageBadgeClass(editForm.stage)}`}
                  >
                    {LEAD_STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase text-slate-500">Disposition Reason</span>
                  <select
                    value={editForm.dispositionReason}
                    disabled={!editCanSetDisposition}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        dispositionReason: event.target.value as LeadDispositionReason | '',
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gf-lime disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">{editCanSetDisposition ? 'No reason' : 'Only lost/disqualified'}</option>
                    {LEAD_DISPOSITION_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block sm:col-span-2">
                  <span className="text-xs font-semibold uppercase text-slate-500">Disposition Notes</span>
                  <textarea
                    value={editForm.dispositionNotes}
                    disabled={!editCanSetDisposition}
                    onChange={(event) => setEditForm((current) => ({ ...current, dispositionNotes: event.target.value }))}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gf-lime disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </label>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeEditLead}
                  disabled={savingEdit}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-gf-lime px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gf-dark-green disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {savingEdit ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                  {savingEdit ? 'Saving...' : 'Save Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
