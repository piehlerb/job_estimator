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
  getOrgMembers,
  getOrgInvitations,
  generateInviteCode,
  revokeInvitation,
  updateMemberRole,
  updateMemberAccessLevel,
  removeMember,
} from '../lib/organizationService';
import type { OrganizationMember, OrganizationInvitation, OrgAccessLevel } from '../types';

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
  const [inviteLoading, setInviteLoading] = useState(false);

  // Copied state for invite codes
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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
  // Generate invite code
  // =====================================================
  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;
    setMgmtError('');
    setInviteLoading(true);
    try {
      await generateInviteCode(organization.id, newInviteEmail || undefined, newInviteRole);
      setNewInviteEmail('');
      setNewInviteRole('member');
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
  // Change access level
  // =====================================================
  const handleAccessLevelChange = async (userId: string, accessLevel: OrgAccessLevel) => {
    if (!organization) return;
    setMgmtError('');
    try {
      await updateMemberAccessLevel(organization.id, userId, accessLevel);
      await loadOrgData();
    } catch (err: any) {
      setMgmtError(err.message ?? 'Failed to update access level.');
    }
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
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Access</th>
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
                        {isAdmin && !isSelf ? (
                          <select
                            value={member.accessLevel ?? 'full'}
                            onChange={(e) =>
                              handleAccessLevelChange(member.userId, e.target.value as OrgAccessLevel)
                            }
                            className="text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-gf-electric/40"
                          >
                            <option value="full">Full Access</option>
                            <option value="inventory_only">Inventory Only</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 ${
                            (member.accessLevel ?? 'full') === 'full'
                              ? 'text-green-700 bg-green-50 border border-green-200'
                              : 'text-purple-700 bg-purple-50 border border-purple-200'
                          }`}>
                            <Lock size={10} />
                            {(member.accessLevel ?? 'full') === 'full' ? 'Full Access' : 'Inventory Only'}
                          </span>
                        )}
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
            className="flex flex-wrap items-end gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4"
          >
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
                onChange={(e) => setNewInviteRole(e.target.value as 'admin' | 'member')}
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
                    <div className="flex flex-col">
                      <span className={`text-xs font-medium rounded-full px-2 py-0.5 w-fit ${
                        inv.role === 'admin'
                          ? 'text-amber-700 bg-amber-50'
                          : 'text-slate-600 bg-slate-100'
                      }`}>
                        {inv.role}
                      </span>
                      {inv.email && (
                        <span className="text-xs text-slate-500 mt-0.5">for {inv.email}</span>
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
    </div>
  );
}
