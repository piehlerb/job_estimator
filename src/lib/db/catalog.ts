/** Catalog stores: chip systems, pricing variables, chip blends, base coat colors and products. */
import { ChipSystem, PricingVariable, Product, BaseCoatColor } from '../../types';
import { getDB, queueForSync, triggerBackgroundSync } from './core';

export async function getAllSystems(): Promise<ChipSystem[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['systems'], 'readonly');
    const store = transaction.objectStore('systems');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result || [];
      resolve(results.filter((system: ChipSystem) => !system.deleted));
    };
  });
}

// Sync version - returns all records including deleted
export async function getAllSystemsForSync(): Promise<ChipSystem[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['systems'], 'readonly');
    const store = transaction.objectStore('systems');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function addSystem(system: ChipSystem): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['systems'], 'readwrite');
    const store = transaction.objectStore('systems');
    const request = store.add(system);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Queue for sync
  await queueForSync('systems', system.id, 'create');

  // Trigger background sync
  await triggerBackgroundSync();
}

export async function getAllPricingVariables(): Promise<PricingVariable[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pricingVariables'], 'readonly');
    const store = transaction.objectStore('pricingVariables');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result || [];
      resolve(results.filter((variable: PricingVariable) => !variable.deleted));
    };
  });
}

// Sync version - returns all records including deleted
export async function getAllPricingVariablesForSync(): Promise<PricingVariable[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pricingVariables'], 'readonly');
    const store = transaction.objectStore('pricingVariables');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function addPricingVariable(variable: PricingVariable): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['pricingVariables'], 'readwrite');
    const store = transaction.objectStore('pricingVariables');
    const request = store.add(variable);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Queue for sync
  await queueForSync('pricingVariables', variable.id, 'create');

  // Trigger background sync
  await triggerBackgroundSync();
}

export async function updateSystem(system: ChipSystem): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['systems'], 'readwrite');
    const store = transaction.objectStore('systems');
    const request = store.put(system);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Queue for sync
  await queueForSync('systems', system.id, 'update');

  // Trigger background sync
  await triggerBackgroundSync();
}

export async function deleteSystem(id: string): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['systems'], 'readwrite');
    const store = transaction.objectStore('systems');
    const getRequest = store.get(id);

    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const system = getRequest.result;
      if (system) {
        system.deleted = true;
        system.updatedAt = new Date().toISOString();
        const putRequest = store.put(system);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
  });

  // Queue for sync
  await queueForSync('systems', id, 'delete');

  // Trigger background sync
  await triggerBackgroundSync();
}

export async function updatePricingVariable(variable: PricingVariable): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['pricingVariables'], 'readwrite');
    const store = transaction.objectStore('pricingVariables');
    const request = store.put(variable);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Queue for sync
  await queueForSync('pricingVariables', variable.id, 'update');

  // Trigger background sync
  await triggerBackgroundSync();
}

export async function deletePricingVariable(id: string): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['pricingVariables'], 'readwrite');
    const store = transaction.objectStore('pricingVariables');
    const getRequest = store.get(id);

    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const variable = getRequest.result;
      if (variable) {
        variable.deleted = true;
        variable.updatedAt = new Date().toISOString();
        const putRequest = store.put(variable);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
  });

  // Queue for sync
  await queueForSync('pricingVariables', id, 'delete');

  // Trigger background sync
  await triggerBackgroundSync();
}

// Chip Blends - simple list of blend names
export interface ChipBlend {
  id: string;
  name: string;
  systemIds?: string[]; // IDs of chip systems this blend is available with
  baseCoatColorIds?: string[]; // IDs of base coat colors this blend is available with
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
}

export async function getAllChipBlends(): Promise<ChipBlend[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chipBlends'], 'readonly');
    const store = transaction.objectStore('chipBlends');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result || [];
      resolve(results.filter((blend: ChipBlend) => !blend.deleted));
    };
  });
}

// Sync version - returns all records including deleted
export async function getAllChipBlendsForSync(): Promise<ChipBlend[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chipBlends'], 'readonly');
    const store = transaction.objectStore('chipBlends');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function getChipBlend(id: string): Promise<ChipBlend | undefined> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chipBlends'], 'readonly');
    const store = transaction.objectStore('chipBlends');
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function addChipBlend(blend: ChipBlend): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['chipBlends'], 'readwrite');
    const store = transaction.objectStore('chipBlends');
    const request = store.add(blend);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Queue for sync
  await queueForSync('chipBlends', blend.id, 'create');

  // Trigger background sync
  await triggerBackgroundSync();
}

export async function updateChipBlend(blend: ChipBlend): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['chipBlends'], 'readwrite');
    const store = transaction.objectStore('chipBlends');
    const request = store.put(blend);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Queue for sync
  await queueForSync('chipBlends', blend.id, 'update');

  // Trigger background sync
  await triggerBackgroundSync();
}

export async function deleteChipBlend(id: string): Promise<void> {
  const db = await getDB();
  const blend = await getChipBlend(id);
  if (!blend) return;

  // Soft delete
  blend.deleted = true;
  blend.updatedAt = new Date().toISOString();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['chipBlends'], 'readwrite');
    const store = transaction.objectStore('chipBlends');
    const request = store.put(blend);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Queue for sync
  await queueForSync('chipBlends', id, 'delete');

  // Trigger background sync
  await triggerBackgroundSync();
}

// Base Coat Colors
export async function getAllBaseCoatColors(): Promise<BaseCoatColor[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['baseCoatColors'], 'readonly');
    const store = transaction.objectStore('baseCoatColors');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result || [];
      resolve(results.filter((color: BaseCoatColor) => !color.deleted));
    };
  });
}

// Sync version - returns all records including deleted
export async function getAllBaseCoatColorsForSync(): Promise<BaseCoatColor[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['baseCoatColors'], 'readonly');
    const store = transaction.objectStore('baseCoatColors');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function getBaseCoatColor(id: string): Promise<BaseCoatColor | undefined> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['baseCoatColors'], 'readonly');
    const store = transaction.objectStore('baseCoatColors');
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || undefined);
  });
}

export async function addBaseCoatColor(color: BaseCoatColor): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['baseCoatColors'], 'readwrite');
    const store = transaction.objectStore('baseCoatColors');
    const request = store.add(color);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  await queueForSync('baseCoatColors', color.id, 'create');
  await triggerBackgroundSync();
}

export async function updateBaseCoatColor(color: BaseCoatColor): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['baseCoatColors'], 'readwrite');
    const store = transaction.objectStore('baseCoatColors');
    const request = store.put(color);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  await queueForSync('baseCoatColors', color.id, 'update');
  await triggerBackgroundSync();
}

export async function deleteBaseCoatColor(id: string): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['baseCoatColors'], 'readwrite');
    const store = transaction.objectStore('baseCoatColors');
    const getRequest = store.get(id);

    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const color = getRequest.result;
      if (color) {
        color.deleted = true;
        color.updatedAt = new Date().toISOString();
        const putRequest = store.put(color);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
  });

  await queueForSync('baseCoatColors', id, 'delete');
  await triggerBackgroundSync();
}

export async function getAllProducts(): Promise<Product[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['products'], 'readonly');
    const store = transaction.objectStore('products');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result || [];
      resolve(results.filter((p: Product) => !p.deleted));
    };
  });
}

// Sync version - returns all records including deleted
export async function getAllProductsForSync(): Promise<Product[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['products'], 'readonly');
    const store = transaction.objectStore('products');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function getProduct(id: string): Promise<Product | undefined> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['products'], 'readonly');
    const store = transaction.objectStore('products');
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || undefined);
  });
}

export async function addProduct(product: Product): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['products'], 'readwrite');
    const store = transaction.objectStore('products');
    const request = store.add(product);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  await queueForSync('products', product.id, 'create');
  await triggerBackgroundSync();
}

export async function updateProduct(product: Product): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['products'], 'readwrite');
    const store = transaction.objectStore('products');
    const request = store.put(product);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  await queueForSync('products', product.id, 'update');
  await triggerBackgroundSync();
}

export async function deleteProduct(id: string): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['products'], 'readwrite');
    const store = transaction.objectStore('products');
    const getRequest = store.get(id);

    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const product = getRequest.result;
      if (product) {
        product.deleted = true;
        product.updatedAt = new Date().toISOString();
        const putRequest = store.put(product);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
  });

  await queueForSync('products', id, 'delete');
  await triggerBackgroundSync();
}
