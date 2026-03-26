import { ChipSystem, Costs, Laborer, JobCalculation, InstallDaySchedule, ActualDaySchedule, ActualCosts, Pricing, CoatingRemovalType } from '../types';

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
  cyclo1Coats?: number; // Additional job-level cyclo1 coats
  coatingRemoval: CoatingRemovalType;
  moistureMitigation: boolean;
  disableGasHeater?: boolean;
  installSchedule?: InstallDaySchedule[]; // Optional per-day schedule
  tags?: string[]; // Job tags, used for tag-based discount calculation
}

/**
 * Computes the suggested discount (as a negative dollar amount) based on
 * pricing.discountConfig. Falls back to legacy useSuggestedDiscountCap /
 * suggestedDiscountCapSqft fields if discountConfig is absent.
 */
function computeSuggestedDiscount(
  floorFootage: number,
  tags: string[] | undefined,
  pricing: Pricing
): number {
  const config = pricing.discountConfig;

  if (!config) {
    // Backward compat: use legacy fields
    const useCap = pricing.useSuggestedDiscountCap ?? true;
    const capSqft = pricing.suggestedDiscountCapSqft ?? 500;
    const cappedFloor = useCap ? Math.min(floorFootage, capSqft) : floorFootage;
    return cappedFloor * -1;
  }

  if (config.mode === 'none') return 0;

  if (config.mode === 'per_sqft') {
    const amount = config.perSqftAmount ?? 1;
    const maxSqft = config.perSqftMaxSqft ?? 500;
    const effectiveSqft = maxSqft > 0 ? Math.min(floorFootage, maxSqft) : floorFootage;
    return effectiveSqft * amount * -1;
  }

  if (config.mode === 'by_tag') {
    const tagDiscounts = config.tagDiscounts ?? [];
    const jobTags = tags ?? [];
    const matchingAmounts = tagDiscounts
      .filter(td => jobTags.includes(td.tag))
      .map(td => td.amount);
    if (matchingAmounts.length === 0) return 0;
    const aggregation = config.tagAggregation ?? 'sum';
    const total = aggregation === 'sum'
      ? matchingAmounts.reduce((sum, d) => sum + d, 0)
      : Math.max(...matchingAmounts);
    return total * -1;
  }

  return 0;
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
    coatingRemoval,
    moistureMitigation,
    installSchedule,
    disableGasHeater,
  } = inputs;

  const {
    feetPerLb,
    boxCost,
    baseSpread,
    baseCoats,
    topSpread,
    topCoats,
    cyclo1Spread,
    cyclo1Coats,
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
    moistureMitigationCostPerGal = 0,
    moistureMitigationSpreadRate = 200,
  } = costs;

  // Price per sqft
  const pricePerSqft = floorFootage > 0 ? totalPrice / floorFootage : 0;

  // Chip needed:
  // 1) Compute pounds from total adjusted sqft / feetPerLb
  // 2) Round pounds up to the nearest 40 lbs (full box)
  // Backward compatibility: older data may have stored feet-per-box instead of feet-per-lb.
  const chipVerticalUsageFactor = pricing.chipVerticalUsageFactor ?? 1.1;
  const adjustedChipSqft = floorFootage + (verticalFootage * chipVerticalUsageFactor);
  const normalizedFeetPerLb = feetPerLb > 25 ? feetPerLb / 40 : feetPerLb;
  const chipPoundsNeeded = normalizedFeetPerLb > 0
    ? adjustedChipSqft / normalizedFeetPerLb
    : 0;
  const chipNeeded = Math.ceil(chipPoundsNeeded / 40);

  // Chip cost
  const chipCost = chipNeeded * boxCost;

  const verticalSpreadUsageMultiplier = pricing.verticalSpreadUsageMultiplier ?? 1.25;

  // Base gallons: floor / baseSpread + (vertical / baseSpread) * vertical spread usage multiplier
  const normalizedBaseCoats = Math.max(baseCoats ?? 1, 0);
  const baseGallons = baseSpread > 0
    ? ((floorFootage / baseSpread) + ((verticalFootage / baseSpread) * verticalSpreadUsageMultiplier)) * normalizedBaseCoats
    : 0;

  // Base cost
  const baseCost = baseGallons * baseCostPerGal;

  // Top gallons: spread-based gallons multiplied by configured top coats
  const legacyDoubleBroadcast = (system as unknown as { doubleBroadcast?: boolean }).doubleBroadcast;
  const normalizedTopCoats = Math.max(topCoats ?? (legacyDoubleBroadcast ? 2 : 1), 0);
  const topGallons = topSpread > 0
    ? ((floorFootage / topSpread) + ((verticalFootage / topSpread) * verticalSpreadUsageMultiplier)) * normalizedTopCoats
    : 0;

  // Top cost
  const topCost = topGallons * topCostPerGal;

  // Crack fill gallons: crackFillFactor / crackFillFactorUnitsPerGallon
  const crackFillFactorUnitsPerGallon = pricing.crackFillFactorUnitsPerGallon ?? 5;
  const crackFillGallons = crackFillFactorUnitsPerGallon > 0
    ? crackFillFactor / crackFillFactorUnitsPerGallon
    : 0;

  // Crack fill cost
  const crackFillCost = crackFillGallons * crackFillCostPerGal;

  // Cyclo1 needed:
  // - System coats always apply (set system cyclo1Coats to 0 to disable by default)
  // - Job-level coats are additive only when cyclo1Topcoat is explicitly enabled on the job
  const additionalCyclo1Coats = cyclo1Topcoat ? Math.max(inputs.cyclo1Coats ?? 0, 0) : 0;
  const normalizedCyclo1Coats = Math.max((cyclo1Coats ?? 1) + additionalCyclo1Coats, 0);
  const cyclo1Needed = cyclo1Spread > 0 && normalizedCyclo1Coats > 0
    ? (floorFootage / cyclo1Spread) * normalizedCyclo1Coats
    : 0;

  // Cyclo1 cost: cyclo1Needed * cyclo1CostPerGal (only calculate if cyclo1 is needed)
  const cyclo1Cost = cyclo1Needed > 0 ? cyclo1Needed * cyclo1CostPerGal : 0;

  // Anti-slip cost: based on topcoat gallons (if anti-slip is enabled)
  const antiSlipCost = antiSlip ? topGallons * antiSlipCostPerGal : 0;

  // Abrasion resistance cost: based on cyclo1 gallons (if abrasion resistance is enabled)
  const abrasionResistanceCost = abrasionResistance ? cyclo1Needed * abrasionResistanceCostPerGal : 0;

  // Moisture mitigation material: gallons needed based on spread rate, cost based on cost per gallon
  const moistureMitigationGallons = moistureMitigation && moistureMitigationSpreadRate > 0
    ? Math.ceil(floorFootage / moistureMitigationSpreadRate)
    : 0;
  const moistureMitigationMaterialCost = moistureMitigationGallons * moistureMitigationCostPerGal;

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

  const gasGeneratorGallonsPerHour = pricing.gasGeneratorGallonsPerHour ?? 1.2;
  const gasHeaterGallonsPerHour = pricing.gasHeaterGallonsPerHour ?? 1;

  // Gas generator cost: gasCost * generator gallons/hour * totalHours
  const gasGeneratorCost = gasCost * gasGeneratorGallonsPerHour * totalHours;

  // Gas heater cost: if install month is 11, 12, 1, 2, 3 then gasCost * heater gallons/hour * totalHours, else 0
  const gasHeaterMonths = pricing.gasHeaterMonths && pricing.gasHeaterMonths.length > 0
    ? pricing.gasHeaterMonths
    : [11, 12, 1, 2, 3];
  const installMonth = installDate ? new Date(installDate).getMonth() + 1 : 0;
  const isWinterMonth = gasHeaterMonths.includes(installMonth);
  const gasHeaterCost = !disableGasHeater && isWinterMonth
    ? gasCost * gasHeaterGallonsPerHour * totalHours
    : 0;

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
    + cyclo1Cost + tintCost + antiSlipCost + abrasionResistanceCost + moistureMitigationMaterialCost
    + gasHeaterCost + gasTravelCost + gasGeneratorCost + royaltyCost + laborCost;

  // Total costs per sqft
  const totalCostsPerSqft = floorFootage > 0 ? totalCosts / floorFootage : 0;

  // Job margin
  const jobMargin = totalPrice - totalCosts;

  // Margin per day: (totalPrice - totalCosts) / installDays
  const marginPerDay = installDays > 0 ? jobMargin / installDays : 0;

  // Suggested discount: determined by pricing.discountConfig (or legacy fields)
  const suggestedDiscount = computeSuggestedDiscount(floorFootage, inputs.tags, pricing);

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
    moistureMitigationGallons,
    moistureMitigationMaterialCost,
    suggestedMoistureMitigationPrice,
    suggestedTotal,
    suggestedMargin,
    suggestedMarginPct,
    suggestedEffectivePricePerSqft,
  };
}

interface ActualCostParams {
  actualSchedule: ActualDaySchedule[];
  actualBaseCoatGallons: number;
  actualTopCoatGallons: number;
  actualCyclo1Gallons: number;
  actualTintOz: number;
  actualChipBoxes: number;
  actualCrackRepairOz: number;
  chipBoxCost: number;
  totalPrice: number;
  installDays: number;
  installDate: string;
  travelDistance: number;
  disableGasHeater?: boolean;
}

export function calculateActualCosts(
  params: ActualCostParams,
  costs: Costs,
  pricing: Pricing,
  laborers: Laborer[]
): ActualCosts {
  const {
    actualSchedule,
    actualBaseCoatGallons,
    actualTopCoatGallons,
    actualCyclo1Gallons,
    actualTintOz,
    actualChipBoxes,
    actualCrackRepairOz,
    chipBoxCost,
    totalPrice,
    installDays,
    installDate,
    travelDistance,
    disableGasHeater,
  } = params;

  const {
    baseCostPerGal,
    topCostPerGal,
    crackFillCost: crackFillCostPerGal,
    gasCost,
    consumablesCost,
    cyclo1CostPerGal,
    tintCostPerQuart,
  } = costs;

  const actualChipCost = actualChipBoxes * chipBoxCost;
  const actualBaseCost = actualBaseCoatGallons * baseCostPerGal;
  const actualTopCost = actualTopCoatGallons * topCostPerGal;
  const actualCyclo1Cost = actualCyclo1Gallons * cyclo1CostPerGal;
  const actualTintCost = actualTintOz > 0 ? (actualTintOz / 32) * tintCostPerQuart : 0;
  const actualCrackRepairCost = actualCrackRepairOz > 0 ? (actualCrackRepairOz / 128) * crackFillCostPerGal : 0;

  const actualTotalHours = actualSchedule.reduce((sum, day) => sum + day.hours, 0);

  const gasGeneratorGallonsPerHour = pricing.gasGeneratorGallonsPerHour ?? 1.2;
  const gasHeaterGallonsPerHour = pricing.gasHeaterGallonsPerHour ?? 1;

  const actualGasGeneratorCost = gasCost * gasGeneratorGallonsPerHour * actualTotalHours;

  const gasHeaterMonths = pricing.gasHeaterMonths && pricing.gasHeaterMonths.length > 0
    ? pricing.gasHeaterMonths
    : [11, 12, 1, 2, 3];
  const installMonth = installDate ? new Date(installDate).getMonth() + 1 : 0;
  const isWinterMonth = gasHeaterMonths.includes(installMonth);
  const actualGasHeaterCost = !disableGasHeater && isWinterMonth
    ? gasCost * gasHeaterGallonsPerHour * actualTotalHours
    : 0;

  const travelGasMpg = pricing.travelGasMpg ?? 10;
  const roundTripMiles = travelDistance * 2;
  const travelGasCostPerRoundTrip = travelGasMpg > 0 ? (roundTripMiles * gasCost / travelGasMpg) : 0;
  const actualGasTravelCost = travelGasCostPerRoundTrip * (installDays + 1);

  const actualLaborCost = actualSchedule.reduce((total, daySchedule) => {
    const dayLaborers = laborers.filter(l => daySchedule.laborerIds.includes(l.id));
    const dayRate = dayLaborers.reduce((sum, l) => sum + l.fullyLoadedRate, 0);
    return total + (dayRate * daySchedule.hours);
  }, 0);

  const actualConsumablesCost = consumablesCost;
  const actualRoyaltyCost = totalPrice * 0.05;

  const actualTotalCosts = actualChipCost + actualBaseCost + actualTopCost + actualCyclo1Cost
    + actualTintCost + actualCrackRepairCost + actualGasGeneratorCost + actualGasHeaterCost + actualGasTravelCost
    + actualLaborCost + actualConsumablesCost + actualRoyaltyCost;

  const actualMargin = totalPrice - actualTotalCosts;
  const actualMarginPct = totalPrice > 0 ? (actualMargin / totalPrice) * 100 : 0;

  return {
    actualChipCost,
    actualBaseCost,
    actualTopCost,
    actualCyclo1Cost,
    actualTintCost,
    actualCrackRepairCost,
    actualGasGeneratorCost,
    actualGasHeaterCost,
    actualGasTravelCost,
    actualLaborCost,
    actualConsumablesCost,
    actualRoyaltyCost,
    actualTotalCosts,
    actualTotalHours,
    actualMargin,
    actualMarginPct,
  };
}
