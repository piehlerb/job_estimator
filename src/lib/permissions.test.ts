import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  FULL_PERMISSIONS,
  NO_PERMISSIONS,
  STORE_READ_AREAS,
  areaAccess,
  canRead,
  canWrite,
  isPageAllowed,
  normalizePermissions,
  pickLandingPage,
  resolvePermissions,
  unreadableStores,
} from './permissions.js';

// Shape stored for members before per-area levels existed
const LEGACY_INVENTORY_MEMBER = {
  jobs: 'read',
  costs: false,
  backup: false,
  pricing: false,
  calendar: 'install',
  laborers: false,
  products: false,
  settings: false,
  customers: false,
  inventory: true,
  reporting: false,
  chipBlends: false,
  chipSystems: false,
  referralAssociates: true,
};

describe('normalizePermissions', () => {
  test('reads legacy booleans as write / none and keeps jobs and calendar levels', () => {
    const p = normalizePermissions(LEGACY_INVENTORY_MEMBER)!;
    assert.equal(p.inventory, 'write');
    assert.equal(p.referralAssociates, 'write');
    assert.equal(p.costs, 'none');
    assert.equal(p.jobs, 'read');
    assert.equal(p.calendar, 'install');
  });

  test('legacy leads follow the higher of customers and reporting', () => {
    assert.equal(normalizePermissions({ customers: false, reporting: false })!.leads, 'none');
    assert.equal(normalizePermissions({ customers: true, reporting: false })!.leads, 'write');
    assert.equal(normalizePermissions({ customers: 'read', reporting: false })!.leads, 'read');
  });

  test('an explicit leads level wins over customers / reporting', () => {
    assert.equal(normalizePermissions({ customers: 'write', leads: 'none' })!.leads, 'none');
  });

  test('missing or unknown values are hidden; nothing stored is null', () => {
    const p = normalizePermissions({ inventory: 'admin' })!;
    assert.equal(p.inventory, 'none');
    assert.equal(p.products, 'none');
    assert.equal(p.calendar, 'none');
    assert.equal(normalizePermissions(null), null);
  });

  test('round-trips the current shape unchanged', () => {
    assert.deepEqual(normalizePermissions(FULL_PERMISSIONS), FULL_PERMISSIONS);
    assert.deepEqual(normalizePermissions(NO_PERMISSIONS), NO_PERMISSIONS);
  });
});

describe('area access', () => {
  test('calendar full counts as write and install as read', () => {
    assert.equal(areaAccess({ ...NO_PERMISSIONS, calendar: 'full' }, 'calendar'), 'write');
    assert.equal(areaAccess({ ...NO_PERMISSIONS, calendar: 'install' }, 'calendar'), 'read');
  });

  test('view level can read but not write', () => {
    const p = { ...NO_PERMISSIONS, customers: 'read' as const };
    assert.equal(canRead(p, 'customers'), true);
    assert.equal(canWrite(p, 'customers'), false);
    assert.equal(canRead(p, 'inventory'), false);
  });

  test('admins always resolve to full access', () => {
    const p = resolvePermissions({ hasOrg: true, role: 'admin', accessLevel: 'full', permissions: NO_PERMISSIONS });
    assert.deepEqual(p, FULL_PERMISSIONS);
  });
});

describe('pages', () => {
  test('view-level areas show their page; editing jobs needs write', () => {
    const p = { ...NO_PERMISSIONS, leads: 'read' as const, jobs: 'read' as const };
    assert.equal(isPageAllowed('leads', p), true);
    assert.equal(isPageAllowed('dashboard', p), true);
    assert.equal(isPageAllowed('edit-job', p), false);
    assert.equal(isPageAllowed('customers', p), false);
  });

  test('landing page is the first visible page, else organization', () => {
    assert.equal(pickLandingPage({ ...NO_PERMISSIONS, leads: 'read' }), 'leads');
    assert.equal(pickLandingPage({ ...NO_PERMISSIONS, jobs: 'read', leads: 'write' }), 'dashboard');
    assert.equal(pickLandingPage(NO_PERMISSIONS), 'organization');
  });
});

describe('unreadableStores', () => {
  test('full access can read every store', () => {
    assert.deepEqual(unreadableStores(FULL_PERMISSIONS), []);
  });

  test('nothing visible means every org store is unreadable', () => {
    assert.deepEqual(unreadableStores(NO_PERMISSIONS).sort(), Object.keys(STORE_READ_AREAS).sort());
  });

  test('leads-only member keeps leads, appointments and jobs, nothing else', () => {
    const readable = Object.keys(STORE_READ_AREAS).filter(
      (store) => !unreadableStores({ ...NO_PERMISSIONS, leads: 'write' }).includes(store)
    );
    assert.deepEqual(readable.sort(), ['jobs', 'leadAppointments', 'leads']);
  });

  test('legacy inventory member keeps what inventory and job viewing need, not customers-only data', () => {
    const p = normalizePermissions(LEGACY_INVENTORY_MEMBER)!;
    const hidden = unreadableStores(p);
    assert.ok(hidden.includes('adSpend'));
    assert.ok(!hidden.includes('chipInventory'));
    assert.ok(!hidden.includes('costs'));
    assert.ok(!hidden.includes('referralAssociates'));
  });
});
