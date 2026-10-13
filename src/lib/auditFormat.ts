/**
 * Display helpers for audit log entries (public.audit_log). Column names arrive
 * in snake_case straight from the database.
 */
import type { AuditLogEntry } from '../types/index.js';

/** Table → name shown in the Activity log, grouped into the app's areas */
export const AUDIT_TABLES: { area: string; tables: { name: string; label: string }[] }[] = [
  { area: 'Jobs', tables: [{ name: 'jobs', label: 'Job' }] },
  {
    area: 'Leads',
    tables: [
      { name: 'leads', label: 'Lead' },
      { name: 'lead_appointments', label: 'Lead appointment' },
    ],
  },
  { area: 'Customers', tables: [{ name: 'customers', label: 'Customer' }] },
  {
    area: 'Inventory',
    tables: [
      { name: 'chip_inventory', label: 'Chip inventory' },
      { name: 'coating_inventory', label: 'Coating inventory' },
      { name: 'tint_inventory', label: 'Tint inventory' },
      { name: 'misc_inventory', label: 'Misc inventory' },
      { name: 'topcoat_inventory', label: 'Top coat inventory' },
      { name: 'basecoat_inventory', label: 'Base coat inventory' },
      { name: 'shopping_items', label: 'Shopping list item' },
    ],
  },
  { area: 'Reporting', tables: [{ name: 'ad_spend', label: 'Ad spend' }] },
  {
    area: 'Referral Associates',
    tables: [
      { name: 'referral_associates', label: 'Referral associate' },
      { name: 'referral_services', label: 'Referral service' },
    ],
  },
  { area: 'Products', tables: [{ name: 'products', label: 'Product' }] },
  { area: 'Chip Systems', tables: [{ name: 'systems', label: 'Chip system' }] },
  { area: 'Chip Blends', tables: [{ name: 'chip_blends', label: 'Chip blend' }] },
  { area: 'Laborers', tables: [{ name: 'laborers', label: 'Laborer' }] },
  { area: 'Costs', tables: [{ name: 'costs', label: 'Costs' }] },
  {
    area: 'Pricing',
    tables: [
      { name: 'pricing', label: 'Pricing' },
      { name: 'pricing_variables', label: 'Pricing variable' },
    ],
  },
  { area: 'Settings', tables: [{ name: 'base_coat_colors', label: 'Base coat color' }] },
  {
    area: 'Organization',
    tables: [
      { name: 'organization_members', label: 'Member' },
      { name: 'organization_invitations', label: 'Invite' },
    ],
  },
];

const TABLE_LABELS = new Map(AUDIT_TABLES.flatMap((group) => group.tables.map((t) => [t.name, t.label] as const)));

export function tableLabel(tableName: string): string {
  return TABLE_LABELS.get(tableName) ?? fieldLabel(tableName);
}

const ACTION_VERBS: Record<AuditLogEntry['action'], string> = {
  insert: 'created',
  update: 'updated',
  delete: 'deleted',
  restore: 'restored',
};

export function actionVerb(action: AuditLogEntry['action']): string {
  return ACTION_VERBS[action] ?? action;
}

/** customer_name → "Customer name" */
export function fieldLabel(column: string): string {
  const words = column.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Identifier and scoping columns that say nothing useful on their own */
const HIDDEN_FIELDS = new Set(['id', 'org_id', 'user_id']);

export interface FieldChange {
  field: string;
  label: string;
  old?: unknown;
  new?: unknown;
}

/** The changed fields of an entry, in a stable order, without bookkeeping ids */
export function changedFields(entry: Pick<AuditLogEntry, 'changes'>): FieldChange[] {
  return Object.entries(entry.changes ?? {})
    .filter(([field]) => !HIDDEN_FIELDS.has(field))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([field, change]) => ({ field, label: fieldLabel(field), old: change?.old, new: change?.new }));
}

/** A value as short readable text: "—" for empty, Yes/No, or compact JSON */
export function formatValue(value: unknown, maxLength = 160): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const text = typeof value === 'string' || typeof value === 'number' ? String(value) : JSON.stringify(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

/** Who made the change: the member's email, or "System" for the GHL webhook */
export function actorName(entry: Pick<AuditLogEntry, 'userId' | 'actorEmail'>): string {
  if (!entry.userId) return 'System (GoHighLevel)';
  return entry.actorEmail || 'Unknown user';
}
