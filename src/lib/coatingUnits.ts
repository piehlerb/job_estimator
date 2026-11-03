/**
 * Units for entering actual coating usage on a job: base coat, top coat,
 * Cyclo1 and MVB (moisture mitigation).
 *
 * Jobs always store these actuals in gallons; the unit setting only changes
 * what the crew types and sees in the Actuals tab. Converting at the form's
 * edges keeps every job saved before the setting existed correct, and keeps
 * inventory, cost and spread rate math unit-free.
 */
export type CoatingUnit = 'gallons' | 'ounces';

export const OZ_PER_GALLON = 128;

export function resolveCoatingUnit(unit: unknown): CoatingUnit {
  return unit === 'ounces' ? 'ounces' : 'gallons';
}

export function coatingUnitLabel(unit: CoatingUnit): string {
  return unit === 'ounces' ? 'oz' : 'gal';
}

/**
 * Step for the number inputs. Ounces take any value: a gallon amount recorded
 * before switching (1.3 gal = 166.4 oz) would otherwise fail the browser's
 * step check and block saving the job.
 */
export function coatingUnitStep(unit: CoatingUnit): string {
  return unit === 'ounces' ? 'any' : '0.1';
}

export function gallonsToUnit(gallons: number, unit: CoatingUnit): number {
  return unit === 'ounces' ? gallons * OZ_PER_GALLON : gallons;
}

export function unitToGallons(amount: number, unit: CoatingUnit): number {
  return unit === 'ounces' ? amount / OZ_PER_GALLON : amount;
}

/**
 * A stored gallon amount as text for an input in `unit`. Rounds to 3 decimal
 * places so 1.3 gal shows as "166.4" rather than float noise; dividing by 128
 * is exact in binary, so whole or tenth ounces round-trip without drift.
 */
export function gallonsToInput(gallons: number | null | undefined, unit: CoatingUnit): string {
  if (gallons == null || !Number.isFinite(gallons)) return '';
  const amount = Math.round(gallonsToUnit(gallons, unit) * 1000) / 1000;
  return String(amount);
}

/** Input text in `unit` as gallons; undefined when blank, invalid or not positive. */
export function inputToGallons(text: string, unit: CoatingUnit): number | undefined {
  const amount = parseFloat(text);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  return unitToGallons(amount, unit);
}

/** An estimated gallon amount for an "est." hint or placeholder. */
export function formatCoatingEstimate(gallons: number, unit: CoatingUnit): string {
  return unit === 'ounces' ? Math.round(gallons * OZ_PER_GALLON).toString() : gallons.toFixed(1);
}
