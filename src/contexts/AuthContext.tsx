/**
 * Auth Context
 * Provides authentication state and organization context to the entire app.
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { getCurrentUser, onAuthStateChange } from '../lib/auth';
import { getMyOrganization } from '../lib/organizationService';
import { setSyncOrgContext } from '../lib/sync';
import type { Organization, OrgAccessLevel } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  organization: Organization | null;
  orgRole: 'admin' | 'member' | null;
  orgAccessLevel: OrgAccessLevel | null;
  orgLoading: boolean;
  refreshOrganization: () => Promise<void>;
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
  const [orgLoading, setOrgLoading] = useState(false);

  const loadOrganization = useCallback(async () => {
    setOrgLoading(true);
    try {
      const result = await getMyOrganization();
      if (result) {
        setOrganization(result.org);
        setOrgRole(result.role);
        setOrgAccessLevel(result.accessLevel);
        setSyncOrgContext(result.org.id);
      } else {
        setOrganization(null);
        setOrgRole(null);
        setOrgAccessLevel(null);
        setSyncOrgContext(null);
      }
    } catch (err) {
      console.warn('[Auth] Failed to load organization:', err);
      setOrganization(null);
      setOrgRole(null);
      setSyncOrgContext(null);
    } finally {
      setOrgLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check for existing session on mount
    getCurrentUser().then((currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        loadOrganization();
      }
    });

    // Listen for auth state changes
    const unsubscribe = onAuthStateChange((authUser) => {
      setUser(authUser);
      setLoading(false);
      if (authUser) {
        loadOrganization();
      } else {
        // Signed out — clear org context
        setOrganization(null);
        setOrgRole(null);
        setOrgAccessLevel(null);
        setSyncOrgContext(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [loadOrganization]);

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: user !== null,
    organization,
    orgRole,
    orgAccessLevel,
    orgLoading,
    refreshOrganization: loadOrganization,
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
