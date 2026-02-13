export type BaseColor = 'Grey' | 'Tan' | 'Clear';

export type JobStatus = 'Won' | 'Lost' | 'Pending';

export interface ChipSystem {
  id: string;
  name: string;
  feetPerLb: number;
  boxCost: number;
  baseSpread: number;
  topSpread: number;
  cyclo1Spread: number;
  doubleBroadcast?: boolean; // If true, topcoat requirements are doubled
  verticalPricePerSqft?: number; // Price per sqft for vertical surfaces
  floorPriceMin?: number; // Minimum floor price per sqft for suggested pricing
  floorPriceMax?: number; // Maximum floor price per sqft for suggested pricing
  notes?: string; // Optional notes about this chip system
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

// Static costs that rarely change - stored separately so jobs use snapshot values
export interface Costs {
  id: string;
  baseCostPerGal: number;
  topCostPerGal: number;
  crackFillCost: number;
  gasCost: number;
  consumablesCost: number;
  cyclo1CostPerGal: number;
  tintCostPerQuart: number;
  antiSlipCostPerGal: number;
  abrasionResistanceCostPerGal: number;
  createdAt: string;
  updatedAt: string;
}

export interface Laborer {
  id: string;
  name: string;
  fullyLoadedRate: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

export interface PricingVariable {
  id: string;
  name: string;
  value: number;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

// Pricing configuration for job pricing elements
export interface Pricing {
  id: string;
  verticalPricePerSqft: number; // DEPRECATED: Moved to ChipSystem - kept for backward compatibility
  antiSlipPricePerSqft: number; // Price per sqft for anti-slip additive
  abrasionResistancePricePerSqft: number; // Price per sqft for abrasion resistance additive
  coatingRemovalPaintPerSqft: number; // Price per sqft for paint removal
  coatingRemovalEpoxyPerSqft: number; // Price per sqft for epoxy removal
  moistureMitigationPerSqft: number; // Price per sqft for moisture mitigation
  floorPriceMin?: number; // DEPRECATED: Moved to ChipSystem - kept for backward compatibility
  floorPriceMax?: number; // DEPRECATED: Moved to ChipSystem - kept for backward compatibility
  minimumMarginBuffer?: number; // Buffer added to costs for suggested pricing (default 2000)
  minimumJobPrice?: number; // Minimum total suggested job price (default 2500)
  createdAt: string;
  updatedAt: string;
}

export type CoatingRemovalType = 'None' | 'Paint' | 'Epoxy';

export interface InstallDaySchedule {
  day: number; // Day number (1, 2, 3, etc.)
  hours: number; // Hours for this specific day
  laborerIds: string[]; // Laborers assigned to this day
}

export interface Job {
  id: string;
  name: string;
  customerName?: string;
  customerAddress?: string;
  systemId: string;
  floorFootage: number;
  verticalFootage: number;
  crackFillFactor: number;
  travelDistance: number;
  installDate: string;
  installDays: number;
  jobHours: number; // Legacy field - total hours (kept for backward compatibility)
  installSchedule?: InstallDaySchedule[]; // Per-day schedule with hours and laborers
  totalPrice: number;
  // Optional fields
  chipBlend?: string;
  baseColor?: BaseColor;
  status: JobStatus;
  notes?: string;
  // Tint options
  includeBasecoatTint?: boolean;
  includeTopcoatTint?: boolean;
  // Additive options
  antiSlip?: boolean;
  abrasionResistance?: boolean;
  cyclo1Topcoat?: boolean;
  cyclo1Coats?: number; // 1 or 2 coats (only used if cyclo1Topcoat is true)
  // Surface preparation
  coatingRemoval?: CoatingRemovalType; // Type of coating removal needed
  moistureMitigation?: boolean; // Whether moisture mitigation is needed
  // Actual pricing breakdown (editable, persisted)
  actualDiscount?: number;
  actualCrackPrice?: number;
  actualFloorPricePerSqft?: number;
  actualFloorPrice?: number;
  actualVerticalPrice?: number;
  actualAntiSlipPrice?: number;
  actualAbrasionResistancePrice?: number;
  actualCoatingRemovalPrice?: number;
  actualMoistureMitigationPrice?: number;
  // Snapshot of costs at time of job creation (so old jobs don't change)
  costsSnapshot: Costs;
  // Snapshot of pricing at time of job creation
  pricingSnapshot?: Pricing;
  // Snapshot of system at time of job creation
  systemSnapshot: ChipSystem;
  // Snapshot of laborers assigned to this job
  laborersSnapshot: Laborer[];
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  deleted?: boolean;
}

// Inventory tracking
export interface ChipInventory {
  id: string;
  blend: string;
  pounds: number;
  updatedAt: string;
  deleted?: boolean;
}

export interface TopCoatInventory {
  id: string;
  topA: number; // gallons
  topB: number; // gallons
  updatedAt: string;
}

export interface BaseCoatInventory {
  id: string;
  baseA: number; // gallons
  baseBGrey: number; // gallons
  baseBTan: number; // gallons
  updatedAt: string;
}

export interface MiscInventory {
  id: string;
  crackRepair: number; // gallons
  silicaSand: number; // buckets
  shot: number; // buckets
  updatedAt: string;
}

export interface JobCalculation {
  pricePerSqft: number;
  chipNeeded: number;
  chipCost: number;
  baseGallons: number;
  baseCost: number;
  topGallons: number;
  topCost: number;
  crackFillGallons: number;
  crackFillCost: number;
  cyclo1Needed: number;
  cyclo1Cost: number;
  tintNeeded: number;
  tintCost: number;
  antiSlipCost: number;
  abrasionResistanceCost: number;
  gasGeneratorCost: number;
  gasHeaterCost: number;
  gasTravelCost: number;
  laborCost: number;
  consumablesCost: number;
  royaltyCost: number;
  totalCosts: number;
  totalCostsPerSqft: number;
  jobMargin: number;
  marginPerDay: number;
  suggestedDiscount: number;
  suggestedCrackPrice: number;
  suggestedFloorPricePerSqft: number;
  suggestedFloorPrice: number;
  suggestedVerticalPrice: number;
  suggestedAntiSlipPrice: number;
  suggestedAbrasionResistancePrice: number;
  suggestedCoatingRemovalPrice: number;
  suggestedMoistureMitigationPrice: number;
  suggestedTotal: number;
  suggestedMargin: number;
  suggestedMarginPct: number;
  suggestedEffectivePricePerSqft: number;
}

// Chip blend type (also defined in db.ts for backwards compatibility)
export interface ChipBlend {
  id: string;
  name: string;
  systemIds?: string[]; // IDs of chip systems this blend is available with
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
}

// Backup/Export types
export const EXPORT_VERSION = 1;

export interface ExportMetadata {
  version: number;
  exportedAt: string;
  appName: string;
}

export interface ExportData {
  metadata: ExportMetadata;
  systems: ChipSystem[];
  costs: Costs | null;
  laborers: Laborer[];
  jobs: Job[];
  chipBlends: ChipBlend[];
  chipInventory: ChipInventory[];
  topCoatInventory: TopCoatInventory | null;
  baseCoatInventory: BaseCoatInventory | null;
  miscInventory: MiscInventory | null;
}

export type MergeAction = 'add' | 'update' | 'skip' | 'delete';

export interface MergeLogEntry {
  entityType: string;
  entityName: string;
  action: MergeAction;
  reason: string;
}

export interface ImportPreview {
  toAdd: { entityType: string; entityName: string; }[];
  toUpdate: { entityType: string; entityName: string; localUpdatedAt: string; importUpdatedAt: string; }[];
  toSkip: { entityType: string; entityName: string; reason: string; }[];
  toDelete: { entityType: string; entityName: string; }[];
  errors: string[];
}

// Sync types
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';
export type SyncDirection = 'push' | 'pull' | 'both';

export interface SyncResult {
  success: boolean;
  recordsPushed: number;
  recordsPulled: number;
  conflicts: number;
  errors: string[];
  timestamp: string;
}

export interface SyncState {
  status: SyncStatus;
  lastSync: string | null;
  lastSyncResult: SyncResult | null;
  isSyncing: boolean;
  error: string | null;
}

export interface SyncQueueItem {
  id: string;
  operation: 'create' | 'update' | 'delete';
  table: string;
  recordId: string;
  data: any;
  timestamp: string;
  retries: number;
  error?: string;
}
