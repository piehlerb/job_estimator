/**
 * Organization Service
 * Handles all organization management operations directly against Supabase.
 * These operations bypass the offline-first sync queue because they require
 * immediate consistency (membership changes must be visible to all users at once).
 */

import { supabase } from './supabase';
import type { Organization, OrganizationMember, OrganizationInvitation, OrgAccessLevel, MemberPermissions } from '../types';

// =====================================================
// HELPERS
// =====================================================

const PENDING_INVITE_CODE_KEY = 'pendingOrganizationInviteCode';

export function normalizeInviteCode(inviteCode: string): string {
  return inviteCode.trim().toUpperCase();
}

export function getPendingInviteCode(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(PENDING_INVITE_CODE_KEY);
}

export function savePendingInviteCode(inviteCode: string): void {
  if (typeof window === 'undefined') return;
  const normalizedCode = normalizeInviteCode(inviteCode);
  if (normalizedCode) {
    window.localStorage.setItem(PENDING_INVITE_CODE_KEY, normalizedCode);
  }
}

export function clearPendingInviteCode(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PENDING_INVITE_CODE_KEY);
}

function mapOrg(row: any): Organization {
  return {
    id: row.id,
    name: row.name,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMember(row: any): OrganizationMember {
  return {
    id: row.id,
    orgId: row.org_id,
    userId: row.user_id,
    email: row.email,
    role: row.role,
    accessLevel: (row.access_level as OrgAccessLevel) ?? 'full',
    permissions: (row.permissions as MemberPermissions | null) ?? null,
    invitedBy: row.invited_by ?? undefined,
    joinedAt: row.joined_at,
  };
}

function mapInvitation(row: any): OrganizationInvitation {
  return {
    id: row.id,
    orgId: row.org_id,
    email: row.email ?? undefined,
    role: row.role,
    inviteCode: row.invite_code,
    invitedBy: row.invited_by,
    acceptedBy: row.accepted_by ?? undefined,
    acceptedAt: row.accepted_at ?? undefined,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    permissions: (row.permissions as MemberPermissions | null) ?? null,
  };
}

// =====================================================
// QUERY: Get current user's organization + role
// =====================================================
export async function getMyOrganization(): Promise<{
  org: Organization;
  role: 'admin' | 'member';
  accessLevel: OrgAccessLevel;
  permissions: MemberPermissions | null;
} | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('organization_members')
    .select('role, access_level, permissions, org_id, organizations(id, name, created_by, created_at, updated_at)')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) return null;

  const orgRow = (data as any).organizations;
  if (!orgRow) return null;

  return {
    org: mapOrg(orgRow),
    role: data.role as 'admin' | 'member',
    accessLevel: ((data as any).access_level as OrgAccessLevel) ?? 'full',
    permissions: ((data as any).permissions as MemberPermissions | null) ?? null,
  };
}

// =====================================================
// CREATE: New organization (caller becomes admin)
// =====================================================
export async function createOrganization(name: string): Promise<Organization> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Insert org
  const { data: orgData, error: orgError } = await supabase
    .from('organizations')
    .insert({ name: name.trim(), created_by: user.id })
    .select()
    .single();

  if (orgError) throw new Error(orgError.message);

  // Add creator as admin member
  const { error: memberError } = await supabase
    .from('organization_members')
    .insert({
      org_id: orgData.id,
      user_id: user.id,
      email: user.email ?? '',
      role: 'admin',
    });

  if (memberError) {
    // Rollback: delete the org we just created
    await supabase.from('organizations').delete().eq('id', orgData.id);
    throw new Error(memberError.message);
  }

  // Migrate all existing personal data to this org
  await migrateMyDataToOrg(orgData.id);

  return mapOrg(orgData);
}

// =====================================================
// JOIN: Existing organization via invite code
// =====================================================
export async function joinOrganizationByCode(inviteCode: string): Promise<Organization> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Use a SECURITY DEFINER RPC to look up the invite + org, bypassing RLS.
  // Direct joins from organization_invitations → organizations fail for non-members
  // because the organizations RLS blocks access until the user is a member.
  const { data: rows, error: rpcError } = await supabase
    .rpc('lookup_invite_by_code', { p_invite_code: inviteCode.trim() });

  if (rpcError) throw new Error(rpcError.message);

  const row = rows?.[0];
  if (!row) throw new Error('Invalid or expired invite code.');

  const orgRow = {
    id: row.org_id,
    name: row.org_name,
    created_by: row.org_created_by,
    created_at: row.org_created_at,
    updated_at: row.org_updated_at,
  };

  // Check user isn't already a member
  const { data: existing } = await supabase
    .from('organization_members')
    .select('id')
    .eq('org_id', orgRow.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) throw new Error('You are already a member of this organization.');

  // Add user as member
  const { error: memberError } = await supabase
    .from('organization_members')
    .insert({
      org_id: orgRow.id,
      user_id: user.id,
      email: user.email ?? '',
      role: row.invite_role,
      invited_by: row.invited_by_user,
      permissions: row.invite_permissions ?? null,
    });

  if (memberError) throw new Error(memberError.message);

  // Mark invitation as accepted
  await supabase
    .from('organization_invitations')
    .update({ accepted_by: user.id, accepted_at: new Date().toISOString() })
    .eq('id', row.invitation_id);

  // Migrate all existing personal data to this org
  await migrateMyDataToOrg(orgRow.id);

  return mapOrg(orgRow);
}

export async function joinPendingOrganizationInvite(): Promise<Organization | null> {
  const pendingCode = getPendingInviteCode();
  if (!pendingCode) return null;

  try {
    const org = await joinOrganizationByCode(pendingCode);
    clearPendingInviteCode();
    return org;
  } catch (error) {
    clearPendingInviteCode();
    throw error;
  }
}

// =====================================================
// DELETE: Remove the entire organization (admin only)
// =====================================================
export async function deleteOrganization(orgId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_organization', { p_org_id: orgId });
  if (error) throw new Error(error.message);
}

// =====================================================
// LEAVE: Remove self from organization
// =====================================================
export async function leaveOrganization(orgId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Prevent last admin from leaving
  const { data: admins } = await supabase
    .from('organization_members')
    .select('id')
    .eq('org_id', orgId)
    .eq('role', 'admin');

  const { data: myMembership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (myMembership?.role === 'admin' && (admins?.length ?? 0) <= 1) {
    throw new Error(
      'You are the only admin. Assign another admin before leaving, or delete the organization.'
    );
  }

  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('org_id', orgId)
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);
}

// =====================================================
// READ: Members list
// =====================================================
export async function getOrgMembers(orgId: string): Promise<OrganizationMember[]> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('*')
    .eq('org_id', orgId)
    .order('joined_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapMember);
}

// =====================================================
// READ: Invitations list
// =====================================================
export async function getOrgInvitations(orgId: string): Promise<OrganizationInvitation[]> {
  const { data, error } = await supabase
    .from('organization_invitations')
    .select('*')
    .eq('org_id', orgId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapInvitation);
}

// =====================================================
// CREATE: New invitation
// =====================================================
export async function generateInviteCode(
  orgId: string,
  email?: string,
  role: 'admin' | 'member' = 'member',
  permissions?: MemberPermissions | null,
): Promise<OrganizationInvitation> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('organization_invitations')
    .insert({
      org_id: orgId,
      email: email?.trim() || null,
      role,
      invited_by: user.id,
      permissions: permissions ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapInvitation(data);
}

// =====================================================
// DELETE: Revoke an invitation
// =====================================================
export async function revokeInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase
    .from('organization_invitations')
    .delete()
    .eq('id', invitationId);

  if (error) throw new Error(error.message);
}

// =====================================================
// UPDATE: Change a member's role
// =====================================================
export async function updateMemberRole(
  orgId: string,
  userId: string,
  newRole: 'admin' | 'member'
): Promise<void> {
  // Prevent removing the last admin
  if (newRole === 'member') {
    const { data: admins } = await supabase
      .from('organization_members')
      .select('id')
      .eq('org_id', orgId)
      .eq('role', 'admin');

    const { data: target } = await supabase
      .from('organization_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();

    if (target?.role === 'admin' && (admins?.length ?? 0) <= 1) {
      throw new Error('Cannot demote the only admin. Promote another member first.');
    }
  }

  const { error } = await supabase
    .from('organization_members')
    .update({ role: newRole })
    .eq('org_id', orgId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}

// =====================================================
// UPDATE: Change a member's access level
// =====================================================
export async function updateMemberAccessLevel(
  orgId: string,
  userId: string,
  accessLevel: OrgAccessLevel
): Promise<void> {
  const { error } = await supabase
    .from('organization_members')
    .update({ access_level: accessLevel })
    .eq('org_id', orgId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}

// =====================================================
// UPDATE: Change a member's granular permissions
// =====================================================
export async function updateMemberPermissions(
  orgId: string,
  userId: string,
  permissions: MemberPermissions | null
): Promise<void> {
  const { error } = await supabase
    .from('organization_members')
    .update({ permissions })
    .eq('org_id', orgId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}

// =====================================================
// DELETE: Remove a member
// =====================================================
export async function removeMember(orgId: string, userId: string): Promise<void> {
  // Prevent removing the last admin
  const { data: target } = await supabase
    .from('organization_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();

  if (target?.role === 'admin') {
    const { data: admins } = await supabase
      .from('organization_members')
      .select('id')
      .eq('org_id', orgId)
      .eq('role', 'admin');

    if ((admins?.length ?? 0) <= 1) {
      throw new Error('Cannot remove the only admin.');
    }
  }

  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('org_id', orgId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}

// =====================================================
// INTERNAL: Migrate user's personal data to org via RPC
// =====================================================
async function migrateMyDataToOrg(orgId: string): Promise<void> {
  const { error } = await supabase.rpc('migrate_user_data_to_org', {
    p_org_id: orgId,
  });

  if (error) {
    // Log but don't throw — migration failure shouldn't block joining the org.
    // Data can be synced manually later.
    console.warn('[Org] Data migration to org failed:', error.message);
  }
}
