import type { ReactNode } from 'react';
import type { AreaAccess, MemberPermissions } from '../types';
import { FULL_PERMISSIONS, INVENTORY_ONLY_PERMISSIONS, NO_PERMISSIONS, type PermissionArea } from '../lib/permissions';

// Areas that take Hidden / View / Edit, with a hint for what each covers
const AREA_ROWS: { key: Exclude<PermissionArea, 'calendar'>; label: string; hint?: string }[] = [
  { key: 'jobs', label: 'Jobs', hint: 'Dashboard, job sheets and the job form' },
  { key: 'leads', label: 'Leads' },
  { key: 'customers', label: 'Customers' },
  { key: 'inventory', label: 'Inventory & Shopping' },
  { key: 'reporting', label: 'Reporting', hint: 'Edit = enter ad spend' },
  { key: 'referralAssociates', label: 'Referral Associates' },
  { key: 'products', label: 'Products' },
  { key: 'chipSystems', label: 'Chip Systems' },
  { key: 'chipBlends', label: 'Chip Blends' },
  { key: 'laborers', label: 'Laborers' },
  { key: 'costs', label: 'Costs' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'settings', label: 'Settings' },
  { key: 'backup', label: 'Backup', hint: 'View = export, Edit = restore' },
];

const LEVELS: { value: AreaAccess; label: string }[] = [
  { value: 'none', label: 'Hidden' },
  { value: 'read', label: 'View' },
  { value: 'write', label: 'Edit' },
];

const CALENDAR_LEVELS: { value: MemberPermissions['calendar']; label: string }[] = [
  { value: 'none', label: 'Hidden' },
  { value: 'install', label: 'Installs' },
  { value: 'full', label: 'Full' },
];

function Segmented<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${name}: ${option.label}`}
            onClick={() => onChange(option.value)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              selected
                ? option.value === 'none'
                  ? 'bg-white text-slate-700 shadow-sm'
                  : option.value === 'write' || option.value === 'full'
                    ? 'bg-gf-lime text-white shadow-sm'
                    : 'bg-green-100 text-green-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Hidden / View / Edit per area of the app. View shows a page without any way
 * to change it; Hidden removes it from the menu, and the database stops
 * returning its data too.
 */
export default function PermissionsEditor({
  value,
  onChange,
}: {
  value: MemberPermissions;
  onChange: (next: MemberPermissions) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <span className="self-center text-xs text-slate-500">Presets:</span>
        {([
          ['Full access', FULL_PERMISSIONS],
          ['Inventory only', INVENTORY_ONLY_PERMISSIONS],
          ['Nothing', NO_PERMISSIONS],
        ] as const).map(([label, preset]) => (
          <button
            key={label}
            type="button"
            onClick={() => onChange({ ...preset })}
            className="px-3 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {AREA_ROWS.slice(0, 1).map(({ key, label, hint }) => (
          <AreaRow key={key} label={label} hint={hint}>
            <Segmented name={label} value={value[key]} options={LEVELS} onChange={(level) => onChange({ ...value, [key]: level })} />
          </AreaRow>
        ))}
        <AreaRow label="Calendar" hint="Installs = won jobs only">
          <Segmented
            name="Calendar"
            value={value.calendar}
            options={CALENDAR_LEVELS}
            onChange={(level) => onChange({ ...value, calendar: level })}
          />
        </AreaRow>
        {AREA_ROWS.slice(1).map(({ key, label, hint }) => (
          <AreaRow key={key} label={label} hint={hint}>
            <Segmented name={label} value={value[key]} options={LEVELS} onChange={(level) => onChange({ ...value, [key]: level })} />
          </AreaRow>
        ))}
      </div>
    </div>
  );
}

function AreaRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <div className="min-w-0">
        <div className="text-sm text-slate-700">{label}</div>
        {hint && <div className="text-[11px] text-slate-400">{hint}</div>}
      </div>
      {children}
    </div>
  );
}
