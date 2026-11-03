import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  formatCoatingEstimate,
  gallonsToInput,
  inputToGallons,
  resolveCoatingUnit,
} from './coatingUnits.js';

describe('coating units', () => {
  test('anything but ounces resolves to gallons, so older settings keep entering gallons', () => {
    assert.equal(resolveCoatingUnit(undefined), 'gallons');
    assert.equal(resolveCoatingUnit(null), 'gallons');
    assert.equal(resolveCoatingUnit('gallons'), 'gallons');
    assert.equal(resolveCoatingUnit('ounces'), 'ounces');
  });

  test('gallons pass through unchanged', () => {
    assert.equal(gallonsToInput(2.5, 'gallons'), '2.5');
    assert.equal(inputToGallons('2.5', 'gallons'), 2.5);
  });

  test('previously saved gallons show as ounces', () => {
    assert.equal(gallonsToInput(1, 'ounces'), '128');
    assert.equal(gallonsToInput(2.5, 'ounces'), '320');
    assert.equal(gallonsToInput(1.3, 'ounces'), '166.4');
  });

  test('ounces entered are stored as gallons', () => {
    assert.equal(inputToGallons('128', 'ounces'), 1);
    assert.equal(inputToGallons('40', 'ounces'), 0.3125);
  });

  test('ounces round-trip exactly through stored gallons', () => {
    for (const oz of ['1', '33', '40', '166.4', '250.5', '1000']) {
      const gallons = inputToGallons(oz, 'ounces')!;
      assert.equal(gallonsToInput(gallons, 'ounces'), oz);
    }
  });

  test('a gallon value loaded as ounces and saved untouched keeps its value', () => {
    for (const gal of [0.1, 1.3, 2.75, 18, 1.333]) {
      const saved = inputToGallons(gallonsToInput(gal, 'ounces'), 'ounces')!;
      assert.ok(Math.abs(saved - gal) < 1e-9, `${gal} came back as ${saved}`);
    }
  });

  test('blank, zero or invalid input stores nothing', () => {
    assert.equal(inputToGallons('', 'ounces'), undefined);
    assert.equal(inputToGallons('0', 'ounces'), undefined);
    assert.equal(inputToGallons('abc', 'gallons'), undefined);
    assert.equal(gallonsToInput(undefined, 'ounces'), '');
  });

  test('estimates read in whole ounces or tenths of a gallon', () => {
    assert.equal(formatCoatingEstimate(2.5, 'gallons'), '2.5');
    assert.equal(formatCoatingEstimate(2.5, 'ounces'), '320');
    assert.equal(formatCoatingEstimate(1.01, 'ounces'), '129');
  });
});
