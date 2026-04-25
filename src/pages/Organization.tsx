import { useState, useEffect, useCallback } from 'react';
import {
  Building2, UserPlus, Users, Copy, Check, Trash2,
  LogOut, ShieldCheck, Shield, Plus, RefreshCw, KeyRound, Lock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  createOrganization,
  joinOrganizationByCode,
  leaveOrganization,
  deleteOrganization,
  getOrgMembers,
  getOrgInvitations,
  generateInviteCode,
  revokeInvitation,
  updateMemberRole,
  updateMemberPermissions,
  removeMember,
} from '../lib/organizationService';
import type { OrganizationMember, OrganizationInvitation, MemberPermissions } from '../types';
import { FULL_PERMISSIONS, INVENTORY_ONLY_PERMISSIONS, permissionsFromAccessLevel } from '../lib/permissions';

export default function Organization() {
  const { user, organization, orgRole, orgLoading, refreshOrganization } = useAuth();

  // Create / join form state
  const [view, setView] = useState<'create' | 'join'>('create');
  const [orgName, setOrgName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Org management state
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [mgmtError, setMgmtError] = useState('');

  // New invite form
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [newInviteRole, setNewInviteRole] = useState<'admin' | 'member'>('member');
  const [newInvitePermissions, setNewInvitePermissions] = useState<MemberPermissions>({ ...FULL_PERMISSIONS });
  const [showInvitePerms, setShowInvitePerms] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);

  // Copied state for invite codes
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Permissions editor modal state
  const [editingPermsMember, setEditingPermsMember] = useState<OrganizationMember | null>(null);
  const [draftPermissions, setDraftPermissions] = useState<MemberPermissions>(FULL_PERMISSIONS);
  const [savingPerms, setSavingPerms] = useState(false);

  // =====================================================
  // Load members + invitations when org is available
  // =====================================================
  const loadOrgData = useCallback(async () => {
    if (!organization) return;
    setDataLoading(true);
    setMgmtError('');
    try {
      const [m, i] = await Promise.all([
        getOrgMembers(organization.id),
        getOrgInvitations(organization.id),
      ]);
      setMembers(m);
      setInvitations(i);
    } catch (err: any) {
      setMgmtError(err.message ?? 'Failed to load organization data.');
    } finally {
      setDataLoading(false);
    }
  }, [organization]);

  useEffect(() => {
    if (organization) {
      loadOrgData();
    }
  }, [organization, loadOrgData]);

  // =====================================================
  // Create organization
  // =====================================================
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) return;
    setFormError('');
    setFormLoading(true);
    try {
      await createOrganization(orgName);
      await refreshOrganization();
    } catch (err: any) {
      setFormError(err.message ?? 'Failed to create organization.');
    } finally {
      setFormLoading(false);
    }
  };

  // =====================================================
  // Join via invite code
  // =====================================================
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setFormError('');
    setFormLoading(true);
    try {
      await joinOrganizationByCode(inviteCode);
      await refreshOrganization();
    } catch (err: any) {
      setFormError(err.message ?? 'Failed to join organization.');
    } finally {
      setFormLoading(false);
    }
  };

  // =====================================================
  // Leave organization
  // =====================================================
  const handleLeave = async () => {
    if (!organization) return;
    if (!confirm('Are you sure you want to leave this organization? Your data will remain in the org.')) return;
    setMgmtError('');
    try {
      await leaveOrganization(organization.id);
      await refreshOrganization();
    } catch (err: any) {
      setMgmtError(err.message ?? 'Failed to leave organization.');
    }
  };

  // =====================================================
  // Delete organization
  // =====================================================
  const handleDelete = async () => {
    if (!organization) return;
    if (!confirm(`Permanently delete "${organization.name}"? All members will lose access. Your data will be kept but unlinked from the org.`)) return;
    setMgmtError('');
    try {
      await deleteOrganization(organization.id);
      await refreshOrganization();
    } catch (err: any) {
      setMgmtError(err.message ?? 'Failed to delete organization.');
    }
  };

  // =====================================================
  // Generate invite code
  // =====================================================
  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;
    setMgmtError('');
    setInviteLoading(true);
    try {
      await generateInviteCode(
        organization.id,
        newInviteEmail || undefined,
        newInviteRole,
        newInviteRole === 'member' ? newInvitePermissions : null,
      );
      setNewInviteEmail('');
      setNewInviteRole('member');
      setNewInvitePermissions({ ...FULL_PERMISSIONS });
      setShowInvitePerms(false);
      await loadOrgData();
    } catch (err: any) {
      setMgmtError(err.message ?? 'Failed to generate invite.');
    } finally {
      setInviteLoading(false);
    }
  };

  // =====================================================
  // Revoke invite
  // =====================================================
  const handleRevokeInvite = async (invitationId: string) => {
    if (!confirm('Revoke this invite code?')) return;
    setMgmtError('');
    try {
      await revokeInvitation(invitationId);
      await loadOrgData();
    } catch (err: any) {
      setMgmtError(err.message ?? 'Failed to revoke invitation.');
    }
  };

  // =====================================================
  // Change role
  // =====================================================
  const handleRoleChange = async (userId: string, newRole: 'admin' | 'member') => {
    if (!organization) return;
    setMgmtError('');
    try {
      await updateMemberRole(organization.id, userId, newRole);
      await loadOrgData();
    } catch (err: any) {
      setMgmtError(err.message ?? 'Failed to update role.');
    }
  };

  // =====================================================
  // Permissions editor
  // =====================================================
  const openPermissionsEditor = (member: OrganizationMember) => {
    const initial = member.permissions ?? permissionsFromAccessLevel(member.accessLevel ?? 'full');
    setDraftPermissions({ ...initial });
    setEditingPermsMember(member);
  };

  const closePermissionsEditor = () => {
    setEditingPermsMember(null);
  };

  const savePermissions = async () => {
    if (!organization || !editingPermsMember) return;
    setSavingPerms(true);
    setMgmtError('');
    try {
      await updateMemberPermissions(organization.id, editingPermsMember.userId, draftPermissions);
      await loadOrgData();
      setEditingPermsMember(null);
    } catch (err: any) {
      setMgmtError(err.message ?? 'Failed to update permissions.');
    } finally {
      setSavingPerms(false);
    }
  };

  const summarizePermissions = (m: OrganizationMember): string => {
    const p = m.permissions ?? permissionsFromAccessLevel(m.accessLevel ?? 'full');
    const parts: string[] = [];
    if (p.jobs === 'write') parts.push('Jobs: Write');
    else if (p.jobs === 'read') parts.push('Jobs: Read');
    if (p.calendar === 'full') parts.push('Calendar');
    else if (p.calendar === 'install') parts.push('Calendar: Install');
    if (p.inventory) parts.push('Inventory');
    if (p.reporting) parts.push('Reporting');
    const others = [
      p.customers && 'Customers',
      p.referralAssociates && 'Referrals',
      p.products && 'Products',
      p.chipSystems && 'Systems',
      p.chipBlends && 'Blends',
      p.laborers && 'Laborers',
      p.costs && 'Costs',
      p.pricing && 'Pricing',
      p.settings && 'Settings',
      p.backup && 'Backup',
    ].filter(Boolean) as string[];
    if (others.length >= 8) parts.push('All admin');
    else if (others.length > 0) parts.push(`+${others.length}`);
    return parts.length === 0 ? 'No access' : parts.join(' · ');
  };

  // =====================================================
  // Remove member
  // =====================================================
  const handleRemoveMember = async (userId: string, email: string) => {
    if (!organization) return;
    if (!confirm(`Remove ${email} from the organization?`)) return;
    setMgmtError('');
    try {
      await removeMember(organization.id, userId);
      await loadOrgData();
    } catch (err: any) {
      setMgmtError(err.message ?? 'Failed to remove member.');
    }
  };

  // =====================================================
  // Copy invite code to clipboard
  // =====================================================
  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // Fallback
      const el = document.createElement('textarea');
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  // =====================================================
  // Loading state
  // =====================================================
  if (orgLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gf-electric" />
      </div>
    );
  }

  // =====================================================
  // NO ORG — show create / join UI
  // =====================================================
  if (!organization) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Building2 size={28} className="text-gf-electric" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Organization</h1>
            <p className="text-slate-500 text-sm">Collaborate with your team on shared data</p>
          </div>
        </div>

        {/* Tab selector */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg mb-6">
          <button
            onClick={() => { setView('create'); setFormError(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              view === 'create'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Create Organization
          </button>
          <button
            onClick={() => { setView('join'); setFormError(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              view === 'join'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Join with Code
          </button>
        </div>

        {view === 'create' ? (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Organization Name
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Acme Flooring"
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gf-electric/40 focus:border-gf-electric"
                required
              />
            </div>
            {formError && (
              <p className="text-red-600 text-sm">{formError}</p>
            )}
            <p className="text-xs text-slate-500">
              You will be the admin. Your existing data (jobs, customers, systems, etc.)
              will be shared with all members you invite.
            </p>
            <button
              type="submit"
              disabled={formLoading || !orgName.trim()}
              className="w-full flex items-center justify-center gap-2 bg-gf-electric text-black font-semibold py-2.5 rounded-lg hover:bg-gf-electric/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {formLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black" />
              ) : (
                <Building2 size={16} />
              )}
              Create Organization
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Invite Code
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABC12345"
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-gf-electric/40 focus:border-gf-electric"
                maxLength={8}
                required
              />
            </div>
            {formError && (
              <p className="text-red-600 text-sm">{formError}</p>
            )}
            <p className="text-xs text-slate-500">
              Enter an invite code provided by your organization admin. Your existing data
              will be merged into the shared organization.
            </p>
            <button
              type="submit"
              disabled={formLoading || inviteCode.trim().length < 6}
              className="w-full flex items-center justify-center gap-2 bg-gf-electric text-black font-semibold py-2.5 rounded-lg hover:bg-gf-electric/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {formLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black" />
              ) : (
                <KeyRound size={16} />
              )}
              Join Organization
            </button>
          </form>
        )}
      </div>
    );
  }

  // =====================================================
  // IN ORG — management UI
  // =====================================================
  const isAdmin = orgRole === 'admin';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Building2 size={28} className="text-gf-electric" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{organization.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {isAdmin ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                  <ShieldCheck size={11} /> Admin
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
                  <Shield size={11} /> Member
                </span>
              )}
              <span className="text-xs text-slate-500">{user?.email}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadOrgData}
            disabled={dataLoading}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className={dataLoading ? 'animate-spin' : ''} />
          </button>
          {isAdmin && (
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              title="Delete organization"
            >
              <Trash2 size={14} />
              Delete Org
            </button>
          )}
          <button
            onClick={handleLeave}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            <LogOut size={14} />
            Leave
          </button>
        </div>
      </div>

      {mgmtError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {mgmtError}
        </div>
      )}

      {/* Members */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Users size={18} className="text-slate-500" />
          <h2 className="text-base font-semibold text-slate-700">
            Members ({members.length})
          </h2>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          {dataLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gf-electric" />
            </div>
          ) : members.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">No members yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Email</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Role</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Permissions</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Joined</th>
                  {isAdmin && <th className="px-4 py-2.5" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((member) => {
                  const isSelf = member.userId === user?.id;
                  return (
                    <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {member.email}
                        {isSelf && (
                          <span className="ml-2 text-xs text-slate-400">(you)</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isAdmin && !isSelf ? (
                          <select
                            value={member.role}
                            onChange={(e) =>
                              handleRoleChange(member.userId, e.target.value as 'admin' | 'member')
                            }
                            className="text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-gf-electric/40"
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 ${
                            member.role === 'admin'
                              ? 'text-amber-700 bg-amber-50 border border-amber-200'
                              : 'text-slate-600 bg-slate-100 border border-slate-200'
                          }`}>
                            {member.role === 'admin' ? <ShieldCheck size={10} /> : <Shield size={10} />}
                            {member.role}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-0.5 max-w-[260px] truncate" title={summarizePermissions(member)}>
                            <Lock size={10} />
                            {summarizePermissions(member)}
                          </span>
                          {isAdmin && !isSelf && (
                            <button
                              onClick={() => openPermissionsEditor(member)}
                              className="text-xs text-gf-dark-green hover:text-gf-lime font-medium"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {new Date(member.joinedAt).toLocaleDateString()}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          {!isSelf && (
                            <button
                              onClick={() => handleRemoveMember(member.userId, member.email)}
                              className="p-1 text-slate-400 hover:text-red-500 transition-colors rounded"
                              title="Remove member"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Invite Codes — Admin only */}
      {isAdmin && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <UserPlus size={18} className="text-slate-500" />
            <h2 className="text-base font-semibold text-slate-700">Invite Codes</h2>
          </div>

          {/* Generate new invite */}
          <form
            onSubmit={handleGenerateInvite}
            className="flex flex-col gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4"
          >
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Email (optional)
                </label>
                <input
                  type="email"
                  value={newInviteEmail}
                  onChange={(e) => setNewInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gf-electric/40 focus:border-gf-electric"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
                <select
                  value={newInviteRole}
                  onChange={(e) => {
                    setNewInviteRole(e.target.value as 'admin' | 'member');
                    setShowInvitePerms(false);
                  }}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gf-electric/40"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={inviteLoading}
                className="flex items-center gap-1.5 bg-gf-electric text-black text-sm font-medium px-4 py-2 rounded-lg hover:bg-gf-electric/90 disabled:opacity-50 transition-colors"
              >
                {inviteLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black" />
                ) : (
                  <Plus size={15} />
                )}
                Generate Code
              </button>
            </div>

            {/* Collapsible permissions — member role only */}
            {newInviteRole === 'member' && (
              <div className="border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => setShowInvitePerms(v => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium text-gf-dark-green hover:text-gf-lime transition-colors"
                >
                  <Lock size={12} />
                  {showInvitePerms ? 'Hide permissions' : 'Set permissions'}
                </button>

                {showInvitePerms && (
                  <div className="mt-3 space-y-4">
                    {/* Presets */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setNewInvitePermissions({ ...FULL_PERMISSIONS })}
                        className="flex-1 px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        Preset: Full Access
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewInvitePermissions({ ...INVENTORY_ONLY_PERMISSIONS })}
                        className="flex-1 px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        Preset: Inventory Only
                      </button>
                    </div>

                    {/* Jobs */}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Jobs</label>
                      <select
                        value={newInvitePermissions.jobs}
                        onChange={(e) => setNewInvitePermissions({ ...newInvitePermissions, jobs: e.target.value as MemberPermissions['jobs'] })}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-gf-electric/40"
                      >
                        <option value="none">No access</option>
                        <option value="read">Read only (Job Summary)</option>
                        <option value="write">Read &amp; write (full job page)</option>
                      </select>
                    </div>

                    {/* Calendar */}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Calendar</label>
                      <select
                        value={newInvitePermissions.calendar}
                        onChange={(e) => setNewInvitePermissions({ ...newInvitePermissions, calendar: e.target.value as MemberPermissions['calendar'] })}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-gf-electric/40"
                      >
                        <option value="none">No access</option>
                        <option value="install">Install calendar only (Won jobs)</option>
                        <option value="full">Full calendar (all statuses)</option>
                      </select>
                    </div>

                    {/* Other pages */}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-2">Other Pages</label>
                      <div className="grid grid-cols-2 gap-1">
                        {([
                          ['inventory', 'Inventory & Shopping'],
                          ['reporting', 'Reporting'],
                          ['customers', 'Customers'],
                          ['referralAssociates', 'Referral Associates'],
                          ['products', 'Products'],
                          ['chipSystems', 'Chip Systems'],
                          ['chipBlends', 'Chip Blends'],
                          ['laborers', 'Laborers'],
                          ['costs', 'Costs'],
                          ['pricing', 'Pricing'],
                          ['settings', 'Settings'],
                          ['backup', 'Backup'],
                        ] as const).map(([key, label]) => (
                          <label key={key} className="flex items-center gap-2 text-xs text-slate-700 px-2 py-1 rounded hover:bg-slate-100 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newInvitePermissions[key]}
                              onChange={(e) => setNewInvitePermissions({ ...newInvitePermissions, [key]: e.target.checked })}
                              className="rounded border-slate-300 text-gf-lime focus:ring-gf-lime"
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </form>

          {/* Existing invite codes */}
          {invitations.length === 0 ? (
            <p className="text-sm text-slate-400">No active invite codes.</p>
          ) : (
            <div className="space-y-2">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-4 p-3 border border-slate-200 rounded-lg bg-white"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-lg font-bold tracking-widest text-slate-800">
                      {inv.inviteCode}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-medium rounded-full px-2 py-0.5 w-fit ${
                          inv.role === 'admin'
                            ? 'text-amber-700 bg-amber-50'
                            : 'text-slate-600 bg-slate-100'
                        }`}>
                          {inv.role}
                        </span>
                        {inv.role === 'member' && inv.permissions && (
                          <span className="text-xs font-medium rounded-full px-2 py-0.5 text-gf-dark-green bg-green-50">
                            custom permissions
                          </span>
                        )}
                      </div>
                      {inv.email && (
                        <span className="text-xs text-slate-500">for {inv.email}</span>
                      )}
                      <span className="text-xs text-slate-400">
                        Expires {new Date(inv.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(inv.inviteCode)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600"
                    >
                      {copiedCode === inv.inviteCode ? (
                        <><Check size={12} className="text-green-600" /> Copied</>
                      ) : (
                        <><Copy size={12} /> Copy</>
                      )}
                    </button>
                    <button
                      onClick={() => handleRevokeInvite(inv.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded"
                      title="Revoke invite"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Permissions Editor Modal */}
      {editingPermsMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closePermissionsEditor}>
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Edit Permissions</h3>
                <p className="text-xs text-slate-500 mt-0.5">{editingPermsMember.email}</p>
              </div>
              <button onClick={closePermissionsEditor} className="text-slate-400 hover:text-slate-700 text-2xl leading-none px-2">
                ×
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Quick presets */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDraftPermissions({ ...FULL_PERMISSIONS })}
                  className="flex-1 px-3 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Preset: Full Access
                </button>
                <button
                  type="button"
                  onClick={() => setDraftPermissions({ ...INVENTORY_ONLY_PERMISSIONS })}
                  className="flex-1 px-3 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Preset: Inventory Only
                </button>
              </div>

              {/* Jobs */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Jobs</label>
                <select
                  value={draftPermissions.jobs}
                  onChange={(e) => setDraftPermissions({ ...draftPermissions, jobs: e.target.value as MemberPermissions['jobs'] })}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-gf-electric/40"
                >
                  <option value="none">No access</option>
                  <option value="read">Read only (Job Summary)</option>
                  <option value="write">Read &amp; write (full job page)</option>
                </select>
              </div>

              {/* Calendar */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Calendar</label>
                <select
                  value={draftPermissions.calendar}
                  onChange={(e) => setDraftPermissions({ ...draftPermissions, calendar: e.target.value as MemberPermissions['calendar'] })}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-gf-electric/40"
                >
                  <option value="none">No access</option>
                  <option value="install">Install calendar only (Won jobs)</option>
                  <option value="full">Full calendar (all statuses)</option>
                </select>
              </div>

              {/* Other features */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Other Pages</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ['inventory', 'Inventory & Shopping'],
                    ['reporting', 'Reporting'],
                    ['customers', 'Customers'],
                    ['referralAssociates', 'Referral Associates'],
                    ['products', 'Products'],
                    ['chipSystems', 'Chip Systems'],
                    ['chipBlends', 'Chip Blends'],
                    ['laborers', 'Laborers'],
                    ['costs', 'Costs'],
                    ['pricing', 'Pricing'],
                    ['settings', 'Settings'],
                    ['backup', 'Backup'],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-slate-700 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draftPermissions[key]}
                        onChange={(e) => setDraftPermissions({ ...draftPermissions, [key]: e.target.checked })}
                        className="rounded border-slate-300 text-gf-lime focus:ring-gf-lime"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={closePermissionsEditor}
                disabled={savingPerms}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={savePermissions}
                disabled={savingPerms}
                className="px-4 py-2 text-sm font-medium bg-gf-lime text-white rounded-lg hover:bg-gf-dark-green disabled:opacity-50"
              >
                {savingPerms ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
