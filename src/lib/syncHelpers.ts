/**
 * Sync Helper Functions
 * Handles data mapping between IndexedDB (camelCase) and Supabase (snake_case)
 */

/**
 * Convert camelCase to snake_case
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Convert snake_case to camelCase
 */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert an object's keys from camelCase to snake_case
 */
export function objectToSnakeCase(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(objectToSnakeCase);

  const result: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const snakeKey = toSnakeCase(key);
      result[snakeKey] = objectToSnakeCase(obj[key]);
    }
  }
  return result;
}

/**
 * Convert an object's keys from snake_case to camelCase
 */
export function objectToCamelCase(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(objectToCamelCase);

  const result: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const camelKey = toCamelCase(key);
      result[camelKey] = objectToCamelCase(obj[key]);
    }
  }
  return result;
}

/**
 * Compare timestamps to determine which record is newer
 * Returns: 1 if a is newer, -1 if b is newer, 0 if equal
 */
export function compareTimestamps(a: string, b: string): number {
  const timeA = new Date(a).getTime();
  const timeB = new Date(b).getTime();

  if (timeA > timeB) return 1;
  if (timeA < timeB) return -1;
  return 0;
}

/**
 * Resolve conflict using last-write-wins strategy
 * Returns the record with the most recent updatedAt timestamp
 */
export function resolveConflict<T extends { updatedAt: string }>(
  local: T,
  remote: T
): { winner: T; source: 'local' | 'remote' } {
  const comparison = compareTimestamps(local.updatedAt, remote.updatedAt);

  if (comparison >= 0) {
    return { winner: local, source: 'local' };
  } else {
    return { winner: remote, source: 'remote' };
  }
}

/**
 * Get table name mapping (IndexedDB store name -> Supabase table name)
 */
export function getSupabaseTableName(storeName: string): string {
  const mapping: Record<string, string> = {
    systems: 'systems',
    pricingVariables: 'pricing_variables',
    costs: 'costs',
    laborers: 'laborers',
    chipBlends: 'chip_blends',
    jobs: 'jobs',
    chipInventory: 'chip_inventory',
    topCoatInventory: 'topcoat_inventory',
    baseCoatInventory: 'basecoat_inventory',
    miscInventory: 'misc_inventory',
  };

  return mapping[storeName] || storeName;
}

/**
 * Get IndexedDB store name from Supabase table name
 */
export function getIndexedDBStoreName(tableName: string): string {
  const mapping: Record<string, string> = {
    systems: 'systems',
    pricing_variables: 'pricingVariables',
    costs: 'costs',
    laborers: 'laborers',
    chip_blends: 'chipBlends',
    jobs: 'jobs',
    chip_inventory: 'chipInventory',
    topcoat_inventory: 'topCoatInventory',
    basecoat_inventory: 'baseCoatInventory',
    misc_inventory: 'miscInventory',
  };

  return mapping[tableName] || tableName;
}

/**
 * Check if a record needs sync (has been modified locally but not synced)
 */
export function needsSync(record: any): boolean {
  // If syncedAt is missing or older than updatedAt, needs sync
  if (!record.syncedAt) return true;

  const updated = new Date(record.updatedAt).getTime();
  const synced = new Date(record.syncedAt).getTime();

  return updated > synced;
}

/**
 * Generate a unique sync operation ID
 */
export function generateSyncId(): string {
  return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Batch array into chunks
 */
export function batchArray<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Delay execution (for retry with backoff)
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
export function getBackoffDelay(retryCount: number, baseDelay: number = 1000): number {
  return Math.min(baseDelay * Math.pow(2, retryCount), 30000); // Max 30 seconds
}

/**
 * Normalize a chip blend name for consistent storage and comparison.
 * - Trims leading/trailing whitespace
 * - Converts to Title Case for consistent display
 * This prevents duplicates like "wombat", "Wombat", "WOMBAT", "wombat " from being created.
 */
export function normalizeChipBlendName(name: string): string {
  if (!name) return '';
  // Trim whitespace and convert to title case
  return name.trim().toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}
