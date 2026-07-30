/**
 * Auth Context
 * Provides authentication state and organization context to the entire app.
 */

import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { getCurrentUser, onAuthStateChange } from '../lib/auth';
import {
  clearPendingInviteCode,
  getMyOrganization,
  getPendingInviteCode,
  joinPendingOrganizationInvite,
} from '../lib/organizationService';
import { setSyncOrgContext, clearSyncOrgContext, clearLastSyncTimestamp } from '../lib/sync';
import { resolvePermissions, FULL_PERMISSIONS } from '../lib/permissions';
import type { Organization, OrgAccessLevel, MemberPermissions } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  organization: Organization | null;
  orgRole: 'admin' | 'member' | null;
  orgAccessLevel: OrgAccessLevel | null;
  permissions: MemberPermissions;
  orgLoading: boolean;
  refreshOrganization: () => Promise<void>;
  needsPasswordReset: boolean;
  clearPasswordReset: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgRole, setOrgRole] = useState<'admin' | 'member' | null>(null);
  const [orgAccessLevel, setOrgAccessLevel] = useState<OrgAccessLevel | null>(null);
  const [memberPermissions, setMemberPermissions] = useState<MemberPermissions | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false);
  // Tracks the last org id we set sync context for, so we can reset the sync
  // cursor whenever the org context changes (e.g. after first org-aware load).
  const lastSyncedOrgRef = useRef<string | null | undefined>(undefined);

  // Retry the org lookup with backoff whenever it fails. Sync is parked while
  // the org context is unresolved, so recovering here is what un-parks it.
  const orgRetryRef = useRef<{ attempt: number; timer: number | null }>({ attempt: 0, timer: null });
  const loadOrganizationRef = useRef<() => void>(() => {});

  const scheduleOrgRetry = useCallback(() => {
    const state = orgRetryRef.current;
    if (state.timer !== null) return;

    const delayMs = Math.min(30000, 2000 * 2 ** state.attempt);
    state.attempt += 1;
    state.timer = window.setTimeout(() => {
      state.timer = null;
      console.log('[Auth] Retrying organization load...');
      loadOrganizationRef.current();
    }, delayMs);
  }, []);

  const loadOrganization = useCallback(async () => {
    setOrgLoading(true);
    try {
      let result = await getMyOrganization();
      if (result) {
        clearPendingInviteCode();
      } else if (getPendingInviteCode()) {
        try {
          await joinPendingOrganizationInvite();
          result = await getMyOrganization();
        } catch (inviteError) {
          console.warn('[Auth] Failed to join pending organization invite:', inviteError);
        }
      }

      // Lookup succeeded (org or genuinely org-less) — reset the retry backoff.
      orgRetryRef.current.attempt = 0;

      if (result) {
        setOrganization(result.org);
        setOrgRole(result.role);
        setOrgAccessLevel(result.accessLevel);
        setMemberPermissions(result.permissions);
        setSyncOrgContext(result.org.id);
        if (lastSyncedOrgRef.current !== undefined && lastSyncedOrgRef.current !== result.org.id) {
          // Org context changed — reset the sync cursor so the next pull is full,
          // otherwise we'd skip records by reusing the previous scope's timestamp.
          await clearLastSyncTimestamp();
        }
        lastSyncedOrgRef.current = result.org.id;
      } else {
        setOrganization(null);
        setOrgRole(null);
        setOrgAccessLevel(null);
        setMemberPermissions(null);
        setSyncOrgContext(null);
        if (lastSyncedOrgRef.current !== undefined && lastSyncedOrgRef.current !== null) {
          await clearLastSyncTimestamp();
        }
        lastSyncedOrgRef.current = null;
      }
    } catch (err) {
      console.warn('[Auth] Failed to load organization:', err);
      setOrganization(null);
      setOrgRole(null);
      setMemberPermissions(null);
      // Unknown, NOT personal scope: a transient failure here used to leave the
      // session syncing as org-less, which stamped org_id = NULL on pushed
      // records and hid them from every other device. Sync stays parked until
      // a retry resolves the org, so keep retrying rather than stranding the
      // session until the next reload.
      clearSyncOrgContext();
      scheduleOrgRetry();
    } finally {
      setOrgLoading(false);
    }
  }, [scheduleOrgRetry]);

  loadOrganizationRef.current = loadOrganization;

  useEffect(() => {
    // Detect password recovery flow. Two signals, either one is sufficient:
    // 1. ?recovery=1 in the URL (set in our redirectTo, preserved when Supabase allows it)
    // 2. sessionStorage flag set when the user requested the reset email (same-browser fallback)
    const params = new URLSearchParams(window.location.search);
    const isRecovery =
      params.get('recovery') === '1' ||
      sessionStorage.getItem('pendingPasswordReset') === '1';
    if (isRecovery) {
      setNeedsPasswordReset(true);
      sessionStorage.removeItem('pendingPasswordReset');
      // Do NOT clean the URL here — Supabase reads ?code= asynchronously during its
      // PKCE exchange, and stripping query params before it runs breaks the exchange.
    }

    // Check for existing session on mount
    getCurrentUser().then((currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser && !isRecovery) {
        loadOrganization();
      }
    });

    // Listen for auth state changes
    const unsubscribe = onAuthStateChange((authUser, event) => {
      // Also handle non-PKCE flows that do fire PASSWORD_RECOVERY
      if (event === 'PASSWORD_RECOVERY') {
        setUser(authUser);
        setNeedsPasswordReset(true);
        setLoading(false);
        return;
      }
      setUser(authUser);
      setLoading(false);
      if (authUser) {
        loadOrganization();
      } else {
        // Signed out — clear org context
        setOrganization(null);
        setOrgRole(null);
        setOrgAccessLevel(null);
        setMemberPermissions(null);
        clearSyncOrgContext();
        lastSyncedOrgRef.current = undefined;
      }
    });

    return () => {
      unsubscribe();
      if (orgRetryRef.current.timer !== null) {
        clearTimeout(orgRetryRef.current.timer);
        orgRetryRef.current.timer = null;
      }
    };
  }, [loadOrganization]);

  const permissions = organization
    ? resolvePermissions({
        hasOrg: true,
        role: orgRole,
        accessLevel: orgAccessLevel,
        permissions: memberPermissions,
      })
    : FULL_PERMISSIONS;

  const clearPasswordReset = () => setNeedsPasswordReset(false);

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: user !== null,
    organization,
    orgRole,
    orgAccessLevel,
    permissions,
    orgLoading,
    refreshOrganization: loadOrganization,
    needsPasswordReset,
    clearPasswordReset,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
