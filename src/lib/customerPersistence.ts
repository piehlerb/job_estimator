import type { Customer } from '../types/index.js';
import { withCustomerAddressFields } from './addressFields.js';

export interface CustomerPersistenceDependencies {
  getAllCustomers: () => Promise<Customer[]>;
  addCustomer: (customer: Customer) => Promise<void>;
  generateId: () => string;
  now: () => string;
}

export interface CustomerPersistenceInput {
  name?: string;
  address?: string;
}

function normalizeCustomerName(name: string): string {
  return name.trim().toLowerCase();
}

export async function ensureCustomerPersistence(
  input: CustomerPersistenceInput,
  dependencies: CustomerPersistenceDependencies
): Promise<Customer | undefined> {
  const name = input.name?.trim();
  if (!name) return undefined;

  const normalizedName = normalizeCustomerName(name);
  const existingCustomer = (await dependencies.getAllCustomers()).find(
    (customer) => !customer.deleted && normalizeCustomerName(customer.name) === normalizedName
  );

  if (existingCustomer) return existingCustomer;

  const now = dependencies.now();
  // A customer created from a job inherits the structured address too, not just
  // the raw string — otherwise every auto-created customer starts life in the
  // cleanup worklist despite the address already having been parsed.
  const customer: Customer = withCustomerAddressFields({
    id: dependencies.generateId(),
    name,
    address: input.address?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  });

  await dependencies.addCustomer(customer);
  return customer;
}
