export interface ChipSystem {
  id: string;
  name: string;
  feetPerLb: number;
  boxCost: number;
  baseSpread: number;
  topSpread: number;
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
  installDays: number;
  installDate: string;
  travelDistance: number;
  laborers: number;
  totalPrice: number;
  // Snapshot of costs at time of job creation
  baseCostPerGal: number;
  topCostPerGal: number;
  crackFillCostPerGal: number;
  gasCost: number;
  fullyLoadedEE: number;
  consumablesCost: number;
  // Snapshot of system at time of job creation
  systemSnapshot: {
    name: string;
    feetPerLb: number;
    boxCost: number;
    baseSpread: number;
    topSpread: number;
  };
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

export interface Calculation {
  id: string;
  jobId: string;
  chipCost: number;
  installCost: number;
  laborCost: number;
  royaltyAmount: number;
  totalCost: number;
  suggestedPrice: number;
  margin: number;
  createdAt: string;
}
