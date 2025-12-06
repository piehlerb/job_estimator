import { ArrowLeft, Save } from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  getAllSystems,
  getAllPricingVariables,
  getJob,
  addJob,
  updateJob,
} from '../lib/db';
import { ChipSystem, PricingVariable, Job } from '../types';
import { calculateJobCosts, getCostInputsFromPricingVars, JobCalculation } from '../lib/calculations';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

interface JobFormProps {
  jobId?: string;
  onBack: () => void;
}

export default function JobForm({ jobId, onBack }: JobFormProps) {
  const [systems, setSystems] = useState<ChipSystem[]>([]);
  const [pricingVars, setPricingVars] = useState<PricingVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calculation, setCalculation] = useState<JobCalculation | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    system: '',
    floorFootage: '',
    verticalFootage: '',
    crackFillFactor: '0',
    installDays: '1',
    installDate: new Date().toISOString().split('T')[0],
    travelDistance: '',
    laborers: '2',
    totalPrice: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    calculateCosts();
  }, [formData, systems, pricingVars]);

  const loadData = async () => {
    setLoading(true);
    try {
      const allSystems = await getAllSystems();
      const allPricingVars = await getAllPricingVariables();
      setSystems(allSystems);
      setPricingVars(allPricingVars);

      if (jobId) {
        const job = await getJob(jobId);
        if (job) {
          setFormData({
            name: job.name,
            system: job.systemId,
            floorFootage: job.floorFootage.toString(),
            verticalFootage: job.verticalFootage.toString(),
            crackFillFactor: job.crackFillFactor.toString(),
            installDays: job.installDays.toString(),
            installDate: job.installDate,
            travelDistance: job.travelDistance.toString(),
            laborers: job.laborers.toString(),
            totalPrice: job.totalPrice.toString(),
          });
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Extract jobInputs for use in calculations
  const jobInputs = {
    floorFootage: parseFloat(formData.floorFootage) || 0,
    verticalFootage: parseFloat(formData.verticalFootage) || 0,
    crackFillFactor: parseFloat(formData.crackFillFactor) || 0,
    installDays: parseFloat(formData.installDays) || 1,
    installDate: formData.installDate,
    travelDistance: parseFloat(formData.travelDistance) || 0,
    laborers: parseFloat(formData.laborers) || 2,
    totalPrice: parseFloat(formData.totalPrice) || 0,
  };

  const calculateCosts = () => {
    const selectedSystem = systems.find((s) => s.id === formData.system) || null;
    const costInputs = getCostInputsFromPricingVars(pricingVars);

    const calc = calculateJobCosts(jobInputs, selectedSystem, costInputs);
    setCalculation(calc);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (!formData.name.trim() || !formData.system) {
        alert('Please fill in all required fields');
        setSaving(false);
        return;
      }

      const selectedSystem = systems.find((s) => s.id === formData.system);
      if (!selectedSystem) {
        alert('Please select a valid system');
        setSaving(false);
        return;
      }

      const costInputs = getCostInputsFromPricingVars(pricingVars);

      const job: Job = {
        id: jobId || generateId(),
        name: formData.name,
        systemId: formData.system,
        floorFootage: parseFloat(formData.floorFootage) || 0,
        verticalFootage: parseFloat(formData.verticalFootage) || 0,
        crackFillFactor: parseFloat(formData.crackFillFactor) || 0,
        installDays: parseFloat(formData.installDays) || 1,
        installDate: formData.installDate,
        travelDistance: parseFloat(formData.travelDistance) || 0,
        laborers: parseFloat(formData.laborers) || 2,
        totalPrice: parseFloat(formData.totalPrice) || 0,
        // Snapshot costs at time of job creation
        baseCostPerGal: costInputs.baseCostPerGal,
        topCostPerGal: costInputs.topCostPerGal,
        crackFillCostPerGal: costInputs.crackFillCostPerGal,
        gasCost: costInputs.gasCost,
        fullyLoadedEE: costInputs.fullyLoadedEE,
        consumablesCost: costInputs.consumablesCost,
        // Snapshot system at time of job creation
        systemSnapshot: {
          name: selectedSystem.name,
          feetPerLb: selectedSystem.feetPerLb,
          boxCost: selectedSystem.boxCost,
          baseSpread: selectedSystem.baseSpread,
          topSpread: selectedSystem.topSpread,
        },
        createdAt: jobId ? (await getJob(jobId))?.createdAt || new Date().toISOString() : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        synced: false,
      };

      if (jobId) {
        await updateJob(job);
      } else {
        await addJob(job);
      }

      onBack();
    } catch (error) {
      console.error('Error saving job:', error);
      alert('Error saving job. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft size={20} />
        <span className="font-medium">Back</span>
      </button>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">{jobId ? 'Edit Job' : 'Create New Job'}</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <label className="block text-sm font-semibold text-slate-900 mb-2">Job Name *</label>
              <input
                type="text"
                placeholder="e.g., Smith Residence - Kitchen"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Chip System *</label>
              <select
                value={formData.system}
                onChange={(e) => setFormData({ ...formData, system: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select a system...</option>
                {systems.map((sys) => (
                  <option key={sys.id} value={sys.id}>
                    {sys.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Floor Square Footage</label>
              <input
                type="number"
                step="0.01"
                placeholder="0"
                value={formData.floorFootage}
                onChange={(e) => setFormData({ ...formData, floorFootage: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Vertical Square Footage</label>
              <input
                type="number"
                step="0.01"
                placeholder="0"
                value={formData.verticalFootage}
                onChange={(e) => setFormData({ ...formData, verticalFootage: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Crack Fill Factor</label>
              <select
                value={formData.crackFillFactor}
                onChange={(e) => setFormData({ ...formData, crackFillFactor: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Install Days</label>
              <input
                type="number"
                step="1"
                min="1"
                placeholder="1"
                value={formData.installDays}
                onChange={(e) => setFormData({ ...formData, installDays: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Laborers</label>
              <input
                type="number"
                step="1"
                min="1"
                placeholder="2"
                value={formData.laborers}
                onChange={(e) => setFormData({ ...formData, laborers: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Install Date</label>
              <input
                type="date"
                value={formData.installDate}
                onChange={(e) => setFormData({ ...formData, installDate: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Travel Distance (miles)</label>
              <input
                type="number"
                step="0.1"
                placeholder="0"
                value={formData.travelDistance}
                onChange={(e) => setFormData({ ...formData, travelDistance: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Total Price ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.totalPrice}
                onChange={(e) => setFormData({ ...formData, totalPrice: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {calculation && (
            <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4 text-lg">Calculation Results</h3>

              <div className="space-y-6">
                {/* Current Job Metrics */}
                <div className="bg-white rounded-lg p-4 border border-slate-200">
                  <h4 className="font-semibold text-slate-700 mb-3">Current Job Metrics</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Price per sqft:</span>
                      <span className="font-medium">${calculation.pricePerSqft.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Total Costs:</span>
                      <span className="font-medium">${calculation.totalCosts.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Total Costs per sqft:</span>
                      <span className="font-medium">${calculation.totalCostsPerSqft.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm md:col-span-3">
                      <span className="text-slate-600 font-semibold">Job Margin:</span>
                      <span className={`font-semibold ${calculation.jobMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${calculation.jobMargin.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Material Needs */}
                <div className="bg-white rounded-lg p-4 border border-slate-200">
                  <h4 className="font-semibold text-slate-700 mb-3">Material Needs</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Chip Needed (boxes):</span>
                      <span className="font-medium">{calculation.chipNeeded}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Chip Cost:</span>
                      <span className="font-medium">${calculation.chipCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Base Gallons:</span>
                      <span className="font-medium">{calculation.baseGallons.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Base Cost:</span>
                      <span className="font-medium">${calculation.baseCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Top Gallons:</span>
                      <span className="font-medium">{calculation.topGallons.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Top Cost:</span>
                      <span className="font-medium">${calculation.topCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Crack Fill Gallons:</span>
                      <span className="font-medium">{calculation.crackFillGallons.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Crack Fill Cost:</span>
                      <span className="font-medium">${calculation.crackFillCost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Operating Costs */}
                <div className="bg-white rounded-lg p-4 border border-slate-200">
                  <h4 className="font-semibold text-slate-700 mb-3">Operating Costs</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Labor Cost:</span>
                      <span className="font-medium">${calculation.laborCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Consumables:</span>
                      <span className="font-medium">${calculation.consumablesCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Gas Generator:</span>
                      <span className="font-medium">${calculation.gasGeneratorCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Gas Heater:</span>
                      <span className="font-medium">${calculation.gasHeaterCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Gas Travel:</span>
                      <span className="font-medium">${calculation.gasTravelCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Royalty (5%):</span>
                      <span className="font-medium">${calculation.royaltyCost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Suggested Pricing */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                  <h4 className="font-semibold text-slate-900 mb-3">Suggested Pricing</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-700">Suggested Discount:</span>
                      <span className="font-medium">${calculation.suggestedDiscount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-700">Suggested Crack Price:</span>
                      <span className="font-medium">${calculation.suggestedCrackPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-700">Suggested Floor Price/sqft:</span>
                      <span className="font-medium">${calculation.suggestedFloorPricePerSqft.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-700">Suggested Vertical Price:</span>
                      <span className="font-medium">${calculation.suggestedVerticalPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm md:col-span-2 pt-2 border-t border-blue-300">
                      <span className="text-slate-900 font-semibold text-base">Suggested Total:</span>
                      <span className="font-bold text-blue-600 text-base">${calculation.suggestedTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-700">Suggested Margin:</span>
                      <span className="font-medium text-green-600">${calculation.suggestedMargin.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-700">Suggested Margin %:</span>
                      <span className="font-medium text-green-600">{calculation.suggestedMarginPct.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                {/* What If Analysis */}
                <div className="bg-white rounded-lg p-4 border border-slate-200">
                  <h4 className="font-semibold text-slate-700 mb-3">What If Analysis - Job Margin Impact</h4>
                  <p className="text-xs text-slate-600 mb-3">Shows the change in margin compared to current configuration</p>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="border border-slate-300 p-2 bg-slate-100 text-sm font-semibold"></th>
                          <th className="border border-slate-300 p-2 bg-slate-100 text-sm font-semibold">1 Day</th>
                          <th className="border border-slate-300 p-2 bg-slate-100 text-sm font-semibold">2 Days</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-slate-300 p-2 bg-slate-100 text-sm font-semibold">2 Laborers</td>
                          {(() => {
                            const altCalc = calculateJobCosts(
                              {
                                ...jobInputs,
                                installDays: 1,
                                laborers: 2,
                              },
                              systems.find((s) => s.id === formData.system) || null,
                              getCostInputsFromPricingVars(pricingVars)
                            );
                            const diff = altCalc.jobMargin - calculation.jobMargin;
                            const bgColor = diff > 0 ? 'bg-green-100' : diff < 0 ? 'bg-red-100' : 'bg-slate-100';
                            const textColor = diff > 0 ? 'text-green-700' : diff < 0 ? 'text-red-700' : 'text-slate-700';
                            return (
                              <td className={`border border-slate-300 p-2 text-center ${bgColor}`}>
                                <span className={`font-semibold text-sm ${textColor}`}>
                                  {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                                </span>
                              </td>
                            );
                          })()}
                          {(() => {
                            const altCalc = calculateJobCosts(
                              {
                                ...jobInputs,
                                installDays: 2,
                                laborers: 2,
                              },
                              systems.find((s) => s.id === formData.system) || null,
                              getCostInputsFromPricingVars(pricingVars)
                            );
                            const diff = altCalc.jobMargin - calculation.jobMargin;
                            const bgColor = diff > 0 ? 'bg-green-100' : diff < 0 ? 'bg-red-100' : 'bg-slate-100';
                            const textColor = diff > 0 ? 'text-green-700' : diff < 0 ? 'text-red-700' : 'text-slate-700';
                            return (
                              <td className={`border border-slate-300 p-2 text-center ${bgColor}`}>
                                <span className={`font-semibold text-sm ${textColor}`}>
                                  {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                                </span>
                              </td>
                            );
                          })()}
                        </tr>
                        <tr>
                          <td className="border border-slate-300 p-2 bg-slate-100 text-sm font-semibold">3 Laborers</td>
                          {(() => {
                            const altCalc = calculateJobCosts(
                              {
                                ...jobInputs,
                                installDays: 1,
                                laborers: 3,
                              },
                              systems.find((s) => s.id === formData.system) || null,
                              getCostInputsFromPricingVars(pricingVars)
                            );
                            const diff = altCalc.jobMargin - calculation.jobMargin;
                            const bgColor = diff > 0 ? 'bg-green-100' : diff < 0 ? 'bg-red-100' : 'bg-slate-100';
                            const textColor = diff > 0 ? 'text-green-700' : diff < 0 ? 'text-red-700' : 'text-slate-700';
                            return (
                              <td className={`border border-slate-300 p-2 text-center ${bgColor}`}>
                                <span className={`font-semibold text-sm ${textColor}`}>
                                  {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                                </span>
                              </td>
                            );
                          })()}
                          {(() => {
                            const altCalc = calculateJobCosts(
                              {
                                ...jobInputs,
                                installDays: 2,
                                laborers: 3,
                              },
                              systems.find((s) => s.id === formData.system) || null,
                              getCostInputsFromPricingVars(pricingVars)
                            );
                            const diff = altCalc.jobMargin - calculation.jobMargin;
                            const bgColor = diff > 0 ? 'bg-green-100' : diff < 0 ? 'bg-red-100' : 'bg-slate-100';
                            const textColor = diff > 0 ? 'text-green-700' : diff < 0 ? 'text-red-700' : 'text-slate-700';
                            return (
                              <td className={`border border-slate-300 p-2 text-center ${bgColor}`}>
                                <span className={`font-semibold text-sm ${textColor}`}>
                                  {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                                </span>
                              </td>
                            );
                          })()}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              <Save size={20} />
              {saving ? 'Saving...' : jobId ? 'Update Job' : 'Create Job'}
            </button>
            <button
              type="button"
              onClick={onBack}
              disabled={saving}
              className="px-6 py-3 bg-slate-200 text-slate-900 rounded-lg font-semibold hover:bg-slate-300 active:bg-slate-400 transition-colors disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
