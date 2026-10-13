import type { AreaAccess, MemberPermissions, OrgAccessLevel } from '../types/index.js';

/** Every permission area, in the order the permission editor lists them */
export const PERMISSION_AREAS = [
  'jobs',
  'calendar',
  'leads',
  'customers',
  'inventory',
  'reporting',
  'referralAssociates',
  'products',
  'chipSystems',
  'chipBlends',
  'laborers',
  'costs',
  'pricing',
  'settings',
  'backup',
] as const satisfies readonly (keyof MemberPermissions)[];

export type PermissionArea = (typeof PERMISSION_AREAS)[number];

export const FULL_PERMISSIONS: MemberPermissions = {
  jobs: 'write',
  calendar: 'full',
  leads: 'write',
  inventory: 'write',
  reporting: 'write',
  customers: 'write',
  referralAssociates: 'write',
  products: 'write',
  chipSystems: 'write',
  chipBlends: 'write',
  laborers: 'write',
  costs: 'write',
  pricing: 'write',
  settings: 'write',
  backup: 'write',
};

export const INVENTORY_ONLY_PERMISSIONS: MemberPermissions = {
  jobs: 'none',
  calendar: 'none',
  leads: 'none',
  inventory: 'write',
  reporting: 'none',
  customers: 'none',
  referralAssociates: 'none',
  products: 'none',
  chipSystems: 'none',
  chipBlends: 'none',
  laborers: 'none',
  costs: 'none',
  pricing: 'none',
  settings: 'none',
  backup: 'none',
};

/** Nothing visible: the starting point for an agent, so access is opted into area by area */
export const NO_PERMISSIONS: MemberPermissions = {
  ...INVENTORY_ONLY_PERMISSIONS,
  inventory: 'none',
};

export function permissionsFromAccessLevel(level: OrgAccessLevel): MemberPermissions {
  return level === 'inventory_only' ? { ...INVENTORY_ONLY_PERMISSIONS } : { ...FULL_PERMISSIONS };
}

const ACCESS_RANK: Record<AreaAccess, number> = { none: 0, read: 1, write: 2 };

function toAccess(value: unknown): AreaAccess {
  if (value === true || value === 'write' || value === 'full') return 'write';
  if (value === 'read' || value === 'install') return 'read';
  return 'none';
}

function higherAccess(a: AreaAccess, b: AreaAccess): AreaAccess {
  return ACCESS_RANK[a] >= ACCESS_RANK[b] ? a : b;
}

/**
 * Read stored permissions JSON in either shape: current ('none' | 'read' |
 * 'write' per area) or legacy (booleans, true = write; no `leads` key, where
 * leads followed customers/reporting). Mirrors member_area_rank() in the
 * database. Returns null when nothing is stored.
 */
export function normalizePermissions(raw: unknown): MemberPermissions | null {
  if (!raw || typeof raw !== 'object') return null;
  const stored = raw as Record<string, unknown>;
  const calendar = stored.calendar === 'full' || stored.calendar === 'install' ? stored.calendar : 'none';
  const result = { calendar } as MemberPermissions;
  for (const area of PERMISSION_AREAS) {
    if (area === 'calendar' || area === 'leads') continue;
    result[area] = toAccess(stored[area]);
  }
  result.leads = 'leads' in stored
    ? toAccess(stored.leads)
    : higherAccess(result.customers, result.reporting);
  return result;
}

/** A member's access to one area. Calendar 'full' counts as write, 'install' as read. */
export function areaAccess(p: MemberPermissions, area: PermissionArea): AreaAccess {
  return toAccess(p[area]);
}

export function canRead(p: MemberPermissions, area: PermissionArea): boolean {
  return areaAccess(p, area) !== 'none';
}

export function canWrite(p: MemberPermissions, area: PermissionArea): boolean {
  return areaAccess(p, area) === 'write';
}

/**
 * Which areas' screens load each local store. A store is readable when any of
 * its areas is. Keep in sync with the read map in
 * supabase/migrations/*_area_permission_levels.sql.
 */
export const STORE_READ_AREAS: Record<string, readonly PermissionArea[]> = {
  adSpend: ['reporting'],
  baseCoatColors: ['jobs', 'chipBlends', 'settings'],
  baseCoatInventory: ['inventory', 'jobs'],
  chipBlends: ['jobs', 'inventory', 'chipBlends'],
  chipInventory: ['inventory', 'jobs'],
  coatingInventory: ['inventory', 'jobs'],
  costs: ['jobs', 'inventory', 'reporting', 'costs'],
  customers: ['jobs', 'customers'],
  jobs: ['jobs', 'calendar', 'inventory', 'reporting', 'leads', 'customers'],
  laborers: ['jobs', 'reporting', 'laborers'],
  leadAppointments: ['leads', 'reporting'],
  leads: ['leads', 'reporting', 'jobs'],
  miscInventory: ['inventory', 'jobs'],
  pricing: ['jobs', 'inventory', 'reporting', 'pricing', 'settings'],
  pricingVariables: ['jobs', 'pricing'],
  products: ['jobs', 'products'],
  referralAssociates: ['referralAssociates'],
  referralServices: ['referralAssociates'],
  shoppingItems: ['inventory'],
  systems: ['jobs', 'inventory', 'chipSystems', 'chipBlends'],
  tintInventory: ['inventory', 'jobs'],
  topCoatInventory: ['inventory', 'jobs'],
};

/** Local stores this member may not read (their cached copies should be dropped) */
export function unreadableStores(p: MemberPermissions): string[] {
  return Object.entries(STORE_READ_AREAS)
    .filter(([, areas]) => !areas.some((area) => canRead(p, area)))
    .map(([store]) => store);
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
  | 'leads'
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
      return canRead(p, 'jobs');
    case 'edit-job':
    case 'new-job':
      return canWrite(p, 'jobs');
    case 'calendar':
      return canRead(p, 'calendar');
    case 'inventory':
    case 'shopping-list':
      return canRead(p, 'inventory');
    case 'reporting':
      return canRead(p, 'reporting');
    case 'leads':
      return canRead(p, 'leads');
    case 'customers':
      return canRead(p, 'customers');
    case 'referral-associates':
      return canRead(p, 'referralAssociates');
    case 'products':
      return canRead(p, 'products');
    case 'chip-systems':
      return canRead(p, 'chipSystems');
    case 'chip-blends':
      return canRead(p, 'chipBlends');
    case 'laborers':
      return canRead(p, 'laborers');
    case 'costs':
      return canRead(p, 'costs');
    case 'pricing':
      return canRead(p, 'pricing');
    case 'settings':
      return canRead(p, 'settings');
    case 'backup':
      return canRead(p, 'backup');
    default:
      return false;
  }
}

/**
 * Pick the best landing page for a member based on their permissions: the
 * first allowed page in LANDING_PAGE_ORDER, else organization (always allowed).
 */
const LANDING_PAGE_ORDER: AppPage[] = [
  'dashboard', 'calendar', 'leads', 'customers', 'inventory', 'reporting', 'referral-associates',
  'products', 'chip-systems', 'chip-blends', 'laborers', 'costs', 'pricing', 'settings', 'backup',
];

export function pickLandingPage(p: MemberPermissions): AppPage {
  return LANDING_PAGE_ORDER.find((page) => isPageAllowed(page, p)) ?? 'organization';
}
