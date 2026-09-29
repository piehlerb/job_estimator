/** Singleton settings (costs, pricing) and communication templates. */
import { Costs, Pricing, CommunicationTemplate } from '../../types';
import { getDB, queueForSync, triggerBackgroundSync } from './core';

// Costs - we store a single costs record with id 'current'
export async function getCosts(): Promise<Costs | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['costs'], 'readonly');
    const store = transaction.objectStore('costs');
    const request = store.get('current');

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function saveCosts(costs: Costs): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['costs'], 'readwrite');
    const store = transaction.objectStore('costs');
    const request = store.put({
      ...costs,
      id: 'current',
      // Records without a fresh updatedAt lose every last-write-wins
      // comparison during sync, so default it if the caller omitted it
      updatedAt: costs.updatedAt || new Date().toISOString(),
    });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Queue for sync
  await queueForSync('costs', 'current', 'update');

  // Trigger background sync
  await triggerBackgroundSync();
}

/**
 * Apply a partial update to the stored costs record.
 *
 * See updatePricing for why saves go through a fresh read rather than a
 * snapshot held in component state.
 */
export async function updateCosts(patch: Partial<Costs>): Promise<Costs> {
  const stored = await getCosts();
  const next: Costs = {
    ...(stored ?? getDefaultCosts()),
    ...patch,
    id: 'current',
    updatedAt: new Date().toISOString(),
  };
  await saveCosts(next);
  return next;
}

export function getDefaultCosts(): Costs {
  return {
    id: 'current',
    baseCostPerGal: 0,
    topCostPerGal: 0,
    crackFillCost: 0,
    gasCost: 0,
    consumablesCost: 0,
    cyclo1CostPerGal: 0,
    tintCostPerQuart: 0,
    antiSlipCostPerGal: 0,
    abrasionResistanceCostPerGal: 0,
    moistureMitigationCostPerGal: 0,
    moistureMitigationSpreadRate: 200,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Pricing
export async function getPricing(): Promise<Pricing | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pricing'], 'readonly');
    const store = transaction.objectStore('pricing');
    const request = store.get('current');

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function savePricing(pricing: Pricing): Promise<void> {
  console.log('[DB] Saving pricing to IndexedDB:', pricing);
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['pricing'], 'readwrite');
    const store = transaction.objectStore('pricing');
    const request = store.put({ ...pricing, id: 'current' });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      console.log('[DB] Pricing saved to IndexedDB successfully');
      resolve();
    };
  });

  // Queue for sync
  await queueForSync('pricing', 'current', 'update');

  // Trigger background sync
  console.log('[DB] Triggering background sync...');
  await triggerBackgroundSync();
  console.log('[DB] Background sync completed');
}

/**
 * Apply a partial update to the stored pricing record.
 *
 * One pricing record holds fields owned by four separate forms — the Pricing
 * page plus three sections of Settings. A form that saves a snapshot it took
 * on load writes back every field, including ones it never displayed, so
 * saving a price could revert auto-reminder rules created in another tab, and
 * defaults merged in for display (autoReminderRules: []) got persisted as
 * though the user had chosen them. Pushed to Supabase that blanked field is a
 * legitimately newer row, so every other device pulls the loss.
 *
 * Reading the stored record here means a save carries only the caller's own
 * fields. Pass just what the form owns.
 */
export async function updatePricing(patch: Partial<Pricing>): Promise<Pricing> {
  const stored = await getPricing();
  const next: Pricing = {
    ...(stored ?? getDefaultPricing()),
    ...patch,
    id: 'current',
    updatedAt: new Date().toISOString(),
  };
  await savePricing(next);
  return next;
}

export function getDefaultPricing(): Pricing {
  return {
    id: 'current',
    verticalPricePerSqft: 12,
    antiSlipPricePerSqft: 0.50,
    abrasionResistancePricePerSqft: 0.50,
    crackFillFactorUnitsPerGallon: 5,
    suggestedCrackFillPriceMultiplier: 3,
    chipVerticalUsageFactor: 1.1,
    verticalSpreadUsageMultiplier: 1.25,
    gasHeaterMonths: [11, 12, 1, 2, 3],
    gasGeneratorGallonsPerHour: 1.2,
    gasHeaterGallonsPerHour: 1,
    travelGasMpg: 10,
    useSuggestedDiscountCap: true,  // DEPRECATED: use discountConfig
    suggestedDiscountCapSqft: 500,  // DEPRECATED: use discountConfig
    discountConfig: {
      mode: 'per_sqft' as const,
      perSqftAmount: 1,
      perSqftMaxSqft: 500,
      tagDiscounts: [],
      tagAggregation: 'sum' as const,
    },
    coatingRemovalPaintPerSqft: 1.00,
    coatingRemovalEpoxyPerSqft: 2.00,
    moistureMitigationPerSqft: 3.00,
    floorPriceMin: 6.00,
    floorPriceMax: 8.00,
    minimumMarginBuffer: 2000,
    minimumJobPrice: 2500,
    chipReclaimRate: 0,
    defaultDayHours: 8,
    staleContactDays: 30,
    autoReminderRules: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ─── Communication Templates ──────────────────────────────────────────────────

export async function getAllCommTemplatesForSync(): Promise<CommunicationTemplate[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('commTemplates', 'readonly');
    const store = tx.objectStore('commTemplates');
    const req = store.getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result || []);
  });
}

export async function getAllCommTemplates(): Promise<CommunicationTemplate[]> {
  const all = await getAllCommTemplatesForSync();
  return all.filter(t => !t.deleted);
}

export async function addCommTemplate(template: CommunicationTemplate): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('commTemplates', 'readwrite');
    const store = tx.objectStore('commTemplates');
    const req = store.put(template);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
  await queueForSync('commTemplates', template.id, 'create');
  await triggerBackgroundSync();
}

export async function updateCommTemplate(template: CommunicationTemplate): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('commTemplates', 'readwrite');
    const store = tx.objectStore('commTemplates');
    const req = store.put(template);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
  await queueForSync('commTemplates', template.id, 'update');
  await triggerBackgroundSync();
}

export async function deleteCommTemplate(id: string): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('commTemplates', 'readwrite');
    const store = tx.objectStore('commTemplates');
    const getReq = store.get(id);
    getReq.onerror = () => reject(getReq.error);
    getReq.onsuccess = () => {
      const item = getReq.result;
      if (item) {
        item.deleted = true;
        item.updatedAt = new Date().toISOString();
        const putReq = store.put(item);
        putReq.onerror = () => reject(putReq.error);
        putReq.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
  });
  await queueForSync('commTemplates', id, 'delete');
  await triggerBackgroundSync();
}
