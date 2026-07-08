import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  BASE_A_FRACTION,
  TINT_OZ_PER_GAL,
  TOP_A_FRACTION,
  defaultBaseComponents,
  resolveJobMaterials,
  sharesValid,
  type MaterialAllocationInput,
} from './materialAllocation.js';

const baseInput: MaterialAllocationInput = {
  baseGallons: 18,
  topGallons: 12,
  baseColor: 'Grey',
};

function gallonsByKey(input: MaterialAllocationInput): Record<string, number> {
  const result = resolveJobMaterials(input);
  return Object.fromEntries(result.coating.map((line) => [line.key, line.gallons]));
}

describe('resolveJobMaterials', () => {
  test('plain Grey job matches legacy hard-coded split exactly', () => {
    const result = resolveJobMaterials(baseInput);
    const byKey = Object.fromEntries(result.coating.map((line) => [line.key, line.gallons]));

    // Legacy: baseA = 18 / 3 = 6, baseBGrey = 18 * 2 / 3 = 12, topA = topB = 12 * 0.5 = 6
    assert.equal(byKey['coating:baseA::'], 18 / 3);
    assert.equal(byKey['coating:baseB:Normal:Grey'], (18 * 2) / 3);
    assert.equal(byKey['coating:topA:Original:'], 6);
    assert.equal(byKey['coating:topB:Original:'], 6);
    assert.equal(result.coating.length, 4);
    assert.deepEqual(result.tint, []);
    assert.deepEqual(result.warnings, []);
  });

  test('legacy base tint mode emits a single job-level tint line', () => {
    const result = resolveJobMaterials({
      ...baseInput,
      includeBasecoatTint: true,
      tintColor: 'Slate Gray',
    });

    assert.equal(result.tint.length, 1);
    assert.equal(result.tint[0].key, 'tint:Slate Gray');
    assert.equal(result.tint[0].oz, 18 * TINT_OZ_PER_GAL);
    assert.equal(result.tint[0].label, 'Slate Gray Tint');
  });

  test('top tint adds topGallons × 12.8 oz', () => {
    const result = resolveJobMaterials({
      ...baseInput,
      includeTopcoatTint: true,
      includeBasecoatTint: true,
      tintColor: 'Slate Gray',
    });

    assert.equal(result.tint.length, 1);
    assert.equal(result.tint[0].oz, 12 * TINT_OZ_PER_GAL + 18 * TINT_OZ_PER_GAL);
  });

  test('Mocha default splits Base B 50/50 Grey/Tan (Normal)', () => {
    const byKey = gallonsByKey({ ...baseInput, baseColor: 'Mocha' });

    assert.equal(byKey['coating:baseA::'], 6);
    assert.equal(byKey['coating:baseB:Normal:Grey'], 6);
    assert.equal(byKey['coating:baseB:Normal:Tan'], 6);
  });

  test('all-Clear Mocha override emits merged Clear line and two tint lines', () => {
    const result = resolveJobMaterials({
      ...baseInput,
      baseColor: 'Mocha',
      override: {
        base: [
          { variant: 'Normal', color: 'Clear', share: 0.5, tintColor: 'Grey' },
          { variant: 'Normal', color: 'Clear', share: 0.5, tintColor: 'Tan' },
        ],
      },
    });
    const byKey = Object.fromEntries(result.coating.map((line) => [line.key, line.gallons]));

    // Both Clear components merge into one SKU line: 18 × 2/3 gallons total
    assert.equal(byKey['coating:baseB:Normal:Clear'], 18 - 18 * BASE_A_FRACTION);
    assert.equal(byKey['coating:baseA::'], 6);

    // Two tint lines, each baseGallons × share × 12.8 = 18 × 0.5 × 12.8
    const tintByKey = Object.fromEntries(result.tint.map((line) => [line.key, line.oz]));
    assert.equal(tintByKey['tint:Grey'], 18 * 0.5 * TINT_OZ_PER_GAL);
    assert.equal(tintByKey['tint:Tan'], 18 * 0.5 * TINT_OZ_PER_GAL);
    assert.deepEqual(result.warnings, []);
  });

  test('per-component tint mode ignores legacy includeBasecoatTint line', () => {
    const result = resolveJobMaterials({
      ...baseInput,
      includeBasecoatTint: true,
      tintColor: 'Slate Gray',
      override: {
        base: [
          { variant: 'Normal', color: 'Grey', share: 0.5 },
          { variant: 'Normal', color: 'Clear', share: 0.5, tintColor: 'Tan' },
        ],
      },
    });

    // Only the Clear component's tint is counted; no job-level Slate Gray line
    assert.equal(result.tint.length, 1);
    assert.equal(result.tint[0].key, 'tint:Tan');
    assert.equal(result.tint[0].oz, 18 * 0.5 * TINT_OZ_PER_GAL);
  });

  test('mixed topcoat 60/40 Original/Slow Cure pulls matching A+B pairs', () => {
    const byKey = gallonsByKey({
      ...baseInput,
      override: {
        top: [
          { variant: 'Original', share: 0.6 },
          { variant: 'Slow Cure', share: 0.4 },
        ],
      },
    });

    assert.equal(byKey['coating:topA:Original:'], 12 * TOP_A_FRACTION * 0.6);
    assert.equal(byKey['coating:topB:Original:'], 12 * (1 - TOP_A_FRACTION) * 0.6);
    assert.equal(byKey['coating:topA:Slow Cure:'], 12 * TOP_A_FRACTION * 0.4);
    assert.equal(byKey['coating:topB:Slow Cure:'], 12 * (1 - TOP_A_FRACTION) * 0.4);
  });

  test('unknown base color emits Base A only with a warning', () => {
    const result = resolveJobMaterials({ ...baseInput, baseColor: 'Purple' });
    const byKey = Object.fromEntries(result.coating.map((line) => [line.key, line.gallons]));

    assert.equal(byKey['coating:baseA::'], 6);
    assert.equal(result.coating.filter((line) => line.part === 'baseB').length, 0);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /No Base B allocation for base color "Purple"/);
  });

  test('invalid override shares warn and normalize proportionally', () => {
    const result = resolveJobMaterials({
      ...baseInput,
      override: {
        top: [
          { variant: 'Original', share: 0.6 },
          { variant: 'Slow Cure', share: 0.6 },
        ],
      },
    });
    const byKey = Object.fromEntries(result.coating.map((line) => [line.key, line.gallons]));

    assert.deepEqual(result.warnings, ['Topcoat allocation shares do not sum to 100%.']);
    // Normalized to 0.5 / 0.5
    assert.equal(byKey['coating:topA:Original:'], 12 * TOP_A_FRACTION * 0.5);
    assert.equal(byKey['coating:topA:Slow Cure:'], 12 * TOP_A_FRACTION * 0.5);
  });

  test('zero-total override shares fall back to defaults', () => {
    const result = resolveJobMaterials({
      ...baseInput,
      override: { top: [{ variant: 'Slow Cure', share: 0 }] },
    });
    const byKey = Object.fromEntries(result.coating.map((line) => [line.key, line.gallons]));

    assert.equal(result.warnings.length, 1);
    assert.equal(byKey['coating:topA:Original:'], 6);
    assert.equal(byKey['coating:topB:Original:'], 6);
    assert.equal(byKey['coating:topA:Slow Cure:'], undefined);
  });

  test('zero gallons produce no lines', () => {
    const result = resolveJobMaterials({
      baseGallons: 0,
      topGallons: 0,
      baseColor: 'Grey',
      includeBasecoatTint: true,
      includeTopcoatTint: true,
      tintColor: 'Slate Gray',
    });

    assert.deepEqual(result.coating, []);
    assert.deepEqual(result.tint, []);
    assert.deepEqual(result.warnings, []);
  });
});

describe('defaultBaseComponents', () => {
  test('known colors map to Normal-variant components', () => {
    assert.deepEqual(defaultBaseComponents('Grey'), [{ variant: 'Normal', color: 'Grey', share: 1 }]);
    assert.deepEqual(defaultBaseComponents('Tan'), [{ variant: 'Normal', color: 'Tan', share: 1 }]);
    assert.deepEqual(defaultBaseComponents('Clear'), [{ variant: 'Normal', color: 'Clear', share: 1 }]);
    assert.deepEqual(defaultBaseComponents('Mocha'), [
      { variant: 'Normal', color: 'Grey', share: 0.5 },
      { variant: 'Normal', color: 'Tan', share: 0.5 },
    ]);
  });

  test('unknown or missing colors return null', () => {
    assert.equal(defaultBaseComponents('Purple'), null);
    assert.equal(defaultBaseComponents(undefined), null);
    assert.equal(defaultBaseComponents('grey'), null); // case-sensitive by design
  });
});

describe('sharesValid', () => {
  test('accepts shares summing to 1 within tolerance', () => {
    assert.equal(sharesValid([{ share: 0.5 }, { share: 0.5 }]), true);
    assert.equal(sharesValid([{ share: 0.3334 }, { share: 0.3333 }, { share: 0.3333 }]), true);
  });

  test('rejects empty, non-positive, or off-total shares', () => {
    assert.equal(sharesValid([]), false);
    assert.equal(sharesValid([{ share: 0.6 }, { share: 0.6 }]), false);
    assert.equal(sharesValid([{ share: 1 }, { share: 0 }]), false);
    assert.equal(sharesValid([{ share: 1.5 }, { share: -0.5 }]), false);
  });
});
