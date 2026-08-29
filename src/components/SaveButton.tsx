import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Check, Loader2, Save } from 'lucide-react';

export type SaveButtonTone = 'primary' | 'subtle';

interface SaveButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** True while the save is in flight. */
  saving?: boolean;
  /** True during the post-save confirmation. Drive it with useSaveFlash. */
  saved?: boolean;
  /** Label shown when idle. */
  label: ReactNode;
  savingLabel?: string;
  savedLabel?: string;
  /** Leading icon while idle. Defaults to the Save icon; pass null for none. */
  icon?: ReactNode | null;
  iconSize?: number;
  tone?: SaveButtonTone;
}

/**
 * A save button that confirms itself: it spins while writing, then flips to a
 * green check that pops in and pulses once, so the crew never has to guess
 * whether a tap landed.
 *
 * The component owns the background and text colour for all three states —
 * callers pass only sizing, weight, rounding, and any disabled treatment, so a
 * caller-supplied `bg-*` cannot fight the saved state for precedence.
 */
export default function SaveButton({
  saving = false,
  saved = false,
  label,
  savingLabel = 'Saving...',
  savedLabel = 'Saved!',
  icon,
  iconSize = 16,
  tone = 'primary',
  className = '',
  disabled,
  ...rest
}: SaveButtonProps) {
  const state = saved ? 'saved' : saving ? 'saving' : 'idle';

  const toneClasses =
    tone === 'subtle'
      ? state === 'saved'
        ? 'bg-green-100 text-gf-dark-green animate-saved-pulse'
        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300'
      : state === 'saved'
        ? 'bg-gf-dark-green text-white animate-saved-pulse'
        : 'bg-gf-lime text-white hover:bg-gf-dark-green active:bg-gf-dark-green';

  return (
    <button
      {...rest}
      disabled={disabled || saving}
      // Blocked with pointer-events rather than `disabled` during the flash:
      // the caller's disabled treatment would dim the confirmation it exists
      // to show, and a second submit in that window is still worth stopping.
      className={`inline-flex items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed ${
        state === 'saved' ? 'pointer-events-none' : ''
      } ${toneClasses} ${className}`}
    >
      {state === 'saved' ? (
        <Check size={iconSize} className="animate-saved-pop" />
      ) : state === 'saving' ? (
        <Loader2 size={iconSize} className="animate-spin" />
      ) : icon === null ? null : (
        icon ?? <Save size={iconSize} />
      )}
      <span aria-live="polite">
        {state === 'saved' ? savedLabel : state === 'saving' ? savingLabel : label}
      </span>
    </button>
  );
}
