export type ChipSize = '1/4' | '1/8' | '1/16';

export interface ChipSystem {
  id: string;
  name: string;
  chipSize: ChipSize;
  feetPerLb: number;
  boxCost: number;
  baseSpread: number;
  topSpread: number;
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
  gasGeneratorCost: number;
  gasHeaterCost: number;
  gasTravelCost: number;
  laborCost: number;
  consumablesCost: number;
  royaltyCost: number;
  totalCosts: number;
  totalCostsPerSqft: number;
  jobMargin: number;
  suggestedDiscount: number;
  suggestedCrackPrice: number;
  suggestedFloorPricePerSqft: number;
  suggestedFloorPrice: number;
  suggestedVerticalPrice: number;
  suggestedTotal: number;
  suggestedMargin: number;
  suggestedMarginPct: number;
}
