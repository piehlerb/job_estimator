/** Inventory stores: chip, tint, SKU-level coating, legacy top/base coat singletons, misc, and the shopping list. */
import { ChipInventory, TintInventory, CoatingInventory, TopCoatInventory, BaseCoatInventory, MiscInventory, ShoppingItem } from '../../types';
import { DEFAULT_COATING_SKUS, LEGACY_COATING_FIELDS, coatingSkuId, findCoatingSku } from '../coatingSkus';
import { getDB, queueForSync, triggerBackgroundSync } from './core';

// Chip Inventory
export async function getAllChipInventory(): Promise<ChipInventory[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chipInventory'], 'readonly');
    const store = transaction.objectStore('chipInventory');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result || [];
      resolve(results.filter((inventory: ChipInventory) => !inventory.deleted));
    };
  });
}

// Sync version - returns all records including deleted
export async function getAllChipInventoryForSync(): Promise<ChipInventory[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chipInventory'], 'readonly');
    const store = transaction.objectStore('chipInventory');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function saveChipInventory(inventory: ChipInventory): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['chipInventory'], 'readwrite');
    const store = transaction.objectStore('chipInventory');
    const request = store.put(inventory);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Queue for sync
  await queueForSync('chipInventory', inventory.id, 'update');

  // Trigger background sync
  await triggerBackgroundSync();
}

export async function deleteChipInventory(id: string): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['chipInventory'], 'readwrite');
    const store = transaction.objectStore('chipInventory');
    const getRequest = store.get(id);

    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const inventory = getRequest.result;
      if (inventory) {
        inventory.deleted = true;
        inventory.updatedAt = new Date().toISOString();
        const putRequest = store.put(inventory);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
  });

  // Queue for sync
  await queueForSync('chipInventory', id, 'delete');

  // Trigger background sync
  await triggerBackgroundSync();
}

// Tint Inventory
export async function getAllTintInventory(): Promise<TintInventory[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['tintInventory'], 'readonly');
    const store = transaction.objectStore('tintInventory');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result || [];
      resolve(results.filter((inv: TintInventory) => !inv.deleted));
    };
  });
}

// Sync version - returns all records including deleted
export async function getAllTintInventoryForSync(): Promise<TintInventory[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['tintInventory'], 'readonly');
    const store = transaction.objectStore('tintInventory');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function saveTintInventory(inventory: TintInventory): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['tintInventory'], 'readwrite');
    const store = transaction.objectStore('tintInventory');
    const request = store.put(inventory);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  await queueForSync('tintInventory', inventory.id, 'update');
  await triggerBackgroundSync();
}

export async function deleteTintInventory(id: string): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['tintInventory'], 'readwrite');
    const store = transaction.objectStore('tintInventory');
    const getRequest = store.get(id);

    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const existing = getRequest.result;
      if (existing) {
        const putRequest = store.put({ ...existing, deleted: true, updatedAt: new Date().toISOString() });
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
  });

  await queueForSync('tintInventory', id, 'delete');
  await triggerBackgroundSync();
}

// Coating Inventory (SKU-level: part + variant + color)
export async function getAllCoatingInventory(): Promise<CoatingInventory[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['coatingInventory'], 'readonly');
    const store = transaction.objectStore('coatingInventory');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result || [];
      resolve(results.filter((inv: CoatingInventory) => !inv.deleted));
    };
  });
}

// Sync version - returns all records including deleted
export async function getAllCoatingInventoryForSync(): Promise<CoatingInventory[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['coatingInventory'], 'readonly');
    const store = transaction.objectStore('coatingInventory');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function saveCoatingInventory(inventory: CoatingInventory): Promise<void> {
  const db = await getDB();
  const record: CoatingInventory = {
    ...inventory,
    updatedAt: inventory.updatedAt || new Date().toISOString(),
  };
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['coatingInventory'], 'readwrite');
    const store = transaction.objectStore('coatingInventory');
    const request = store.put(record);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  await queueForSync('coatingInventory', record.id, 'update');
  await triggerBackgroundSync();
}

export async function deleteCoatingInventory(id: string): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['coatingInventory'], 'readwrite');
    const store = transaction.objectStore('coatingInventory');
    const getRequest = store.get(id);

    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const existing = getRequest.result;
      if (existing) {
        const putRequest = store.put({ ...existing, deleted: true, updatedAt: new Date().toISOString() });
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
  });

  await queueForSync('coatingInventory', id, 'delete');
  await triggerBackgroundSync();
}

/**
 * One-time idempotent conversion of the legacy TopCoatInventory/BaseCoatInventory
 * singletons into SKU-level CoatingInventory rows.
 *
 * If the coatingInventory store already has non-deleted records this is a no-op.
 * Otherwise it seeds all DEFAULT_COATING_SKUS, copying gallons from the legacy
 * singleton fields (via LEGACY_COATING_FIELDS) and 0 for new flavor SKUs.
 * Uses deterministic ids (coatingSkuId) so repeated runs across devices converge,
 * and skips ids that already exist (even soft-deleted) so it never resurrects
 * records the user deleted.
 *
 * Rows that carry real legacy values get a current timestamp; pure zero defaults
 * get an old sentinel timestamp so a fresh device's seeds always lose last-write-wins
 * against real data synced from another device.
 *
 * Returns the number of SKU rows created.
 */
const COATING_SEED_EPOCH = '2020-01-01T00:00:00.000Z';

export async function ensureCoatingInventorySeeded(): Promise<number> {
  const all = await getAllCoatingInventoryForSync();
  if (all.some((inv) => !inv.deleted)) {
    return 0;
  }

  const existingIds = new Set(all.map((inv) => inv.id));
  const [top, base] = await Promise.all([getTopCoatInventory(), getBaseCoatInventory()]);

  // Map deterministic SKU id -> gallons from the legacy singleton fields.
  // Only populated when the legacy singleton actually exists on this device.
  const legacyGallons = new Map<string, number>();
  for (const [field, coords] of Object.entries(LEGACY_COATING_FIELDS)) {
    const source: any = field.startsWith('top') ? top : base;
    if (!source) continue;
    const value = source[field];
    legacyGallons.set(coatingSkuId(coords), typeof value === 'number' && !isNaN(value) ? value : 0);
  }

  let created = 0;
  const now = new Date().toISOString();
  for (const coords of DEFAULT_COATING_SKUS) {
    const id = coatingSkuId(coords);
    if (existingIds.has(id)) continue; // don't resurrect deleted rows
    const fromLegacy = legacyGallons.has(id);
    await saveCoatingInventory({
      id,
      part: coords.part,
      variant: coords.variant,
      color: coords.color,
      gallons: legacyGallons.get(id) ?? 0,
      sortOrder: coords.sortOrder,
      updatedAt: fromLegacy ? now : COATING_SEED_EPOCH,
    });
    created++;
  }
  return created;
}

/**
 * Force-update the six legacy coating SKUs from TopCoatInventory/BaseCoatInventory
 * singleton values (used when importing an old backup that predates SKU-level
 * coating inventory). Creates the SKU row if missing, otherwise overwrites gallons.
 *
 * Returns the number of SKU rows written.
 */
export async function applyLegacyCoatingToSkus(
  top: TopCoatInventory | null,
  base: BaseCoatInventory | null
): Promise<number> {
  if (!top && !base) return 0;

  const all = await getAllCoatingInventoryForSync();
  const now = new Date().toISOString();
  let written = 0;

  for (const [field, coords] of Object.entries(LEGACY_COATING_FIELDS)) {
    const source: any = field.startsWith('top') ? top : base;
    if (!source) continue;
    const gallons = source[field];
    if (typeof gallons !== 'number' || isNaN(gallons)) continue;

    const existing =
      all.find((inv) => inv.id === coatingSkuId(coords)) ||
      findCoatingSku(all, coords.part, coords.variant, coords.color);

    if (existing) {
      await saveCoatingInventory({ ...existing, gallons, deleted: false, updatedAt: now });
    } else {
      await saveCoatingInventory({
        id: coatingSkuId(coords),
        part: coords.part,
        variant: coords.variant,
        color: coords.color,
        gallons,
        sortOrder: coords.sortOrder,
        updatedAt: now,
      });
    }
    written++;
  }
  return written;
}

// Top Coat Inventory - single record
export async function getTopCoatInventory(): Promise<TopCoatInventory | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['topCoatInventory'], 'readonly');
    const store = transaction.objectStore('topCoatInventory');
    const request = store.get('current');

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function saveTopCoatInventory(inventory: TopCoatInventory): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['topCoatInventory'], 'readwrite');
    const store = transaction.objectStore('topCoatInventory');
    const request = store.put({ ...inventory, id: 'current' });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Queue for sync
  await queueForSync('topCoatInventory', 'current', 'update');

  // Trigger background sync
  await triggerBackgroundSync();
}

// Base Coat Inventory - single record
export async function getBaseCoatInventory(): Promise<BaseCoatInventory | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['baseCoatInventory'], 'readonly');
    const store = transaction.objectStore('baseCoatInventory');
    const request = store.get('current');

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function saveBaseCoatInventory(inventory: BaseCoatInventory): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['baseCoatInventory'], 'readwrite');
    const store = transaction.objectStore('baseCoatInventory');
    const request = store.put({ ...inventory, id: 'current' });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Queue for sync
  await queueForSync('baseCoatInventory', 'current', 'update');

  // Trigger background sync
  await triggerBackgroundSync();
}

// Misc Inventory
export async function getMiscInventory(): Promise<MiscInventory | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['miscInventory'], 'readonly');
    const store = transaction.objectStore('miscInventory');
    const request = store.get('current');

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? { ...result, moistureMitigation: result.moistureMitigation ?? 0 } : null);
    };
  });
}

export async function saveMiscInventory(inventory: MiscInventory): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['miscInventory'], 'readwrite');
    const store = transaction.objectStore('miscInventory');
    const request = store.put({ ...inventory, id: 'current', moistureMitigation: inventory.moistureMitigation ?? 0 });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Queue for sync
  await queueForSync('miscInventory', 'current', 'update');

  // Trigger background sync
  await triggerBackgroundSync();
}

// ─── Shopping List ────────────────────────────────────────────────────────────

export async function getAllShoppingItemsForSync(): Promise<ShoppingItem[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('shoppingItems', 'readonly');
    const store = tx.objectStore('shoppingItems');
    const req = store.getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result || []);
  });
}

export async function getAllShoppingItems(): Promise<ShoppingItem[]> {
  const all = await getAllShoppingItemsForSync();
  return all.filter(i => !i.deleted);
}

export async function addShoppingItem(item: ShoppingItem): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('shoppingItems', 'readwrite');
    const store = tx.objectStore('shoppingItems');
    const req = store.put(item);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
  await queueForSync('shoppingItems', item.id, 'create');
  await triggerBackgroundSync();
}

export async function updateShoppingItem(item: ShoppingItem): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('shoppingItems', 'readwrite');
    const store = tx.objectStore('shoppingItems');
    const req = store.put(item);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
  await queueForSync('shoppingItems', item.id, 'update');
  await triggerBackgroundSync();
}

export async function deleteShoppingItem(id: string): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('shoppingItems', 'readwrite');
    const store = tx.objectStore('shoppingItems');
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
  await queueForSync('shoppingItems', id, 'delete');
  await triggerBackgroundSync();
}
