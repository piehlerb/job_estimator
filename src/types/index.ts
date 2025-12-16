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
  createdAt: string;
  updatedAt: string;
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
}

export interface PricingVariable {
  id: string;
  name: string;
  value: number;
  createdAt: string;
  updatedAt: string;
}

export interface JobPhoto {
  id: string;
  category: 'Estimate' | 'Before' | 'During' | 'After';
  localUri?: string; // Base64 or Blob URL for offline storage
  driveFileId?: string;
  fileName: string;
  uploadedAt?: string;
  syncStatus: 'pending' | 'uploading' | 'uploaded' | 'failed';
  capturedAt: string;
  errorMessage?: string; // For failed uploads
}

export interface Job {
  id: string;
  name: string;
  systemId: string;
  floorFootage: number;
  verticalFootage: number;
  crackFillFactor: number;
  travelDistance: number;
  installDate: string;
  installDays: number;
  jobHours: number;
  totalPrice: number;
  // Optional fields
  chipBlend?: string;
  baseColor?: BaseColor;
  status: JobStatus;
  // Tint options
  includeBasecoatTint?: boolean;
  includeTopcoatTint?: boolean;
  // Google Drive integration
  googleDriveFolderId?: string;
  photos?: JobPhoto[];
  // Snapshot of costs at time of job creation (so old jobs don't change)
  costsSnapshot: Costs;
  // Snapshot of system at time of job creation
  systemSnapshot: ChipSystem;
  // Snapshot of laborers assigned to this job
  laborersSnapshot: Laborer[];
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

// Inventory tracking
export interface ChipInventory {
  id: string;
  blend: string;
  pounds: number;
  updatedAt: string;
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
  suggestedTotal: number;
  suggestedMargin: number;
  suggestedMarginPct: number;
}

// Chip blend type (also defined in db.ts for backwards compatibility)
export interface ChipBlend {
  id: string;
  name: string;
}

// Google Drive integration types
export interface GoogleDriveAuth {
  id: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // Timestamp
  userEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoogleDriveSettings {
  id: string;
  rootFolderName: string; // e.g., "Jobs"
  rootFolderId?: string; // Created in Google Drive
  autoUpload: boolean;
  // API Configuration (stored securely in IndexedDB)
  clientId?: string;
  apiKey?: string;
  createdAt: string;
  updatedAt: string;
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
