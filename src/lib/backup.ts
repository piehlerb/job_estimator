import {
  ExportData,
  ExportMetadata,
  ImportPreview,
  MergeLogEntry,
  EXPORT_VERSION,
} from '../types';
import {
  getAllSystems,
  getCosts,
  getAllLaborers,
  getAllJobs,
  getAllChipBlends,
  getAllChipInventory,
  getTopCoatInventory,
  getBaseCoatInventory,
  addSystem,
  updateSystem,
  deleteSystem,
  saveCosts,
  addLaborer,
  updateLaborer,
  deleteLaborer,
  addJob,
  updateJob,
  deleteJob,
  addChipBlend,
  saveChipInventory,
  deleteChipInventory,
  saveTopCoatInventory,
  saveBaseCoatInventory,
} from './db';

// Export all data from the database
export async function exportAllData(): Promise<ExportData> {
  const [
    systems,
    costs,
    laborers,
    jobs,
    chipBlends,
    chipInventory,
    topCoatInventory,
    baseCoatInventory,
  ] = await Promise.all([
    getAllSystems(),
    getCosts(),
    getAllLaborers(),
    getAllJobs(),
    getAllChipBlends(),
    getAllChipInventory(),
    getTopCoatInventory(),
    getBaseCoatInventory(),
  ]);

  const metadata: ExportMetadata = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    appName: 'JobEstimator',
  };

  return {
    metadata,
    systems,
    costs,
    laborers,
    jobs,
    chipBlends,
    chipInventory,
    topCoatInventory,
    baseCoatInventory,
  };
}

// Download export as JSON file
export function downloadExport(data: ExportData): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().split('T')[0];
  const filename = `job-estimator-backup-${date}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Validation functions
function isValidString(value: unknown): value is string {
  return typeof value === 'string';
}

function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

function isValidBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isValidISODate(value: unknown): boolean {
  if (!isValidString(value)) return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
}

function validateChipSystem(system: unknown): string[] {
  const errors: string[] = [];
  if (!system || typeof system !== 'object') {
    return ['Invalid system object'];
  }
  const s = system as Record<string, unknown>;

  if (!isValidString(s.id)) errors.push('System missing valid id');
  if (!isValidString(s.name)) errors.push('System missing valid name');
  if (!['1/4', '1/8', '1/16'].includes(s.chipSize as string)) errors.push('System has invalid chipSize');
  if (!isValidNumber(s.feetPerLb)) errors.push('System missing valid feetPerLb');
  if (!isValidNumber(s.boxCost)) errors.push('System missing valid boxCost');
  if (!isValidNumber(s.baseSpread)) errors.push('System missing valid baseSpread');
  if (!isValidNumber(s.topSpread)) errors.push('System missing valid topSpread');
  if (!isValidISODate(s.createdAt)) errors.push('System missing valid createdAt');
  if (!isValidISODate(s.updatedAt)) errors.push('System missing valid updatedAt');

  return errors;
}

function validateCosts(costs: unknown): string[] {
  const errors: string[] = [];
  if (!costs || typeof costs !== 'object') {
    return ['Invalid costs object'];
  }
  const c = costs as Record<string, unknown>;

  if (!isValidString(c.id)) errors.push('Costs missing valid id');
  if (!isValidNumber(c.baseCostPerGal)) errors.push('Costs missing valid baseCostPerGal');
  if (!isValidNumber(c.topCostPerGal)) errors.push('Costs missing valid topCostPerGal');
  if (!isValidNumber(c.crackFillCost)) errors.push('Costs missing valid crackFillCost');
  if (!isValidNumber(c.gasCost)) errors.push('Costs missing valid gasCost');
  if (!isValidNumber(c.consumablesCost)) errors.push('Costs missing valid consumablesCost');
  if (!isValidISODate(c.createdAt)) errors.push('Costs missing valid createdAt');
  if (!isValidISODate(c.updatedAt)) errors.push('Costs missing valid updatedAt');

  return errors;
}

function validateLaborer(laborer: unknown): string[] {
  const errors: string[] = [];
  if (!laborer || typeof laborer !== 'object') {
    return ['Invalid laborer object'];
  }
  const l = laborer as Record<string, unknown>;

  if (!isValidString(l.id)) errors.push('Laborer missing valid id');
  if (!isValidString(l.name)) errors.push('Laborer missing valid name');
  if (!isValidNumber(l.fullyLoadedRate)) errors.push('Laborer missing valid fullyLoadedRate');
  if (!isValidBoolean(l.isActive)) errors.push('Laborer missing valid isActive');
  if (!isValidISODate(l.createdAt)) errors.push('Laborer missing valid createdAt');
  if (!isValidISODate(l.updatedAt)) errors.push('Laborer missing valid updatedAt');

  return errors;
}

function validateJob(job: unknown): string[] {
  const errors: string[] = [];
  if (!job || typeof job !== 'object') {
    return ['Invalid job object'];
  }
  const j = job as Record<string, unknown>;

  if (!isValidString(j.id)) errors.push('Job missing valid id');
  if (!isValidString(j.name)) errors.push('Job missing valid name');
  if (!isValidString(j.systemId)) errors.push('Job missing valid systemId');
  if (!isValidNumber(j.floorFootage)) errors.push('Job missing valid floorFootage');
  if (!isValidNumber(j.verticalFootage)) errors.push('Job missing valid verticalFootage');
  if (!isValidNumber(j.crackFillFactor)) errors.push('Job missing valid crackFillFactor');
  if (!isValidNumber(j.travelDistance)) errors.push('Job missing valid travelDistance');
  if (!isValidString(j.installDate)) errors.push('Job missing valid installDate');
  if (!isValidNumber(j.installDays)) errors.push('Job missing valid installDays');
  if (!isValidNumber(j.jobHours)) errors.push('Job missing valid jobHours');
  if (!isValidNumber(j.totalPrice)) errors.push('Job missing valid totalPrice');
  if (!['Won', 'Lost', 'Pending'].includes(j.status as string)) errors.push('Job has invalid status');
  if (!isValidISODate(j.createdAt)) errors.push('Job missing valid createdAt');
  if (!isValidISODate(j.updatedAt)) errors.push('Job missing valid updatedAt');

  // Validate snapshots exist
  if (!j.costsSnapshot || typeof j.costsSnapshot !== 'object') errors.push('Job missing costsSnapshot');
  if (!j.systemSnapshot || typeof j.systemSnapshot !== 'object') errors.push('Job missing systemSnapshot');
  if (!Array.isArray(j.laborersSnapshot)) errors.push('Job missing laborersSnapshot array');

  return errors;
}

function validateChipBlend(blend: unknown): string[] {
  const errors: string[] = [];
  if (!blend || typeof blend !== 'object') {
    return ['Invalid chip blend object'];
  }
  const b = blend as Record<string, unknown>;

  if (!isValidString(b.id)) errors.push('ChipBlend missing valid id');
  if (!isValidString(b.name)) errors.push('ChipBlend missing valid name');

  return errors;
}

function validateChipInventory(inventory: unknown): string[] {
  const errors: string[] = [];
  if (!inventory || typeof inventory !== 'object') {
    return ['Invalid chip inventory object'];
  }
  const i = inventory as Record<string, unknown>;

  if (!isValidString(i.id)) errors.push('ChipInventory missing valid id');
  if (!isValidString(i.blend)) errors.push('ChipInventory missing valid blend');
  if (!isValidNumber(i.pounds)) errors.push('ChipInventory missing valid pounds');
  if (!isValidISODate(i.updatedAt)) errors.push('ChipInventory missing valid updatedAt');

  return errors;
}

function validateTopCoatInventory(inventory: unknown): string[] {
  const errors: string[] = [];
  if (!inventory || typeof inventory !== 'object') {
    return ['Invalid top coat inventory object'];
  }
  const i = inventory as Record<string, unknown>;

  if (!isValidString(i.id)) errors.push('TopCoatInventory missing valid id');
  if (!isValidNumber(i.topA)) errors.push('TopCoatInventory missing valid topA');
  if (!isValidNumber(i.topB)) errors.push('TopCoatInventory missing valid topB');
  if (!isValidISODate(i.updatedAt)) errors.push('TopCoatInventory missing valid updatedAt');

  return errors;
}

function validateBaseCoatInventory(inventory: unknown): string[] {
  const errors: string[] = [];
  if (!inventory || typeof inventory !== 'object') {
    return ['Invalid base coat inventory object'];
  }
  const i = inventory as Record<string, unknown>;

  if (!isValidString(i.id)) errors.push('BaseCoatInventory missing valid id');
  if (!isValidNumber(i.baseA)) errors.push('BaseCoatInventory missing valid baseA');
  if (!isValidNumber(i.baseBGrey)) errors.push('BaseCoatInventory missing valid baseBGrey');
  if (!isValidNumber(i.baseBTan)) errors.push('BaseCoatInventory missing valid baseBTan');
  if (!isValidISODate(i.updatedAt)) errors.push('BaseCoatInventory missing valid updatedAt');

  return errors;
}

// Validate entire import data structure
export function validateImportData(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Import data is not a valid object'] };
  }

  const d = data as Record<string, unknown>;

  // Validate metadata
  if (!d.metadata || typeof d.metadata !== 'object') {
    errors.push('Missing metadata');
  } else {
    const meta = d.metadata as Record<string, unknown>;
    if (!isValidNumber(meta.version)) errors.push('Invalid metadata version');
    if (!isValidISODate(meta.exportedAt)) errors.push('Invalid metadata exportedAt');
    if (meta.appName !== 'JobEstimator') errors.push('Invalid metadata appName');
  }

  // Validate arrays exist
  if (!Array.isArray(d.systems)) errors.push('systems must be an array');
  if (!Array.isArray(d.laborers)) errors.push('laborers must be an array');
  if (!Array.isArray(d.jobs)) errors.push('jobs must be an array');
  if (!Array.isArray(d.chipBlends)) errors.push('chipBlends must be an array');
  if (!Array.isArray(d.chipInventory)) errors.push('chipInventory must be an array');

  // Validate individual records
  if (Array.isArray(d.systems)) {
    d.systems.forEach((s, i) => {
      const errs = validateChipSystem(s);
      errs.forEach(e => errors.push(`System[${i}]: ${e}`));
    });
  }

  if (d.costs !== null) {
    const errs = validateCosts(d.costs);
    errs.forEach(e => errors.push(`Costs: ${e}`));
  }

  if (Array.isArray(d.laborers)) {
    d.laborers.forEach((l, i) => {
      const errs = validateLaborer(l);
      errs.forEach(e => errors.push(`Laborer[${i}]: ${e}`));
    });
  }

  if (Array.isArray(d.jobs)) {
    d.jobs.forEach((j, i) => {
      const errs = validateJob(j);
      errs.forEach(e => errors.push(`Job[${i}]: ${e}`));
    });
  }

  if (Array.isArray(d.chipBlends)) {
    d.chipBlends.forEach((b, i) => {
      const errs = validateChipBlend(b);
      errs.forEach(e => errors.push(`ChipBlend[${i}]: ${e}`));
    });
  }

  if (Array.isArray(d.chipInventory)) {
    d.chipInventory.forEach((inv, i) => {
      const errs = validateChipInventory(inv);
      errs.forEach(e => errors.push(`ChipInventory[${i}]: ${e}`));
    });
  }

  if (d.topCoatInventory !== null) {
    const errs = validateTopCoatInventory(d.topCoatInventory);
    errs.forEach(e => errors.push(`TopCoatInventory: ${e}`));
  }

  if (d.baseCoatInventory !== null) {
    const errs = validateBaseCoatInventory(d.baseCoatInventory);
    errs.forEach(e => errors.push(`BaseCoatInventory: ${e}`));
  }

  return { valid: errors.length === 0, errors };
}

// Compare timestamps - returns true if importDate is newer
function isNewer(importDate: string, localDate: string): boolean {
  return new Date(importDate).getTime() > new Date(localDate).getTime();
}

// Generate import preview (dry run)
export async function generateImportPreview(importData: ExportData, deleteOrphans: boolean): Promise<ImportPreview> {
  const preview: ImportPreview = {
    toAdd: [],
    toUpdate: [],
    toSkip: [],
    toDelete: [],
    errors: [],
  };

  // Get current data
  const [
    localSystems,
    localCosts,
    localLaborers,
    localJobs,
    localChipBlends,
    localChipInventory,
    localTopCoatInventory,
    localBaseCoatInventory,
  ] = await Promise.all([
    getAllSystems(),
    getCosts(),
    getAllLaborers(),
    getAllJobs(),
    getAllChipBlends(),
    getAllChipInventory(),
    getTopCoatInventory(),
    getBaseCoatInventory(),
  ]);

  // Create lookup maps
  const localSystemsMap = new Map(localSystems.map(s => [s.id, s]));
  const localLaborersMap = new Map(localLaborers.map(l => [l.id, l]));
  const localJobsMap = new Map(localJobs.map(j => [j.id, j]));
  const localChipBlendsMap = new Map(localChipBlends.map(b => [b.id, b]));
  const localChipInventoryMap = new Map(localChipInventory.map(i => [i.id, i]));

  // Track which IDs are in import for delete detection
  const importSystemIds = new Set(importData.systems.map(s => s.id));
  const importLaborerIds = new Set(importData.laborers.map(l => l.id));
  const importJobIds = new Set(importData.jobs.map(j => j.id));
  const importChipBlendIds = new Set(importData.chipBlends.map(b => b.id));
  const importChipInventoryIds = new Set(importData.chipInventory.map(i => i.id));

  // Compare systems
  for (const importSystem of importData.systems) {
    const local = localSystemsMap.get(importSystem.id);
    if (!local) {
      preview.toAdd.push({ entityType: 'System', entityName: importSystem.name });
    } else if (isNewer(importSystem.updatedAt, local.updatedAt)) {
      preview.toUpdate.push({
        entityType: 'System',
        entityName: importSystem.name,
        localUpdatedAt: local.updatedAt,
        importUpdatedAt: importSystem.updatedAt,
      });
    } else {
      preview.toSkip.push({
        entityType: 'System',
        entityName: importSystem.name,
        reason: 'Local version is same or newer',
      });
    }
  }

  // Compare costs (singleton)
  if (importData.costs) {
    if (!localCosts) {
      preview.toAdd.push({ entityType: 'Costs', entityName: 'Cost Settings' });
    } else if (isNewer(importData.costs.updatedAt, localCosts.updatedAt)) {
      preview.toUpdate.push({
        entityType: 'Costs',
        entityName: 'Cost Settings',
        localUpdatedAt: localCosts.updatedAt,
        importUpdatedAt: importData.costs.updatedAt,
      });
    } else {
      preview.toSkip.push({
        entityType: 'Costs',
        entityName: 'Cost Settings',
        reason: 'Local version is same or newer',
      });
    }
  }

  // Compare laborers
  for (const importLaborer of importData.laborers) {
    const local = localLaborersMap.get(importLaborer.id);
    if (!local) {
      preview.toAdd.push({ entityType: 'Laborer', entityName: importLaborer.name });
    } else if (isNewer(importLaborer.updatedAt, local.updatedAt)) {
      preview.toUpdate.push({
        entityType: 'Laborer',
        entityName: importLaborer.name,
        localUpdatedAt: local.updatedAt,
        importUpdatedAt: importLaborer.updatedAt,
      });
    } else {
      preview.toSkip.push({
        entityType: 'Laborer',
        entityName: importLaborer.name,
        reason: 'Local version is same or newer',
      });
    }
  }

  // Compare jobs
  for (const importJob of importData.jobs) {
    const local = localJobsMap.get(importJob.id);
    if (!local) {
      preview.toAdd.push({ entityType: 'Job', entityName: importJob.name });
    } else if (isNewer(importJob.updatedAt, local.updatedAt)) {
      preview.toUpdate.push({
        entityType: 'Job',
        entityName: importJob.name,
        localUpdatedAt: local.updatedAt,
        importUpdatedAt: importJob.updatedAt,
      });
    } else {
      preview.toSkip.push({
        entityType: 'Job',
        entityName: importJob.name,
        reason: 'Local version is same or newer',
      });
    }
  }

  // Compare chip blends (no updatedAt, so always add if missing)
  for (const importBlend of importData.chipBlends) {
    const local = localChipBlendsMap.get(importBlend.id);
    if (!local) {
      preview.toAdd.push({ entityType: 'ChipBlend', entityName: importBlend.name });
    } else {
      preview.toSkip.push({
        entityType: 'ChipBlend',
        entityName: importBlend.name,
        reason: 'Already exists',
      });
    }
  }

  // Compare chip inventory
  for (const importInv of importData.chipInventory) {
    const local = localChipInventoryMap.get(importInv.id);
    if (!local) {
      preview.toAdd.push({ entityType: 'ChipInventory', entityName: importInv.blend });
    } else if (isNewer(importInv.updatedAt, local.updatedAt)) {
      preview.toUpdate.push({
        entityType: 'ChipInventory',
        entityName: importInv.blend,
        localUpdatedAt: local.updatedAt,
        importUpdatedAt: importInv.updatedAt,
      });
    } else {
      preview.toSkip.push({
        entityType: 'ChipInventory',
        entityName: importInv.blend,
        reason: 'Local version is same or newer',
      });
    }
  }

  // Compare top coat inventory (singleton)
  if (importData.topCoatInventory) {
    if (!localTopCoatInventory) {
      preview.toAdd.push({ entityType: 'TopCoatInventory', entityName: 'Top Coat Inventory' });
    } else if (isNewer(importData.topCoatInventory.updatedAt, localTopCoatInventory.updatedAt)) {
      preview.toUpdate.push({
        entityType: 'TopCoatInventory',
        entityName: 'Top Coat Inventory',
        localUpdatedAt: localTopCoatInventory.updatedAt,
        importUpdatedAt: importData.topCoatInventory.updatedAt,
      });
    } else {
      preview.toSkip.push({
        entityType: 'TopCoatInventory',
        entityName: 'Top Coat Inventory',
        reason: 'Local version is same or newer',
      });
    }
  }

  // Compare base coat inventory (singleton)
  if (importData.baseCoatInventory) {
    if (!localBaseCoatInventory) {
      preview.toAdd.push({ entityType: 'BaseCoatInventory', entityName: 'Base Coat Inventory' });
    } else if (isNewer(importData.baseCoatInventory.updatedAt, localBaseCoatInventory.updatedAt)) {
      preview.toUpdate.push({
        entityType: 'BaseCoatInventory',
        entityName: 'Base Coat Inventory',
        localUpdatedAt: localBaseCoatInventory.updatedAt,
        importUpdatedAt: importData.baseCoatInventory.updatedAt,
      });
    } else {
      preview.toSkip.push({
        entityType: 'BaseCoatInventory',
        entityName: 'Base Coat Inventory',
        reason: 'Local version is same or newer',
      });
    }
  }

  // Find orphans to delete (if option enabled)
  if (deleteOrphans) {
    for (const local of localSystems) {
      if (!importSystemIds.has(local.id)) {
        preview.toDelete.push({ entityType: 'System', entityName: local.name });
      }
    }
    for (const local of localLaborers) {
      if (!importLaborerIds.has(local.id)) {
        preview.toDelete.push({ entityType: 'Laborer', entityName: local.name });
      }
    }
    for (const local of localJobs) {
      if (!importJobIds.has(local.id)) {
        preview.toDelete.push({ entityType: 'Job', entityName: local.name });
      }
    }
    for (const local of localChipBlends) {
      if (!importChipBlendIds.has(local.id)) {
        preview.toDelete.push({ entityType: 'ChipBlend', entityName: local.name });
      }
    }
    for (const local of localChipInventory) {
      if (!importChipInventoryIds.has(local.id)) {
        preview.toDelete.push({ entityType: 'ChipInventory', entityName: local.blend });
      }
    }
  }

  return preview;
}

// Execute the import based on preview
export async function executeImport(importData: ExportData, deleteOrphans: boolean): Promise<MergeLogEntry[]> {
  const log: MergeLogEntry[] = [];

  // Get current data for comparison
  const [
    localSystems,
    localCosts,
    localLaborers,
    localJobs,
    localChipBlends,
    localChipInventory,
    localTopCoatInventory,
    localBaseCoatInventory,
  ] = await Promise.all([
    getAllSystems(),
    getCosts(),
    getAllLaborers(),
    getAllJobs(),
    getAllChipBlends(),
    getAllChipInventory(),
    getTopCoatInventory(),
    getBaseCoatInventory(),
  ]);

  // Create lookup maps
  const localSystemsMap = new Map(localSystems.map(s => [s.id, s]));
  const localLaborersMap = new Map(localLaborers.map(l => [l.id, l]));
  const localJobsMap = new Map(localJobs.map(j => [j.id, j]));
  const localChipBlendsMap = new Map(localChipBlends.map(b => [b.id, b]));
  const localChipInventoryMap = new Map(localChipInventory.map(i => [i.id, i]));

  // Track import IDs for deletion
  const importSystemIds = new Set(importData.systems.map(s => s.id));
  const importLaborerIds = new Set(importData.laborers.map(l => l.id));
  const importJobIds = new Set(importData.jobs.map(j => j.id));
  const importChipInventoryIds = new Set(importData.chipInventory.map(i => i.id));

  // Import systems
  for (const importSystem of importData.systems) {
    const local = localSystemsMap.get(importSystem.id);
    if (!local) {
      await addSystem(importSystem);
      log.push({ entityType: 'System', entityName: importSystem.name, action: 'add', reason: 'New record' });
    } else if (isNewer(importSystem.updatedAt, local.updatedAt)) {
      await updateSystem(importSystem);
      log.push({ entityType: 'System', entityName: importSystem.name, action: 'update', reason: 'Import is newer' });
    } else {
      log.push({ entityType: 'System', entityName: importSystem.name, action: 'skip', reason: 'Local is same or newer' });
    }
  }

  // Import costs
  if (importData.costs) {
    if (!localCosts) {
      await saveCosts(importData.costs);
      log.push({ entityType: 'Costs', entityName: 'Cost Settings', action: 'add', reason: 'New record' });
    } else if (isNewer(importData.costs.updatedAt, localCosts.updatedAt)) {
      await saveCosts(importData.costs);
      log.push({ entityType: 'Costs', entityName: 'Cost Settings', action: 'update', reason: 'Import is newer' });
    } else {
      log.push({ entityType: 'Costs', entityName: 'Cost Settings', action: 'skip', reason: 'Local is same or newer' });
    }
  }

  // Import laborers
  for (const importLaborer of importData.laborers) {
    const local = localLaborersMap.get(importLaborer.id);
    if (!local) {
      await addLaborer(importLaborer);
      log.push({ entityType: 'Laborer', entityName: importLaborer.name, action: 'add', reason: 'New record' });
    } else if (isNewer(importLaborer.updatedAt, local.updatedAt)) {
      await updateLaborer(importLaborer);
      log.push({ entityType: 'Laborer', entityName: importLaborer.name, action: 'update', reason: 'Import is newer' });
    } else {
      log.push({ entityType: 'Laborer', entityName: importLaborer.name, action: 'skip', reason: 'Local is same or newer' });
    }
  }

  // Import jobs
  for (const importJob of importData.jobs) {
    const local = localJobsMap.get(importJob.id);
    if (!local) {
      await addJob(importJob);
      log.push({ entityType: 'Job', entityName: importJob.name, action: 'add', reason: 'New record' });
    } else if (isNewer(importJob.updatedAt, local.updatedAt)) {
      await updateJob(importJob);
      log.push({ entityType: 'Job', entityName: importJob.name, action: 'update', reason: 'Import is newer' });
    } else {
      log.push({ entityType: 'Job', entityName: importJob.name, action: 'skip', reason: 'Local is same or newer' });
    }
  }

  // Import chip blends (no updatedAt)
  for (const importBlend of importData.chipBlends) {
    const local = localChipBlendsMap.get(importBlend.id);
    if (!local) {
      await addChipBlend(importBlend);
      log.push({ entityType: 'ChipBlend', entityName: importBlend.name, action: 'add', reason: 'New record' });
    } else {
      log.push({ entityType: 'ChipBlend', entityName: importBlend.name, action: 'skip', reason: 'Already exists' });
    }
  }

  // Import chip inventory
  for (const importInv of importData.chipInventory) {
    const local = localChipInventoryMap.get(importInv.id);
    if (!local) {
      await saveChipInventory(importInv);
      log.push({ entityType: 'ChipInventory', entityName: importInv.blend, action: 'add', reason: 'New record' });
    } else if (isNewer(importInv.updatedAt, local.updatedAt)) {
      await saveChipInventory(importInv);
      log.push({ entityType: 'ChipInventory', entityName: importInv.blend, action: 'update', reason: 'Import is newer' });
    } else {
      log.push({ entityType: 'ChipInventory', entityName: importInv.blend, action: 'skip', reason: 'Local is same or newer' });
    }
  }

  // Import top coat inventory
  if (importData.topCoatInventory) {
    if (!localTopCoatInventory) {
      await saveTopCoatInventory(importData.topCoatInventory);
      log.push({ entityType: 'TopCoatInventory', entityName: 'Top Coat Inventory', action: 'add', reason: 'New record' });
    } else if (isNewer(importData.topCoatInventory.updatedAt, localTopCoatInventory.updatedAt)) {
      await saveTopCoatInventory(importData.topCoatInventory);
      log.push({ entityType: 'TopCoatInventory', entityName: 'Top Coat Inventory', action: 'update', reason: 'Import is newer' });
    } else {
      log.push({ entityType: 'TopCoatInventory', entityName: 'Top Coat Inventory', action: 'skip', reason: 'Local is same or newer' });
    }
  }

  // Import base coat inventory
  if (importData.baseCoatInventory) {
    if (!localBaseCoatInventory) {
      await saveBaseCoatInventory(importData.baseCoatInventory);
      log.push({ entityType: 'BaseCoatInventory', entityName: 'Base Coat Inventory', action: 'add', reason: 'New record' });
    } else if (isNewer(importData.baseCoatInventory.updatedAt, localBaseCoatInventory.updatedAt)) {
      await saveBaseCoatInventory(importData.baseCoatInventory);
      log.push({ entityType: 'BaseCoatInventory', entityName: 'Base Coat Inventory', action: 'update', reason: 'Import is newer' });
    } else {
      log.push({ entityType: 'BaseCoatInventory', entityName: 'Base Coat Inventory', action: 'skip', reason: 'Local is same or newer' });
    }
  }

  // Delete orphans if enabled
  if (deleteOrphans) {
    for (const local of localSystems) {
      if (!importSystemIds.has(local.id)) {
        await deleteSystem(local.id);
        log.push({ entityType: 'System', entityName: local.name, action: 'delete', reason: 'Not in import file' });
      }
    }
    for (const local of localLaborers) {
      if (!importLaborerIds.has(local.id)) {
        await deleteLaborer(local.id);
        log.push({ entityType: 'Laborer', entityName: local.name, action: 'delete', reason: 'Not in import file' });
      }
    }
    for (const local of localJobs) {
      if (!importJobIds.has(local.id)) {
        await deleteJob(local.id);
        log.push({ entityType: 'Job', entityName: local.name, action: 'delete', reason: 'Not in import file' });
      }
    }
    // Note: ChipBlends don't have a delete function in db.ts, skipping
    for (const local of localChipInventory) {
      if (!importChipInventoryIds.has(local.id)) {
        await deleteChipInventory(local.id);
        log.push({ entityType: 'ChipInventory', entityName: local.blend, action: 'delete', reason: 'Not in import file' });
      }
    }
  }

  return log;
}

// Read file and parse JSON
export function parseImportFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);
        resolve(data);
      } catch (error) {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
