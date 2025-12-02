export interface ChipSystem {
  id: string;
  name: string;
  chipPrice: number;
  installPrice: number;
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
  materialCost: number;
  laborHours: number;
  gasExpense: number;
  royaltyPercent: number;
  seasonalAdjustment: number;
  totalCost: number;
  suggestedPrice: number;
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
