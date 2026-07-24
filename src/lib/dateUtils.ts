/**
 * Date helpers that operate in the device's local timezone.
 *
 * Date-only fields in this app (estimateDate, installDate, reminder dueDate,
 * follow-up date, report ranges) represent calendar days in the user's local
 * timezone (Eastern for this business). Never derive them via toISOString(),
 * which returns the UTC date and is off by one day after ~7-8 PM Eastern.
 */

/** Format a Date as YYYY-MM-DD using the local calendar day. */
export function toLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today's date as YYYY-MM-DD in the local timezone. */
export function localToday(): string {
  return toLocalDateString();
}

/** Local calendar day (YYYY-MM-DD) of an ISO timestamp string. */
export function timestampToLocalDateString(isoTimestamp: string): string {
  return toLocalDateString(new Date(isoTimestamp));
}
