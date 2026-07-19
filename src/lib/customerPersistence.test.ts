import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { Customer } from '../types/index.js';
import { ensureCustomerPersistence } from './customerPersistence.js';

const NOW = '2026-07-13T12:00:00.000Z';

function createDependencies(customers: Customer[] = []) {
  const addedCustomers: Customer[] = [];

  return {
    addedCustomers,
    dependencies: {
      getAllCustomers: async () => customers,
      addCustomer: async (customer: Customer) => {
        addedCustomers.push(customer);
      },
      generateId: () => 'customer-new',
      now: () => NOW,
    },
  };
}

describe('ensureCustomerPersistence', () => {
  test('adds and returns a new customer with trimmed name and address', async () => {
    const { addedCustomers, dependencies } = createDependencies();

    const customer = await ensureCustomerPersistence(
      { name: '  Jane Customer  ', address: '  12 Main Street  ' },
      dependencies
    );

    assert.deepEqual(customer, {
      id: 'customer-new',
      name: 'Jane Customer',
      address: '12 Main Street',
      createdAt: NOW,
      updatedAt: NOW,
    });
    assert.deepEqual(addedCustomers, [customer]);
  });

  test('returns a case and whitespace equivalent active customer without adding a duplicate', async () => {
    const existingCustomer: Customer = {
      id: 'customer-existing',
      name: ' Jane Customer ',
      address: 'Original address',
      phone: '555-0100',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-02T00:00:00.000Z',
    };
    const { addedCustomers, dependencies } = createDependencies([existingCustomer]);

    const customer = await ensureCustomerPersistence(
      { name: 'jANE cUSTOMER', address: 'Different address' },
      dependencies
    );

    assert.equal(customer, existingCustomer);
    assert.deepEqual(addedCustomers, []);
  });

  test('does not add a customer for a blank name', async () => {
    const { addedCustomers, dependencies } = createDependencies();

    const customer = await ensureCustomerPersistence(
      { name: '   ', address: '12 Main Street' },
      dependencies
    );

    assert.equal(customer, undefined);
    assert.deepEqual(addedCustomers, []);
  });
});
