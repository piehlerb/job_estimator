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
  includeBasecoatTint: boolean;
  includeTopcoatTint: boolean;
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
    includeBasecoatTint,
    includeTopcoatTint,
  } = inputs;

  const {
    feetPerLb,
    boxCost,
    baseSpread,
    topSpread,
    cyclo1Spread,
  } = system;

  const {
    baseCostPerGal,
    topCostPerGal,
    crackFillCost: crackFillCostPerGal,
    gasCost,
    consumablesCost,
    cyclo1CostPerGal,
    tintCostPerQuart,
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

  // Cyclo1 needed: floorFootage / cyclo1Spread
  const cyclo1Needed = cyclo1Spread > 0 ? floorFootage / cyclo1Spread : 0;

  // Cyclo1 cost: cyclo1Needed * cyclo1CostPerGal
  const cyclo1Cost = cyclo1Needed * cyclo1CostPerGal;

  // Tint needed: calculate based on which coats include tint
  // Formula: (topGallons * 128 * 0.1) if includeTopcoatTint + (baseGallons * 128 * 0.1) if includeBasecoatTint
  const tintNeeded = (includeTopcoatTint ? topGallons * 128 * 0.1 : 0)
    + (includeBasecoatTint ? baseGallons * 128 * 0.1 : 0);

  // Tint cost: tintNeeded / 32 * tintCostPerQuart
  const tintCost = (tintNeeded / 32) * tintCostPerQuart;

  // Gas generator cost: gasCost * jobHours * 1.2
  const gasGeneratorCost = gasCost * jobHours * 1.2;

  // Gas heater cost: if install month is 11, 12, 1, 2, 3 then (gasCost + 1) * jobHours, else 0
  const installMonth = installDate ? new Date(installDate).getMonth() + 1 : 0;
  const isWinterMonth = [11, 12, 1, 2, 3].includes(installMonth);
  const gasHeaterCost = isWinterMonth ? (gasCost + 1) * jobHours : 0;

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
    + cyclo1Cost + tintCost + gasHeaterCost + gasTravelCost + gasGeneratorCost + royaltyCost + laborCost;

  // Total costs per sqft
  const totalCostsPerSqft = floorFootage > 0 ? totalCosts / floorFootage : 0;

  // Job margin
  const jobMargin = totalPrice - totalCosts;

  // Margin per day: (totalPrice - totalCosts) / installDays
  const marginPerDay = installDays > 0 ? jobMargin / installDays : 0;

  // Suggested discount: floorFootage * -1, max 500 for floor footage
  const cappedFloor = Math.min(floorFootage, 500);
  const suggestedDiscount = cappedFloor * -1;

  // Suggested crack price: crackFillCost * 3
  const suggestedCrackPrice = crackFillCost * 3;

  // Suggested floor price per sqft: min of ((totalCosts - suggestedDiscount - suggestedCrackPrice + 2000) / floorFootage) and 8, with minimum of 6
  const suggestedFloorPricePerSqft = floorFootage > 0
    ? Math.max(6, Math.min((totalCosts - suggestedDiscount - suggestedCrackPrice + 2000) / floorFootage, 8))
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
    cyclo1Needed,
    cyclo1Cost,
    tintNeeded,
    tintCost,
    gasGeneratorCost,
    gasHeaterCost,
    gasTravelCost,
    laborCost,
    consumablesCost,
    royaltyCost,
    totalCosts,
    totalCostsPerSqft,
    jobMargin,
    marginPerDay,
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
