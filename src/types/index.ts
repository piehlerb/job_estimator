export type BaseColor = string;

export type JobStatus = 'Won' | 'Lost' | 'Pending';

export interface ChipSystem {
  id: string;
  name: string;
  feetPerLb: number;
  boxCost: number;
  baseSpread: number;
  baseCoats: number;
  topSpread: number;
  topCoats: number;
  cyclo1Spread: number;
  cyclo1Coats: number;
  verticalPricePerSqft?: number; // Price per sqft for vertical surfaces
  floorPriceMin?: number; // Minimum floor price per sqft for suggested pricing
  floorPriceMax?: number; // Maximum floor price per sqft for suggested pricing
  notes?: string; // Optional notes about this chip system
  isDefault?: boolean; // If true, this system is pre-selected on new jobs
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
  moistureMitigationCostPerGal?: number; // Cost per gallon of moisture mitigation product
  moistureMitigationSpreadRate?: number; // Square feet covered per gallon
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
  crackFillFactorUnitsPerGallon?: number; // Crack fill factor units that equal 1 gallon (default 5)
  suggestedCrackFillPriceMultiplier?: number; // Suggested crack-fill pricing multiplier on crack-fill cost (default 3)
  chipVerticalUsageFactor?: number; // Extra chip usage factor applied to vertical sqft (default 1.1)
  verticalSpreadUsageMultiplier?: number; // Extra base/top spread multiplier for vertical sqft (default 1.25)
  gasHeaterMonths?: number[]; // Months where gas heater cost is applied (1-12), default [11,12,1,2,3]
  gasGeneratorGallonsPerHour?: number; // Gas gallons/hour for generator (default 1.2)
  gasHeaterGallonsPerHour?: number; // Gas gallons/hour for heater (default 1)
  travelGasMpg?: number; // MPG used for travel gas calculation (default 10)
  useSuggestedDiscountCap?: boolean; // Toggle cap on suggested discount (default true)
  suggestedDiscountCapSqft?: number; // Maximum sqft used for suggested discount (default 500)
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

export interface Customer {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

export interface Product {
  id: string;
  name: string;
  cost: number; // unit cost (what you pay)
  price: number; // standard unit price (what you charge)
  description?: string;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}



export interface JobProduct {
  productId: string;
  productName: string; // snapshot of name at time of adding
  quantity: number;
  unitCost: number; // snapshot of product cost
  unitPrice: number; // actual price charged (editable, initialized from standard price)
}

export interface BaseCoatColor {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

export type CoatingRemovalType = 'None' | 'Paint' | 'Epoxy';


export interface JobReminder {
  id: string;
  subject: string;
  details?: string;
  dueDate: string; // YYYY-MM-DD
  dueTime: string; // HH:mm
  dueAt: string; // ISO timestamp
  notifiedAt?: string;
  completed?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InstallDaySchedule {
  day: number;
  hours: number;
  laborerIds: string[];
}

export interface ActualDaySchedule {
  day: number;
  hours: number;
  laborerIds: string[];
}

export interface ActualCosts {
  actualChipCost: number;
  actualBaseCost: number;
  actualTopCost: number;
  actualCyclo1Cost: number;
  actualTintCost: number;
  actualGasGeneratorCost: number;
  actualGasHeaterCost: number;
  actualGasTravelCost: number;
  actualLaborCost: number;
  actualConsumablesCost: number;
  actualRoyaltyCost: number;
  actualTotalCosts: number;
  actualTotalHours: number;
  actualMargin: number;
  actualMarginPct: number;
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
  tags?: string[]; // Optional tags for reporting and filtering
  baseColor?: BaseColor;
  status: JobStatus;
  estimateDate?: string; // Date the estimate was created/sent (defaults to createdAt date)
  decisionDate?: string; // Date the customer made a decision (Won/Lost)
  probability?: number;  // 0 | 20 | 40 | 60 | 80 | 100 — likelihood of closing
  notes?: string;
  // Tint options
  includeBasecoatTint?: boolean;
  includeTopcoatTint?: boolean;
  // Additive options
  antiSlip?: boolean;
  abrasionResistance?: boolean;
  cyclo1Topcoat?: boolean;
  cyclo1Coats?: number; // Additional job-level coats added to system cyclo1 coats
  // Surface preparation
  coatingRemoval?: CoatingRemovalType; // Type of coating removal needed
  moistureMitigation?: boolean; // Whether moisture mitigation is needed
  disableGasHeater?: boolean; // If true, gas heater cost is forced to zero
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
  // Actual job execution data (only relevant for Won jobs)
  actualInstallSchedule?: ActualDaySchedule[];
  actualBaseCoatGallons?: number;
  actualTopCoatGallons?: number;
  actualCyclo1Gallons?: number;
  actualTintOz?: number;         // Combined base + top tint, in oz
  actualChipBoxes?: number;
  // Products added to this job
  products?: JobProduct[];
  reminders?: JobReminder[];
  // Snapshot of costs at time of job creation (so old jobs don't change)
  costsSnapshot: Costs;
  // Snapshot of pricing at time of job creation
  pricingSnapshot?: Pricing;
  // Snapshot of system at time of job creation
  systemSnapshot: ChipSystem;
  // Snapshot of laborers assigned to this job
  laborersSnapshot: Laborer[];
  // Estimate grouping (alternative or bundled estimates for the same customer)
  groupId?: string;             // UUID shared by all jobs in the same group
  groupType?: 'alternative' | 'bundled'; // Type of grouping
  isPrimaryEstimate?: boolean;  // True for the job that originated the group
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
  baseBClear: number; // gallons
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
  moistureMitigationGallons: number;
  moistureMitigationMaterialCost: number;
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
  baseCoatColorIds?: string[]; // IDs of base coat colors this blend is available with
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
  customers: Customer[];
  products: Product[];
  baseCoatColors: BaseCoatColor[];
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

// =====================================================
// ORGANIZATION TYPES
// =====================================================

export interface Organization {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: string;
  orgId: string;
  userId: string;
  email: string;
  role: 'admin' | 'member';
  invitedBy?: string;
  joinedAt: string;
}

export interface OrganizationInvitation {
  id: string;
  orgId: string;
  email?: string;
  role: 'admin' | 'member';
  inviteCode: string;
  invitedBy: string;
  acceptedBy?: string;
  acceptedAt?: string;
  expiresAt: string;
  createdAt: string;
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



