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

  // Chip needed: apply vertical usage factor, then convert using system feetPerLb and 40lb boxes
  const chipVerticalUsageFactor = pricing.chipVerticalUsageFactor ?? 1.1;
  const chipNeededRaw = feetPerLb > 0
    ? (floorFootage + (verticalFootage * chipVerticalUsageFactor)) / feetPerLb / 40
    : 0;
  const chipNeeded = Math.ceil(chipNeededRaw);

  // Chip cost
  const chipCost = chipNeeded * boxCost;

  const verticalSpreadUsageMultiplier = pricing.verticalSpreadUsageMultiplier ?? 1.25;

  // Base gallons: floor / baseSpread + (vertical / baseSpread) * vertical spread usage multiplier
  const baseGallons = baseSpread > 0
    ? (floorFootage / baseSpread) + ((verticalFootage / baseSpread) * verticalSpreadUsageMultiplier)
    : 0;

  // Base cost
  const baseCost = baseGallons * baseCostPerGal;

  // Top gallons: floor / topSpread + (vertical / topSpread) * vertical spread usage multiplier
  // If double broadcast, multiply by 2
  const baseTopGallons = topSpread > 0
    ? (floorFootage / topSpread) + ((verticalFootage / topSpread) * verticalSpreadUsageMultiplier)
    : 0;
  const topGallons = system.doubleBroadcast ? baseTopGallons * 2 : baseTopGallons;

  // Top cost
  const topCost = topGallons * topCostPerGal;

  // Crack fill gallons: crackFillFactor / crackFillFactorUnitsPerGallon
  const crackFillFactorUnitsPerGallon = pricing.crackFillFactorUnitsPerGallon ?? 5;
  const crackFillGallons = crackFillFactorUnitsPerGallon > 0
    ? crackFillFactor / crackFillFactorUnitsPerGallon
    : 0;

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
  const gasHeaterMonths = pricing.gasHeaterMonths && pricing.gasHeaterMonths.length > 0
    ? pricing.gasHeaterMonths
    : [11, 12, 1, 2, 3];
  const installMonth = installDate ? new Date(installDate).getMonth() + 1 : 0;
  const isWinterMonth = gasHeaterMonths.includes(installMonth);
  const gasHeaterCost = isWinterMonth ? (gasCost + 1) * totalHours : 0;

  // Gas travel cost:
  // Uses configurable MPG and accounts for 1 estimate round trip + install-day round trips
  const travelGasMpg = pricing.travelGasMpg ?? 10;
  const roundTripMiles = travelDistance * 2;
  const travelGasCostPerRoundTrip = travelGasMpg > 0 ? (roundTripMiles * gasCost / travelGasMpg) : 0;
  const gasTravelCost = travelGasCostPerRoundTrip * (installDays + 1);

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

  // Suggested discount: floorFootage * -1, optionally capped by settings
  const useSuggestedDiscountCap = pricing.useSuggestedDiscountCap ?? true;
  const suggestedDiscountCapSqft = pricing.suggestedDiscountCapSqft ?? 500;
  const cappedFloor = useSuggestedDiscountCap ? Math.min(floorFootage, suggestedDiscountCapSqft) : floorFootage;
  const suggestedDiscount = cappedFloor * -1;

  // Suggested crack price: crackFillCost * configurable multiplier
  const crackFillPriceMultiplier = pricing.suggestedCrackFillPriceMultiplier ?? 3;
  const suggestedCrackPrice = crackFillCost * crackFillPriceMultiplier;

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

  // Suggested floor price per sqft: min of ((totalCosts - suggestedDiscount - suggestedCrackPrice + margin) / floorFootage) and max, with minimum of min
  const minimumMarginBuffer = pricing.minimumMarginBuffer ?? 2000;
  let suggestedFloorPricePerSqft = floorFootage > 0
    ? Math.max(floorPriceMin, Math.min((totalCosts - suggestedDiscount - suggestedCrackPrice + minimumMarginBuffer) / floorFootage, floorPriceMax))
    : 0;
  let suggestedFloorPrice = suggestedFloorPricePerSqft * floorFootage;
  let suggestedTotalRaw = suggestedFloorPrice + nonFloorComponents;

  // If total is below minimum, adjust floor price to meet minimum
  const MINIMUM_JOB_PRICE = pricing.minimumJobPrice ?? 2500;

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

  // Suggested effective price per sqft (total / floor footage)
  const suggestedEffectivePricePerSqft = floorFootage > 0 ? suggestedTotal / floorFootage : 0;

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
    suggestedEffectivePricePerSqft,
  };
}
