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
import { calculateJobCosts, getDefaultHourlyRate, JobCalculation } from '../lib/calculations';

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
    crackFillFactor: '1',
    materialCost: '0',
    laborHours: '0',
    gasExpense: '0',
    royaltyPercent: '0',
    seasonalAdjustment: '0',
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
            materialCost: job.materialCost.toString(),
            laborHours: job.laborHours.toString(),
            gasExpense: job.gasExpense.toString(),
            royaltyPercent: job.royaltyPercent.toString(),
            seasonalAdjustment: job.seasonalAdjustment.toString(),
          });
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateCosts = () => {
    const selectedSystem = systems.find((s) => s.id === formData.system) || null;
    const hourlyRate = getDefaultHourlyRate(pricingVars);

    const jobData = {
      floorFootage: parseFloat(formData.floorFootage) || 0,
      verticalFootage: parseFloat(formData.verticalFootage) || 0,
      crackFillFactor: parseFloat(formData.crackFillFactor) || 1,
      materialCost: parseFloat(formData.materialCost) || 0,
      laborHours: parseFloat(formData.laborHours) || 0,
      gasExpense: parseFloat(formData.gasExpense) || 0,
      royaltyPercent: parseFloat(formData.royaltyPercent) || 0,
      seasonalAdjustment: parseFloat(formData.seasonalAdjustment) || 0,
    };

    const calc = calculateJobCosts(jobData, selectedSystem, hourlyRate);
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

      const job: Job = {
        id: jobId || generateId(),
        name: formData.name,
        systemId: formData.system,
        floorFootage: parseFloat(formData.floorFootage) || 0,
        verticalFootage: parseFloat(formData.verticalFootage) || 0,
        crackFillFactor: parseFloat(formData.crackFillFactor) || 1,
        materialCost: parseFloat(formData.materialCost) || 0,
        laborHours: parseFloat(formData.laborHours) || 0,
        gasExpense: parseFloat(formData.gasExpense) || 0,
        royaltyPercent: parseFloat(formData.royaltyPercent) || 0,
        seasonalAdjustment: parseFloat(formData.seasonalAdjustment) || 0,
        totalCost: calculation?.totalCost || 0,
        suggestedPrice: calculation?.suggestedPrice || 0,
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
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Job Name</label>
              <input
                type="text"
                placeholder="e.g., Smith Residence - Kitchen"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Chip System</label>
              <select
                value={formData.system}
                onChange={(e) => setFormData({ ...formData, system: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <label className="block text-sm font-semibold text-slate-900 mb-2">Floor Footage</label>
              <input
                type="number"
                placeholder="0"
                value={formData.floorFootage}
                onChange={(e) => setFormData({ ...formData, floorFootage: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Vertical Footage</label>
              <input
                type="number"
                placeholder="0"
                value={formData.verticalFootage}
                onChange={(e) => setFormData({ ...formData, verticalFootage: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Crack Fill Factor</label>
              <input
                type="number"
                step="0.1"
                placeholder="1"
                value={formData.crackFillFactor}
                onChange={(e) => setFormData({ ...formData, crackFillFactor: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Material Cost</label>
              <input
                type="number"
                placeholder="0"
                value={formData.materialCost}
                onChange={(e) => setFormData({ ...formData, materialCost: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Labor Hours</label>
              <input
                type="number"
                placeholder="0"
                value={formData.laborHours}
                onChange={(e) => setFormData({ ...formData, laborHours: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Gas Expense</label>
              <input
                type="number"
                placeholder="0"
                value={formData.gasExpense}
                onChange={(e) => setFormData({ ...formData, gasExpense: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Royalty %</label>
              <input
                type="number"
                placeholder="0"
                value={formData.royaltyPercent}
                onChange={(e) => setFormData({ ...formData, royaltyPercent: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Seasonal Adjustment %</label>
              <input
                type="number"
                placeholder="0"
                value={formData.seasonalAdjustment}
                onChange={(e) => setFormData({ ...formData, seasonalAdjustment: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {calculation && (
            <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">Calculation Preview</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Chip Cost:</span>
                    <span className="font-medium">${calculation.chipCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Install Cost:</span>
                    <span className="font-medium">${calculation.installCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Labor Cost:</span>
                    <span className="font-medium">${calculation.laborCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Gas Expense:</span>
                    <span className="font-medium">${calculation.gasExpense.toFixed(2)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Royalty:</span>
                    <span className="font-medium">${calculation.royaltyAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Seasonal Adj:</span>
                    <span className="font-medium">${calculation.seasonalAdjustmentAmount.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-slate-300 pt-2">
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-slate-900">Total Cost:</span>
                      <span className="text-slate-900">${calculation.totalCost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Suggested Price</p>
                    <p className="text-3xl font-bold text-green-600">${calculation.suggestedPrice.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Profit Margin</p>
                    <p className="text-3xl font-bold text-blue-600">${calculation.margin.toFixed(2)}</p>
                    <p className="text-sm text-slate-500 mt-1">({calculation.marginPercent.toFixed(1)}%)</p>
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
