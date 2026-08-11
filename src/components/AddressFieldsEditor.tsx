import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, HelpCircle } from 'lucide-react';
import { townForZip } from '../lib/addressParse';
import { markAddressVerified, type AddressFieldSet } from '../lib/addressFields';

/**
 * The resolved-address chip that sits under a free-text address input.
 *
 * The single input stays the primary way in: addresses arrive pasted from GHL and
 * text messages, and four separate boxes would slow that down for the crew. So the
 * structured fields are shown as a one-line summary and only expand when someone
 * wants to correct them.
 *
 * Any edit here is a human decision, so it stamps tier 'M' and a confirmation
 * time. That is the ratchet: from then on no automated pass, backfill or webhook
 * may overwrite this address.
 */

interface Props {
  fields: AddressFieldSet;
  onChange: (fields: AddressFieldSet) => void;
  /** Shown when the parser refused to resolve, so the reason is visible in place. */
  note?: string;
  disabled?: boolean;
}

function summarize(fields: AddressFieldSet): string {
  const line = [fields.city, fields.state].filter(Boolean).join(', ');
  return [line, fields.zip].filter(Boolean).join(' ');
}

export default function AddressFieldsEditor({ fields, onChange, note, disabled }: Props) {
  const [expanded, setExpanded] = useState(false);

  const status = useMemo(() => {
    if (fields.tier === 'A!') return 'conflict' as const;
    if (fields.tier === 'M' || fields.verifiedAt) return 'confirmed' as const;
    if (fields.city && fields.state && fields.zip) return 'resolved' as const;
    if (fields.city || fields.state || fields.zip) return 'partial' as const;
    return 'none' as const;
  }, [fields]);

  // Every edit routes through here so the ratchet cannot be forgotten at a call site.
  const edit = (patch: Partial<AddressFieldSet>) => {
    onChange(markAddressVerified({ ...fields, ...patch }));
  };

  const onZipChange = (value: string) => {
    const zip = value.replace(/\D/g, '').slice(0, 5);
    const town = townForZip(zip);
    // A ZIP determines its town outright, so fill both rather than making someone
    // retype what the ZIP already says.
    edit(town ? { zip, city: town.city, state: town.state } : { zip });
  };

  const summary = summarize(fields);

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-gf-lime/50"
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        )}

        {status === 'conflict' ? (
          <>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
            <span className="truncate font-medium text-amber-800">
              {note || 'ZIP does not match the town — needs review'}
            </span>
          </>
        ) : status === 'none' ? (
          <>
            <HelpCircle className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="truncate text-slate-500">
              {note ? `Not resolved — ${note}` : 'Not resolved · add details'}
            </span>
          </>
        ) : (
          <>
            <CheckCircle2
              className={`h-3.5 w-3.5 shrink-0 ${
                status === 'partial' ? 'text-slate-400' : 'text-gf-dark-green'
              }`}
              aria-hidden="true"
            />
            <span className="truncate font-medium text-slate-700">{summary}</span>
            {status === 'confirmed' && (
              <span className="shrink-0 rounded bg-lime-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gf-dark-green">
                Confirmed
              </span>
            )}
            {status === 'partial' && <span className="shrink-0 text-slate-400">· incomplete</span>}
          </>
        )}
      </button>

      {expanded && (
        <div className="mt-2 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-6">
          <label className="block sm:col-span-4">
            <span className="text-xs font-medium text-slate-600">Street</span>
            <input
              type="text"
              value={fields.street ?? ''}
              onChange={(event) => edit({ street: event.target.value || undefined })}
              disabled={disabled}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-gf-dark-green focus:outline-none focus:ring-2 focus:ring-gf-lime/50"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Unit / Apt</span>
            <input
              type="text"
              value={fields.street2 ?? ''}
              onChange={(event) => edit({ street2: event.target.value || undefined })}
              disabled={disabled}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-gf-dark-green focus:outline-none focus:ring-2 focus:ring-gf-lime/50"
            />
          </label>
          <label className="block sm:col-span-3">
            <span className="text-xs font-medium text-slate-600">City / town</span>
            <input
              type="text"
              value={fields.city ?? ''}
              onChange={(event) => edit({ city: event.target.value || undefined })}
              disabled={disabled}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-gf-dark-green focus:outline-none focus:ring-2 focus:ring-gf-lime/50"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">State</span>
            <input
              type="text"
              value={fields.state ?? ''}
              onChange={(event) =>
                edit({ state: event.target.value.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || undefined })
              }
              disabled={disabled}
              maxLength={2}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm uppercase focus:border-gf-dark-green focus:outline-none focus:ring-2 focus:ring-gf-lime/50"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">ZIP</span>
            <input
              type="text"
              inputMode="numeric"
              value={fields.zip ?? ''}
              onChange={(event) => onZipChange(event.target.value)}
              disabled={disabled}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-gf-dark-green focus:outline-none focus:ring-2 focus:ring-gf-lime/50"
            />
          </label>
          <p className="text-xs text-slate-500 sm:col-span-6">
            Entering a ZIP fills its town automatically. Editing anything here marks the address
            confirmed, so later automatic passes leave it alone.
          </p>
        </div>
      )}
    </div>
  );
}
