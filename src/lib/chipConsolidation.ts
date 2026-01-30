/**
 * Chip Blend Consolidation Utility
 *
 * This script consolidates duplicate chip blends and inventory entries
 * that differ only by case or whitespace (e.g., "wombat", "Wombat", "wombat ").
 *
 * Run from browser console:
 *   import('/src/lib/chipConsolidation.js').then(m => m.consolidateChipBlends())
 *
 * Or call programmatically after importing.
 */

import {
  getAllChipBlends,
  getAllChipInventory,
  getAllJobs,
  openDB,
  ChipBlend,
} from './db';
import { normalizeChipBlendName } from './syncHelpers';
import { ChipInventory, Job } from '../types';

export interface ConsolidationResult {
  blendsConsolidated: number;
  blendsDeleted: string[];
  inventoryMerged: number;
  inventoryDeleted: string[];
  jobsUpdated: number;
  jobUpdates: { jobId: string; oldBlend: string; newBlend: string }[];
  dryRun: boolean;
}

/**
 * Find all duplicate chip blends (same normalized name)
 */
export async function findDuplicateBlends(): Promise<Map<string, ChipBlend[]>> {
  const blends = await getAllChipBlends();
  const groups = new Map<string, ChipBlend[]>();

  for (const blend of blends) {
    const normalized = normalizeChipBlendName(blend.name);
    if (!groups.has(normalized)) {
      groups.set(normalized, []);
    }
    groups.get(normalized)!.push(blend);
  }

  // Filter to only groups with duplicates
  const duplicates = new Map<string, ChipBlend[]>();
  for (const [normalized, group] of groups) {
    if (group.length > 1) {
      duplicates.set(normalized, group);
    }
  }

  return duplicates;
}

/**
 * Find all duplicate chip inventory entries (same normalized blend name)
 */
export async function findDuplicateInventory(): Promise<Map<string, ChipInventory[]>> {
  const inventory = await getAllChipInventory();
  const groups = new Map<string, ChipInventory[]>();

  for (const inv of inventory) {
    const normalized = normalizeChipBlendName(inv.blend);
    if (!groups.has(normalized)) {
      groups.set(normalized, []);
    }
    groups.get(normalized)!.push(inv);
  }

  // Filter to only groups with duplicates
  const duplicates = new Map<string, ChipInventory[]>();
  for (const [normalized, group] of groups) {
    if (group.length > 1) {
      duplicates.set(normalized, group);
    }
  }

  return duplicates;
}

/**
 * Preview what consolidation will do (dry run)
 */
export async function previewConsolidation(): Promise<ConsolidationResult> {
  return consolidateChipBlends(true);
}

/**
 * Consolidate duplicate chip blends and inventory
 *
 * @param dryRun - If true, only preview changes without applying them
 */
export async function consolidateChipBlends(dryRun = false): Promise<ConsolidationResult> {
  const result: ConsolidationResult = {
    blendsConsolidated: 0,
    blendsDeleted: [],
    inventoryMerged: 0,
    inventoryDeleted: [],
    jobsUpdated: 0,
    jobUpdates: [],
    dryRun,
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log(`CHIP BLEND CONSOLIDATION ${dryRun ? '(DRY RUN)' : ''}`);
  console.log(`${'='.repeat(60)}\n`);

  // Get all data
  const blends = await getAllChipBlends();
  const inventory = await getAllChipInventory();
  const jobs = await getAllJobs();

  // Step 1: Group blends by normalized name
  const blendGroups = new Map<string, ChipBlend[]>();
  for (const blend of blends) {
    const normalized = normalizeChipBlendName(blend.name);
    if (!blendGroups.has(normalized)) {
      blendGroups.set(normalized, []);
    }
    blendGroups.get(normalized)!.push(blend);
  }

  // Step 2: Group inventory by normalized blend name
  const inventoryGroups = new Map<string, ChipInventory[]>();
  for (const inv of inventory) {
    const normalized = normalizeChipBlendName(inv.blend);
    if (!inventoryGroups.has(normalized)) {
      inventoryGroups.set(normalized, []);
    }
    inventoryGroups.get(normalized)!.push(inv);
  }

  // Step 3: Process each group
  const db = await openDB();

  for (const [normalizedName, blendGroup] of blendGroups) {
    if (blendGroup.length > 1) {
      console.log(`\nDuplicate blends found for "${normalizedName}":`);
      blendGroup.forEach(b => console.log(`  - "${b.name}" (id: ${b.id})`));

      // Keep the first one (or the one with the normalized name if it exists)
      const keepBlend = blendGroup.find(b => b.name === normalizedName) || blendGroup[0];
      const deleteBlends = blendGroup.filter(b => b.id !== keepBlend.id);

      console.log(`  Keeping: "${keepBlend.name}" (id: ${keepBlend.id})`);
      console.log(`  Deleting: ${deleteBlends.map(b => `"${b.name}"`).join(', ')}`);

      result.blendsConsolidated++;
      result.blendsDeleted.push(...deleteBlends.map(b => b.name));

      if (!dryRun) {
        // Update the kept blend to have the normalized name
        if (keepBlend.name !== normalizedName) {
          await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(['chipBlends'], 'readwrite');
            const store = transaction.objectStore('chipBlends');
            keepBlend.name = normalizedName;
            const request = store.put(keepBlend);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
          });
        }

        // Soft-delete the duplicates
        for (const blend of deleteBlends) {
          await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(['chipBlends'], 'readwrite');
            const store = transaction.objectStore('chipBlends');
            blend.deleted = true;
            const request = store.put(blend);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
          });
        }
      }
    }
  }

  // Step 4: Process inventory duplicates
  for (const [normalizedName, invGroup] of inventoryGroups) {
    if (invGroup.length > 1) {
      console.log(`\nDuplicate inventory found for "${normalizedName}":`);
      invGroup.forEach(i => console.log(`  - "${i.blend}": ${i.pounds} lbs (id: ${i.id})`));

      // Sum up all pounds and keep one record
      const totalPounds = invGroup.reduce((sum, i) => sum + i.pounds, 0);
      const keepInventory = invGroup[0];
      const deleteInventory = invGroup.slice(1);

      console.log(`  Merging into: ${totalPounds} lbs total`);
      console.log(`  Keeping: id ${keepInventory.id}, deleting ${deleteInventory.length} duplicate(s)`);

      result.inventoryMerged++;
      result.inventoryDeleted.push(...deleteInventory.map(i => i.blend));

      if (!dryRun) {
        // Update the kept inventory with normalized name and combined pounds
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction(['chipInventory'], 'readwrite');
          const store = transaction.objectStore('chipInventory');
          keepInventory.blend = normalizedName;
          keepInventory.pounds = totalPounds;
          keepInventory.updatedAt = new Date().toISOString();
          const request = store.put(keepInventory);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve();
        });

        // Soft-delete the duplicates
        for (const inv of deleteInventory) {
          await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(['chipInventory'], 'readwrite');
            const store = transaction.objectStore('chipInventory');
            inv.deleted = true;
            inv.updatedAt = new Date().toISOString();
            const request = store.put(inv);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
          });
        }
      }
    } else if (invGroup.length === 1) {
      // Single inventory entry - just normalize the name if needed
      const inv = invGroup[0];
      if (inv.blend !== normalizedName) {
        console.log(`\nNormalizing inventory blend name: "${inv.blend}" -> "${normalizedName}"`);

        if (!dryRun) {
          await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(['chipInventory'], 'readwrite');
            const store = transaction.objectStore('chipInventory');
            inv.blend = normalizedName;
            inv.updatedAt = new Date().toISOString();
            const request = store.put(inv);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
          });
        }
      }
    }
  }

  // Step 5: Update jobs with non-normalized chip blend names
  for (const job of jobs) {
    if (job.chipBlend) {
      const normalizedBlend = normalizeChipBlendName(job.chipBlend);
      if (job.chipBlend !== normalizedBlend) {
        console.log(`\nJob "${job.name}" (id: ${job.id}): "${job.chipBlend}" -> "${normalizedBlend}"`);

        result.jobsUpdated++;
        result.jobUpdates.push({
          jobId: job.id,
          oldBlend: job.chipBlend,
          newBlend: normalizedBlend,
        });

        if (!dryRun) {
          await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(['jobs'], 'readwrite');
            const store = transaction.objectStore('jobs');
            job.chipBlend = normalizedBlend;
            job.updatedAt = new Date().toISOString();
            const request = store.put(job);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
          });
        }
      }
    }
  }

  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Blend groups consolidated: ${result.blendsConsolidated}`);
  console.log(`Blends soft-deleted: ${result.blendsDeleted.length}`);
  console.log(`Inventory groups merged: ${result.inventoryMerged}`);
  console.log(`Inventory entries soft-deleted: ${result.inventoryDeleted.length}`);
  console.log(`Jobs updated: ${result.jobsUpdated}`);

  if (dryRun) {
    console.log(`\n*** This was a DRY RUN - no changes were made ***`);
    console.log(`Run consolidateChipBlends(false) to apply changes.`);
  } else {
    console.log(`\n*** Changes have been applied ***`);
    console.log(`Please sync to push changes to Supabase.`);
  }

  return result;
}

// Make available globally for console access
if (typeof window !== 'undefined') {
  (window as any).chipConsolidation = {
    preview: previewConsolidation,
    consolidate: () => consolidateChipBlends(false),
    findDuplicateBlends,
    findDuplicateInventory,
  };
}
