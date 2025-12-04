import { ChipSystem, PricingVariable, Job } from '../types';

export interface JobCalculation {
  chipCost: number;
  installCost: number;
  laborCost: number;
  materialCost: number;
  gasExpense: number;
  royaltyAmount: number;
  seasonalAdjustmentAmount: number;
  totalCost: number;
  suggestedPrice: number;
  margin: number;
  marginPercent: number;
}

export function calculateJobCosts(
  job: Partial<Job>,
  system: ChipSystem | null,
  hourlyRate: number
): JobCalculation {
  const floorFootage = job.floorFootage || 0;
  const verticalFootage = job.verticalFootage || 0;
  const crackFillFactor = job.crackFillFactor || 1;
  const materialCost = job.materialCost || 0;
  const laborHours = job.laborHours || 0;
  const gasExpense = job.gasExpense || 0;
  const royaltyPercent = job.royaltyPercent || 0;
  const seasonalAdjustment = job.seasonalAdjustment || 0;

  // Chip and install costs based on system and footage
  const totalFootage = floorFootage + verticalFootage;
  const chipCost = system ? totalFootage * system.chipPrice * crackFillFactor : 0;
  const installCost = system ? totalFootage * system.installPrice : 0;

  // Labor cost
  const laborCost = laborHours * hourlyRate;

  // Subtotal before adjustments
  const subtotal = chipCost + installCost + laborCost + materialCost + gasExpense;

  // Royalty on subtotal
  const royaltyAmount = (subtotal * royaltyPercent) / 100;

  // Total cost before seasonal adjustment
  const costBeforeAdjustment = subtotal + royaltyAmount;

  // Seasonal adjustment (as percentage)
  const seasonalAdjustmentAmount = (costBeforeAdjustment * seasonalAdjustment) / 100;

  // Final total cost
  const totalCost = costBeforeAdjustment + seasonalAdjustmentAmount;

  // Suggested price: cost + 40% markup
  const suggestedPrice = totalCost * 1.4;

  // Margin
  const margin = suggestedPrice - totalCost;
  const marginPercent = suggestedPrice > 0 ? (margin / suggestedPrice) * 100 : 0;

  return {
    chipCost,
    installCost,
    laborCost,
    materialCost,
    gasExpense,
    royaltyAmount,
    seasonalAdjustmentAmount,
    totalCost,
    suggestedPrice,
    margin,
    marginPercent,
  };
}

export function getDefaultHourlyRate(pricingVars: PricingVariable[]): number {
  const rateVar = pricingVars.find(
    (v) => v.name.toLowerCase().includes('hourly') || v.name.toLowerCase().includes('rate')
  );
  return rateVar ? rateVar.value : 50;
}
