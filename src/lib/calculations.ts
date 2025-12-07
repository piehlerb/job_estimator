import { ChipSystem, Costs, Laborer, JobCalculation } from '../types';

interface JobInputs {
  floorFootage: number;
  verticalFootage: number;
  crackFillFactor: number;
  travelDistance: number;
  installDate: string;
  installDays: number;
  jobHours: number;
  totalPrice: number;
}

export function calculateJobOutputs(
  inputs: JobInputs,
  system: ChipSystem,
  costs: Costs,
  laborers: Laborer[]
): JobCalculation {
  const {
    floorFootage,
    verticalFootage,
    crackFillFactor,
    travelDistance,
    installDate,
    installDays,
    jobHours,
    totalPrice,
  } = inputs;

  const {
    feetPerLb,
    boxCost,
    baseSpread,
    topSpread,
  } = system;

  const {
    baseCostPerGal,
    topCostPerGal,
    crackFillCost: crackFillCostPerGal,
    gasCost,
    consumablesCost,
  } = costs;

  // Price per sqft
  const pricePerSqft = floorFootage > 0 ? totalPrice / floorFootage : 0;

  // Chip needed: ((floor + (vertical * 1.1)) / feetPerLb / 40) rounded up
  const chipNeededRaw = feetPerLb > 0
    ? (floorFootage + (verticalFootage * 1.1)) / feetPerLb / 40
    : 0;
  const chipNeeded = Math.ceil(chipNeededRaw);

  // Chip cost
  const chipCost = chipNeeded * boxCost;

  // Base gallons: floor / baseSpread + (vertical / baseSpread) * 1.25
  const baseGallons = baseSpread > 0
    ? (floorFootage / baseSpread) + ((verticalFootage / baseSpread) * 1.25)
    : 0;

  // Base cost
  const baseCost = baseGallons * baseCostPerGal;

  // Top gallons: floor / topSpread + (vertical / topSpread) * 1.25
  const topGallons = topSpread > 0
    ? (floorFootage / topSpread) + ((verticalFootage / topSpread) * 1.25)
    : 0;

  // Top cost
  const topCost = topGallons * topCostPerGal;

  // Crack fill gallons: crackFillFactor * 0.2
  const crackFillGallons = crackFillFactor * 0.2;

  // Crack fill cost
  const crackFillCost = crackFillGallons * crackFillCostPerGal;

  // Gas generator cost: gasCost * 10
  const gasGeneratorCost = gasCost * 10;

  // Gas heater cost: if install month is 11, 12, 1, 2, 3 then (gasCost + 1) * 8, else 0
  const installMonth = installDate ? new Date(installDate).getMonth() + 1 : 0;
  const isWinterMonth = [11, 12, 1, 2, 3].includes(installMonth);
  const gasHeaterCost = isWinterMonth ? (gasCost + 1) * 8 : 0;

  // Gas travel cost:
  // Initial estimate trip: travelDistance * 2 * gasCost / 20
  // Work days travel: travelDistance * 2 * gasCost / 10 * installDays
  const gasTravelCost = (travelDistance * 2 * gasCost / 20) + (travelDistance * 2 * gasCost / 10 * installDays);

  // Labor: sum of (jobHours * fullyLoadedRate) for each laborer
  const laborCost = laborers.reduce((sum, laborer) => {
    return sum + (jobHours * laborer.fullyLoadedRate);
  }, 0);

  // Royalty cost: totalPrice * 0.05
  const royaltyCost = totalPrice * 0.05;

  // Total costs
  const totalCosts = chipCost + baseCost + topCost + consumablesCost + crackFillCost
    + gasHeaterCost + gasTravelCost + gasGeneratorCost + royaltyCost + laborCost;

  // Total costs per sqft
  const totalCostsPerSqft = floorFootage > 0 ? totalCosts / floorFootage : 0;

  // Job margin
  const jobMargin = totalPrice - totalCosts;

  // Suggested discount: floorFootage * -1, max 500 for floor footage
  const cappedFloor = Math.min(floorFootage, 500);
  const suggestedDiscount = cappedFloor * -1;

  // Suggested crack price: crackFillCost * 3
  const suggestedCrackPrice = crackFillCost * 3;

  // Suggested floor price per sqft: min of ((totalCosts - suggestedDiscount - suggestedCrackPrice + 2000) / floorFootage) and 8
  const suggestedFloorPricePerSqft = floorFootage > 0
    ? Math.min((totalCosts - suggestedDiscount - suggestedCrackPrice + 2000) / floorFootage, 8)
    : 0;

  // Suggested floor price
  const suggestedFloorPrice = suggestedFloorPricePerSqft * floorFootage;

  // Suggested vertical price: verticalFootage * 12
  const suggestedVerticalPrice = verticalFootage * 12;

  // Suggested total
  const suggestedTotal = suggestedCrackPrice + suggestedFloorPrice + suggestedVerticalPrice + suggestedDiscount;

  // Suggested margin
  const suggestedMargin = suggestedTotal - totalCosts;

  // Suggested margin pct
  const suggestedMarginPct = suggestedTotal > 0 ? (suggestedMargin / suggestedTotal) * 100 : 0;

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
    consumablesCost,
    royaltyCost,
    totalCosts,
    totalCostsPerSqft,
    jobMargin,
    suggestedDiscount,
    suggestedCrackPrice,
    suggestedFloorPricePerSqft,
    suggestedFloorPrice,
    suggestedVerticalPrice,
    suggestedTotal,
    suggestedMargin,
    suggestedMarginPct,
  };
}
