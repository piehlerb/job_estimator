import type { MemberPermissions, OrgAccessLevel } from '../types';

export const FULL_PERMISSIONS: MemberPermissions = {
  jobs: 'write',
  calendar: 'full',
  inventory: true,
  reporting: true,
  customers: true,
  referralAssociates: true,
  products: true,
  chipSystems: true,
  chipBlends: true,
  laborers: true,
  costs: true,
  pricing: true,
  settings: true,
  backup: true,
};

export const INVENTORY_ONLY_PERMISSIONS: MemberPermissions = {
  jobs: 'none',
  calendar: 'none',
  inventory: true,
  reporting: false,
  customers: false,
  referralAssociates: false,
  products: false,
  chipSystems: false,
  chipBlends: false,
  laborers: false,
  costs: false,
  pricing: false,
  settings: false,
  backup: false,
};

export function permissionsFromAccessLevel(level: OrgAccessLevel): MemberPermissions {
  return level === 'inventory_only' ? { ...INVENTORY_ONLY_PERMISSIONS } : { ...FULL_PERMISSIONS };
}

/**
 * Resolve the effective permissions for a member.
 * - Admins always get FULL_PERMISSIONS.
 * - If permissions JSONB is set, use it.
 * - Otherwise fall back to deriving from accessLevel.
 * - If no org context (personal account), grant full access.
 */
export function resolvePermissions(args: {
  hasOrg: boolean;
  role: 'admin' | 'member' | null;
  accessLevel: OrgAccessLevel | null;
  permissions: MemberPermissions | null | undefined;
}): MemberPermissions {
  if (!args.hasOrg) return FULL_PERMISSIONS;
  if (args.role === 'admin') return FULL_PERMISSIONS;
  if (args.permissions) return args.permissions;
  return permissionsFromAccessLevel(args.accessLevel ?? 'full');
}

export type AppPage =
  | 'dashboard'
  | 'new-job'
  | 'edit-job'
  | 'job-sheet'
  | 'chip-systems'
  | 'chip-blends'
  | 'laborers'
  | 'costs'
  | 'pricing'
  | 'settings'
  | 'inventory'
  | 'shopping-list'
  | 'calendar'
  | 'reporting'
  | 'customers'
  | 'referral-associates'
  | 'products'
  | 'organization'
  | 'backup';

/**
 * Decide whether navigation to a page is allowed under given permissions.
 * 'organization' is always allowed.
 */
export function isPageAllowed(page: AppPage, p: MemberPermissions): boolean {
  switch (page) {
    case 'organization':
      return true;
    case 'dashboard':
    case 'job-sheet':
      return p.jobs !== 'none';
    case 'edit-job':
    case 'new-job':
      return p.jobs === 'write';
    case 'calendar':
      return p.calendar !== 'none';
    case 'inventory':
    case 'shopping-list':
      return p.inventory;
    case 'reporting':
      return p.reporting;
    case 'customers':
      return p.customers;
    case 'referral-associates':
      return p.referralAssociates;
    case 'products':
      return p.products;
    case 'chip-systems':
      return p.chipSystems;
    case 'chip-blends':
      return p.chipBlends;
    case 'laborers':
      return p.laborers;
    case 'costs':
      return p.costs;
    case 'pricing':
      return p.pricing;
    case 'settings':
      return p.settings;
    case 'backup':
      return p.backup;
    default:
      return false;
  }
}

/**
 * Pick the best landing page for a member based on their permissions.
 * Priority: dashboard → calendar → inventory → organization (always allowed).
 */
export function pickLandingPage(p: MemberPermissions): AppPage {
  if (isPageAllowed('dashboard', p)) return 'dashboard';
  if (isPageAllowed('calendar', p)) return 'calendar';
  if (isPageAllowed('inventory', p)) return 'inventory';
  return 'organization';
}
