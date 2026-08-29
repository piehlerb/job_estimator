import { useCallback, useEffect, useRef, useState } from 'react';

/** How long the confirmation stays up when the button survives the save. */
export const SAVE_FLASH_MS = 1600;

/**
 * How long a save that tears its own button down holds the confirmation before
 * the teardown runs. Short enough not to feel like a stall, long enough for the
 * check mark's pop animation to finish.
 */
export const SAVE_FLASH_HOLD_MS = 750;

/**
 * Drives the "Saved!" state on a SaveButton.
 *
 * Call `flashSaved()` after a save succeeds. If the save also closes a modal or
 * leaves the page, pass that teardown as `flashSaved(() => setShowForm(false))`
 * — it runs after the confirmation has been on screen long enough to see, and
 * the flash is cleared with it so a reopened form does not start on a stale
 * check mark.
 */
export function useSaveFlash() {
  const [saved, setSaved] = useState(false);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  useEffect(() => clearTimers, []);

  const flashSaved = useCallback((then?: () => void) => {
    clearTimers();
    setSaved(true);
    timers.current.push(
      window.setTimeout(
        () => {
          setSaved(false);
          then?.();
        },
        then ? SAVE_FLASH_HOLD_MS : SAVE_FLASH_MS
      )
    );
  }, []);

  return { saved, flashSaved };
}
