import { ChipSystem } from '../types';

export interface CostInputs {
  baseCostPerGal: number;
  topCostPerGal: number;
  crackFillCostPerGal: number;
  gasCost: number;
  fullyLoadedEE: number;
  consumablesCost: number;
}

export interface JobInputs {
  floorFootage: number;
  verticalFootage: number;
  crackFillFactor: number;
  installDays: number;
  installDate: string;
  travelDistance: number;
  laborers: number;
  totalPrice: number;
}

export interface JobCalculation {
  // Price metrics
  pricePerSqft: number;

  // Material needs
  chipNeeded: number;
  chipCost: number;
  baseGallons: number;
  baseCost: number;
  topGallons: number;
  topCost: number;
  crackFillGallons: number;
  crackFillCost: number;

  // Gas costs
  gasGeneratorCost: number;
  gasHeaterCost: number;
  gasTravelCost: number;

  // Other costs
  laborCost: number;
  consumablesCost: number;
  royaltyCost: number;

  // Totals
  totalCosts: number;
  totalCostsPerSqft: number;
  jobMargin: number;

  // Suggested pricing
  suggestedDiscount: number;
  suggestedCrackPrice: number;
  suggestedFloorPricePerSqft: number;
  suggestedVerticalPrice: number;
  suggestedTotal: number;
  suggestedMargin: number;
  suggestedMarginPct: number;
}

export function calculateJobCosts(
  jobInputs: JobInputs,
  system: ChipSystem | Pick<ChipSystem, 'feetPerLb' | 'boxCost' | 'baseSpread' | 'topSpread'> | null,
  costInputs: CostInputs
): JobCalculation {
  const {
    floorFootage,
    verticalFootage,
    crackFillFactor,
    installDays,
    installDate,
    travelDistance,
    laborers,
    totalPrice,
  } = jobInputs;

  const {
    baseCostPerGal,
    topCostPerGal,
    crackFillCostPerGal,
    gasCost,
    fullyLoadedEE,
    consumablesCost,
  } = costInputs;

  // Price per sqft
  const pricePerSqft = floorFootage > 0 ? totalPrice / floorFootage : 0;

  // Chip calculations
  const chipNeeded = system
    ? Math.ceil((floorFootage + verticalFootage * 1.1) / system.feetPerLb / 40)
    : 0;
  const chipCost = system ? chipNeeded * system.boxCost : 0;

  // Base calculations
  const baseGallons = system
    ? floorFootage / system.baseSpread + (verticalFootage / system.baseSpread) * 1.25
    : 0;
  const baseCost = baseGallons * baseCostPerGal;

  // Top calculations
  const topGallons = system
    ? floorFootage / system.topSpread + (verticalFootage / system.topSpread) * 1.25
    : 0;
  const topCost = topGallons * topCostPerGal;

  // Crack fill calculations
  const crackFillGallons = crackFillFactor * 0.2;
  const crackFillCost = crackFillGallons * crackFillCostPerGal;

  // Gas calculations
  const gasGeneratorCost = gasCost * 10;

  // Gas heater cost - check if install date is in winter months (11, 12, 1, 2, 3)
  const installMonth = new Date(installDate).getMonth() + 1; // getMonth() returns 0-11
  const isWinterMonth = [11, 12, 1, 2, 3].includes(installMonth);
  const gasHeaterCost = isWinterMonth ? (gasCost + 1) * 8 : 0;

  const gasTravelCost = (travelDistance * 2 * gasCost) / 20 + (travelDistance * 2 * gasCost) / 10;

  // Labor cost (laborers * 10 hours * fullyLoadedEE * install days)
  const laborCost = fullyLoadedEE * 10 * laborers * installDays;

  // Consumables cost (passed through)
  const consumables = consumablesCost;

  // Royalty cost
  const royaltyCost = totalPrice * 0.05;

  // Total costs
  const totalCosts =
    chipCost +
    baseCost +
    topCost +
    consumables +
    crackFillCost +
    gasHeaterCost +
    gasTravelCost +
    gasGeneratorCost +
    royaltyCost +
    laborCost;

  const totalCostsPerSqft = floorFootage > 0 ? totalCosts / floorFootage : 0;

  // Job margin
  const jobMargin = totalPrice - totalCosts;

  // Suggested pricing calculations
  const suggestedDiscount = Math.min(floorFootage, 500) * -1;
  const suggestedCrackPrice = crackFillCost * 3;

  const suggestedFloorCalc =
    (totalCosts - suggestedDiscount - suggestedCrackPrice + 2000) /
    (floorFootage > 0 ? floorFootage : 1);
  const suggestedFloorPricePerSqft = Math.min(suggestedFloorCalc, 8);

  const suggestedVerticalPrice = verticalFootage * 12;

  const suggestedTotal =
    suggestedCrackPrice +
    suggestedFloorPricePerSqft * floorFootage +
    suggestedVerticalPrice +
    suggestedDiscount;

  const suggestedMargin = suggestedTotal - totalCosts;
  const suggestedMarginPct =
    suggestedTotal > 0 ? (suggestedMargin / suggestedTotal) * 100 : 0;

  return {
    pricePerSqft,
    chipNeeded,
    chipCost,
    baseGallons,
    baseCost,
    topGallons,
    topCost,
    crackFillGallons,
    crackFillCost,
    gasGeneratorCost,
    gasHeaterCost,
    gasTravelCost,
    laborCost,
    consumablesCost: consumables,
    royaltyCost,
    totalCosts,
    totalCostsPerSqft,
    jobMargin,
    suggestedDiscount,
    suggestedCrackPrice,
    suggestedFloorPricePerSqft,
    suggestedVerticalPrice,
    suggestedTotal,
    suggestedMargin,
    suggestedMarginPct,
  };
}

export function getCostInputsFromPricingVars(pricingVars: Array<{ name: string; value: number }>): CostInputs {
  const getValue = (searchTerms: string[]) => {
    const variable = pricingVars.find((v) =>
      searchTerms.some((term) => v.name.toLowerCase().includes(term.toLowerCase()))
    );
    return variable ? variable.value : 0;
  };

  return {
    baseCostPerGal: getValue(['base cost', 'base gal', 'base per gal']),
    topCostPerGal: getValue(['top cost', 'top gal', 'top per gal']),
    crackFillCostPerGal: getValue(['crack fill', 'crack cost']),
    gasCost: getValue(['gas cost', 'gas']),
    fullyLoadedEE: getValue(['fully loaded', 'employee', 'ee']),
    consumablesCost: getValue(['consumables']),
  };
}
