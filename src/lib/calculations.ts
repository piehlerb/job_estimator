import { ChipSystem, Costs, Laborer, JobCalculation, InstallDaySchedule, Pricing, CoatingRemovalType } from '../types';

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
  antiSlip: boolean;
  abrasionResistance: boolean;
  cyclo1Topcoat: boolean;
  cyclo1Coats: number;
  coatingRemoval: CoatingRemovalType;
  moistureMitigation: boolean;
  installSchedule?: InstallDaySchedule[]; // Optional per-day schedule
}

export function calculateJobOutputs(
  inputs: JobInputs,
  system: ChipSystem,
  costs: Costs,
  laborers: Laborer[],
  pricing: Pricing
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
    antiSlip,
    abrasionResistance,
    cyclo1Topcoat,
    cyclo1Coats,
    coatingRemoval,
    moistureMitigation,
    installSchedule,
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
    antiSlipCostPerGal = 0,
    abrasionResistanceCostPerGal = 0,
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
  // If double broadcast, multiply by 2
  const baseTopGallons = topSpread > 0
    ? (floorFootage / topSpread) + ((verticalFootage / topSpread) * 1.25)
    : 0;
  const topGallons = system.doubleBroadcast ? baseTopGallons * 2 : baseTopGallons;

  // Top cost
  const topCost = topGallons * topCostPerGal;

  // Crack fill gallons: crackFillFactor * 0.2
  const crackFillGallons = crackFillFactor * 0.2;

  // Crack fill cost
  const crackFillCost = crackFillGallons * crackFillCostPerGal;

  // Cyclo1 needed: floorFootage / cyclo1Spread * cyclo1Coats (only if cyclo1Topcoat is enabled)
  const coats = cyclo1Coats || 1; // Default to 1 coat if not specified
  const cyclo1Needed = cyclo1Topcoat && cyclo1Spread > 0 ? (floorFootage / cyclo1Spread) * coats : 0;

  // Cyclo1 cost: cyclo1Needed * cyclo1CostPerGal (only calculate if cyclo1 is needed)
  const cyclo1Cost = cyclo1Needed > 0 ? cyclo1Needed * cyclo1CostPerGal : 0;

  // Anti-slip cost: based on topcoat gallons (if anti-slip is enabled)
  const antiSlipCost = antiSlip ? topGallons * antiSlipCostPerGal : 0;

  // Abrasion resistance cost: based on cyclo1 gallons (if abrasion resistance is enabled)
  const abrasionResistanceCost = abrasionResistance ? cyclo1Needed * abrasionResistanceCostPerGal : 0;

  // Tint needed: calculate based on which coats include tint
  // Formula: (topGallons * 128 * 0.1) if includeTopcoatTint + (baseGallons * 128 * 0.1) if includeBasecoatTint
  const tintNeeded = (includeTopcoatTint ? topGallons * 128 * 0.1 : 0)
    + (includeBasecoatTint ? baseGallons * 128 * 0.1 : 0);

  // Tint cost: tintNeeded / 32 * tintCostPerQuart (only calculate if tint is needed)
  const tintCost = tintNeeded > 0 ? (tintNeeded / 32) * tintCostPerQuart : 0;

  // Calculate total hours from schedule if available, otherwise use jobHours
  const totalHours = installSchedule && installSchedule.length > 0
    ? installSchedule.reduce((sum, day) => sum + day.hours, 0)
    : jobHours;

  // Gas generator cost: gasCost * totalHours * 1.2
  const gasGeneratorCost = gasCost * totalHours * 1.2;

  // Gas heater cost: if install month is 11, 12, 1, 2, 3 then (gasCost + 1) * totalHours, else 0
  const installMonth = installDate ? new Date(installDate).getMonth() + 1 : 0;
  const isWinterMonth = [11, 12, 1, 2, 3].includes(installMonth);
  const gasHeaterCost = isWinterMonth ? (gasCost + 1) * totalHours : 0;

  // Gas travel cost:
  // Initial estimate trip: travelDistance * 2 * gasCost / 20
  // Work days travel: travelDistance * 2 * gasCost / 10 * installDays
  const gasTravelCost = (travelDistance * 2 * gasCost / 20) + (travelDistance * 2 * gasCost / 10 * installDays);

  // Labor: calculate based on installSchedule if available, otherwise use legacy method
  const laborCost = installSchedule && installSchedule.length > 0
    ? installSchedule.reduce((total, daySchedule) => {
        // Get laborers for this day and sum their costs
        const dayLaborers = laborers.filter(l => daySchedule.laborerIds.includes(l.id));
        const dayRate = dayLaborers.reduce((sum, l) => sum + l.fullyLoadedRate, 0);
        return total + (dayRate * daySchedule.hours);
      }, 0)
    : laborers.reduce((sum, laborer) => {
        return sum + (jobHours * laborer.fullyLoadedRate);
      }, 0);

  // Royalty cost: totalPrice * 0.05
  const royaltyCost = totalPrice * 0.05;

  // Total costs
  const totalCosts = chipCost + baseCost + topCost + consumablesCost + crackFillCost
    + cyclo1Cost + tintCost + antiSlipCost + abrasionResistanceCost
    + gasHeaterCost + gasTravelCost + gasGeneratorCost + royaltyCost + laborCost;

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

  // Use system-specific pricing, fallback to global pricing if not set
  const floorPriceMin = system.floorPriceMin ?? pricing.floorPriceMin ?? 6;
  const floorPriceMax = system.floorPriceMax ?? pricing.floorPriceMax ?? 8;

  // Suggested vertical price: verticalFootage * system-specific vertical price (fallback to global pricing)
  const verticalPricePerSqft = system.verticalPricePerSqft ?? pricing.verticalPricePerSqft;
  const suggestedVerticalPrice = verticalFootage * verticalPricePerSqft;

  // Suggested anti-slip price: floorFootage * pricing.antiSlipPricePerSqft (only if anti-slip is enabled)
  const suggestedAntiSlipPrice = antiSlip ? floorFootage * pricing.antiSlipPricePerSqft : 0;

  // Suggested abrasion resistance price: floorFootage * pricing.abrasionResistancePricePerSqft (only if abrasion resistance is enabled)
  const suggestedAbrasionResistancePrice = abrasionResistance ? floorFootage * pricing.abrasionResistancePricePerSqft : 0;

  // Suggested coating removal price: floorFootage * price per sqft based on removal type
  const suggestedCoatingRemovalPrice = coatingRemoval === 'Paint'
    ? floorFootage * pricing.coatingRemovalPaintPerSqft
    : coatingRemoval === 'Epoxy'
    ? floorFootage * pricing.coatingRemovalEpoxyPerSqft
    : 0;

  // Suggested moisture mitigation price: floorFootage * pricing.moistureMitigationPerSqft (only if enabled)
  const suggestedMoistureMitigationPrice = moistureMitigation ? floorFootage * pricing.moistureMitigationPerSqft : 0;

  // Calculate non-floor components (these are the same for both pricing approaches)
  const nonFloorComponents = suggestedCrackPrice + suggestedVerticalPrice
    + suggestedAntiSlipPrice + suggestedAbrasionResistancePrice
    + suggestedCoatingRemovalPrice + suggestedMoistureMitigationPrice + suggestedDiscount;

  // APPROACH 1: Current suggested pricing logic
  // Suggested floor price per sqft: min of ((totalCosts - suggestedDiscount - suggestedCrackPrice + 2000) / floorFootage) and max, with minimum of min
  const currentFloorPricePerSqft = floorFootage > 0
    ? Math.max(floorPriceMin, Math.min((totalCosts - suggestedDiscount - suggestedCrackPrice + 2000) / floorFootage, floorPriceMax))
    : 0;
  let currentFloorPrice = currentFloorPricePerSqft * floorFootage;
  let currentTotal = currentFloorPrice + nonFloorComponents;

  // APPROACH 2: Target effective price approach (if target is set)
  let targetFloorPricePerSqft = 0;
  let targetFloorPrice = 0;
  let targetTotal = 0;
  let targetMarginPct = 0;

  if (system.targetEffectivePricePerSqft && system.targetEffectivePricePerSqft > 0 && floorFootage > 0) {
    // Clamp target between min and max
    const clampedTarget = Math.max(floorPriceMin, Math.min(system.targetEffectivePricePerSqft, floorPriceMax));

    // Calculate target total: target effective price * floor footage
    targetTotal = clampedTarget * floorFootage;

    // Back-calculate floor price from target total
    targetFloorPrice = targetTotal - nonFloorComponents;
    targetFloorPricePerSqft = floorFootage > 0 ? targetFloorPrice / floorFootage : 0;

    // Calculate target margin percentage
    const targetMargin = targetTotal - totalCosts;
    targetMarginPct = targetTotal > 0 ? (targetMargin / targetTotal) * 100 : 0;
  }

  // Calculate current margin percentage
  const currentMargin = currentTotal - totalCosts;
  const currentMarginPct = currentTotal > 0 ? (currentMargin / currentTotal) * 100 : 0;

  // Choose the approach with higher margin percentage
  let useTargetPricing = false;
  if (system.targetEffectivePricePerSqft && system.targetEffectivePricePerSqft > 0 && floorFootage > 0) {
    useTargetPricing = targetMarginPct > currentMarginPct;
  }

  // Set initial values based on chosen approach
  let suggestedFloorPricePerSqft = useTargetPricing ? targetFloorPricePerSqft : currentFloorPricePerSqft;
  let suggestedFloorPrice = useTargetPricing ? targetFloorPrice : currentFloorPrice;
  let suggestedTotalRaw = useTargetPricing ? targetTotal : currentTotal;

  // If total is below minimum $2500, adjust floor price to meet minimum
  const MINIMUM_JOB_PRICE = 2500;

  if (suggestedTotalRaw < MINIMUM_JOB_PRICE && floorFootage > 0) {
    // Calculate how much we need to add to floor price to reach minimum
    const shortfall = MINIMUM_JOB_PRICE - suggestedTotalRaw;
    suggestedFloorPrice = suggestedFloorPrice + shortfall;
    suggestedFloorPricePerSqft = suggestedFloorPrice / floorFootage;
    suggestedTotalRaw = MINIMUM_JOB_PRICE;
  }

  const suggestedTotal = suggestedTotalRaw;

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
    antiSlipCost,
    abrasionResistanceCost,
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
    suggestedAntiSlipPrice,
    suggestedAbrasionResistancePrice,
    suggestedCoatingRemovalPrice,
    suggestedMoistureMitigationPrice,
    suggestedTotal,
    suggestedMargin,
    suggestedMarginPct,
  };
}
