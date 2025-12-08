import { ArrowLeft, Save } from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  getAllSystems,
  getJob,
  addJob,
  updateJob,
  getCosts,
  getDefaultCosts,
  getActiveLaborers,
  getAllChipBlends,
  addChipBlend,
  ChipBlend,
} from '../lib/db';
import { BaseColor, ChipSystem, Costs, Job, JobCalculation, JobStatus, Laborer } from '../types';
import { calculateJobOutputs } from '../lib/calculations';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

interface JobFormProps {
  jobId?: string;
  onBack: () => void;
}

export default function JobForm({ jobId, onBack }: JobFormProps) {
  const [systems, setSystems] = useState<ChipSystem[]>([]);
  const [costs, setCosts] = useState<Costs>(getDefaultCosts());
  const [activeLaborers, setActiveLaborers] = useState<Laborer[]>([]);
  const [selectedLaborerIds, setSelectedLaborerIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calculation, setCalculation] = useState<JobCalculation | null>(null);
  const [existingJob, setExistingJob] = useState<Job | null>(null);
  const [chipBlends, setChipBlends] = useState<ChipBlend[]>([]);
  const [chipBlendInput, setChipBlendInput] = useState('');
  const [showBlendDropdown, setShowBlendDropdown] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    system: '',
    floorFootage: '',
    verticalFootage: '',
    crackFillFactor: '1',
    travelDistance: '0',
    installDate: '',
    installDays: '1',
    jobHours: '10',
    totalPrice: '0',
    chipBlend: '',
    baseColor: '' as BaseColor | '',
    status: 'Pending' as JobStatus,
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    calculateCosts();
  }, [formData, systems, costs, selectedLaborerIds, activeLaborers]);

  const loadData = async () => {
    setLoading(true);
    try {
      const allSystems = await getAllSystems();
      const storedCosts = await getCosts();
      const laborers = await getActiveLaborers();
      const blends = await getAllChipBlends();
      setSystems(allSystems);
      setActiveLaborers(laborers);
      setChipBlends(blends);
      if (storedCosts) {
        setCosts(storedCosts);
      }

      if (jobId) {
        const job = await getJob(jobId);
        if (job) {
          setExistingJob(job);
          setFormData({
            name: job.name,
            system: job.systemId,
            floorFootage: job.floorFootage.toString(),
            verticalFootage: job.verticalFootage.toString(),
            crackFillFactor: job.crackFillFactor.toString(),
            travelDistance: job.travelDistance.toString(),
            installDate: job.installDate,
            installDays: job.installDays.toString(),
            jobHours: job.jobHours.toString(),
            totalPrice: job.totalPrice.toString(),
            chipBlend: job.chipBlend || '',
            baseColor: job.baseColor || '',
            status: job.status || 'Pending',
          });
          setChipBlendInput(job.chipBlend || '');
          // Set selected laborers from snapshot
          setSelectedLaborerIds(job.laborersSnapshot.map((l) => l.id));
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSelectedLaborers = (): Laborer[] => {
    // Get laborers from active list by selected IDs
    // For existing jobs, also include any snapshot laborers that may no longer be active
    const fromActive = activeLaborers.filter((l) => selectedLaborerIds.includes(l.id));

    if (existingJob) {
      // Include snapshot laborers that are selected but not in active list
      const activeIds = activeLaborers.map((l) => l.id);
      const fromSnapshot = existingJob.laborersSnapshot.filter(
        (l) => selectedLaborerIds.includes(l.id) && !activeIds.includes(l.id)
      );
      return [...fromActive, ...fromSnapshot];
    }

    return fromActive;
  };

  const calculateCosts = () => {
    const selectedSystem = systems.find((s) => s.id === formData.system);
    if (!selectedSystem) {
      setCalculation(null);
      return;
    }

    // Use snapshot costs if editing existing job, otherwise use current costs
    const costsToUse = existingJob ? existingJob.costsSnapshot : costs;
    const systemToUse = existingJob ? existingJob.systemSnapshot : selectedSystem;
    const laborersToUse = getSelectedLaborers();

    const inputs = {
      floorFootage: parseFloat(formData.floorFootage) || 0,
      verticalFootage: parseFloat(formData.verticalFootage) || 0,
      crackFillFactor: parseFloat(formData.crackFillFactor) || 1,
      travelDistance: parseFloat(formData.travelDistance) || 0,
      installDate: formData.installDate,
      installDays: parseFloat(formData.installDays) || 1,
      jobHours: parseFloat(formData.jobHours) || 10,
      totalPrice: parseFloat(formData.totalPrice) || 0,
    };

    const calc = calculateJobOutputs(inputs, systemToUse, costsToUse, laborersToUse);
    setCalculation(calc);
  };

  const handleLaborerToggle = (laborerId: string) => {
    setSelectedLaborerIds((prev) =>
      prev.includes(laborerId)
        ? prev.filter((id) => id !== laborerId)
        : [...prev, laborerId]
    );
  };

  const handleChipBlendSelect = (blendName: string) => {
    setChipBlendInput(blendName);
    setFormData({ ...formData, chipBlend: blendName });
    setShowBlendDropdown(false);
  };

  const handleChipBlendInputChange = (value: string) => {
    setChipBlendInput(value);
    setFormData({ ...formData, chipBlend: value });
    setShowBlendDropdown(true);
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

      const laborersToSave = getSelectedLaborers();

      // If chip blend is entered and not in the list, add it
      if (formData.chipBlend && !chipBlends.some((b) => b.name.toLowerCase() === formData.chipBlend.toLowerCase())) {
        const newBlend: ChipBlend = {
          id: generateId(),
          name: formData.chipBlend,
        };
        await addChipBlend(newBlend);
        setChipBlends([...chipBlends, newBlend]);
      }

      const job: Job = {
        id: jobId || generateId(),
        name: formData.name,
        systemId: formData.system,
        floorFootage: parseFloat(formData.floorFootage) || 0,
        verticalFootage: parseFloat(formData.verticalFootage) || 0,
        crackFillFactor: parseFloat(formData.crackFillFactor) || 1,
        travelDistance: parseFloat(formData.travelDistance) || 0,
        installDate: formData.installDate,
        installDays: parseFloat(formData.installDays) || 1,
        jobHours: parseFloat(formData.jobHours) || 10,
        totalPrice: parseFloat(formData.totalPrice) || 0,
        chipBlend: formData.chipBlend || undefined,
        baseColor: formData.baseColor || undefined,
        status: formData.status,
        // Preserve costs and system snapshots for existing jobs, create new ones for new jobs
        // Laborers can be edited, so always save current selection
        costsSnapshot: existingJob ? existingJob.costsSnapshot : costs,
        systemSnapshot: existingJob ? existingJob.systemSnapshot : selectedSystem,
        laborersSnapshot: laborersToSave,
        createdAt: existingJob?.createdAt || new Date().toISOString(),
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  const selectedLaborers = getSelectedLaborers();

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
          {/* Job Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Job Name *</label>
              <input
                type="text"
                placeholder="e.g., Smith Residence - Kitchen"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Chip System *</label>
              <select
                value={formData.system}
                onChange={(e) => setFormData({ ...formData, system: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">Select a system...</option>
                {systems.map((sys) => (
                  <option key={sys.id} value={sys.id}>
                    {sys.name} ({sys.chipSize}")
                  </option>
                ))}
              </select>
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

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Floor Sq Footage</label>
              <input
                type="number"
                placeholder="0"
                value={formData.floorFootage}
                onChange={(e) => setFormData({ ...formData, floorFootage: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Vertical Sq Footage</label>
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
              <label className="block text-sm font-semibold text-slate-900 mb-2">Travel Distance (miles)</label>
              <input
                type="number"
                placeholder="0"
                value={formData.travelDistance}
                onChange={(e) => setFormData({ ...formData, travelDistance: e.target.value })}
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
              <label className="block text-sm font-semibold text-slate-900 mb-2">Install Days</label>
              <input
                type="number"
                placeholder="1"
                value={formData.installDays}
                onChange={(e) => setFormData({ ...formData, installDays: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Job Hours</label>
              <input
                type="number"
                placeholder="10"
                value={formData.jobHours}
                onChange={(e) => setFormData({ ...formData, jobHours: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="relative">
              <label className="block text-sm font-semibold text-slate-900 mb-2">Chip Blend</label>
              <input
                type="text"
                placeholder="Type or select a blend..."
                value={chipBlendInput}
                onChange={(e) => handleChipBlendInputChange(e.target.value)}
                onFocus={() => setShowBlendDropdown(true)}
                onBlur={() => setTimeout(() => setShowBlendDropdown(false), 200)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {showBlendDropdown && chipBlends.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {chipBlends
                    .filter((b) => b.name.toLowerCase().includes(chipBlendInput.toLowerCase()))
                    .map((blend) => (
                      <button
                        key={blend.id}
                        type="button"
                        onClick={() => handleChipBlendSelect(blend.name)}
                        className="w-full px-4 py-2 text-left hover:bg-slate-100 text-sm"
                      >
                        {blend.name}
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Base Color</label>
              <div className="flex gap-4">
                {(['Grey', 'Tan', 'Clear'] as BaseColor[]).map((color) => (
                  <label key={color} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="baseColor"
                      value={color}
                      checked={formData.baseColor === color}
                      onChange={(e) => setFormData({ ...formData, baseColor: e.target.value as BaseColor })}
                      className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">{color}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Status</label>
              <div className="flex gap-4">
                {(['Pending', 'Won', 'Lost'] as JobStatus[]).map((status) => (
                  <label key={status} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value={status}
                      checked={formData.status === status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as JobStatus })}
                      className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    <span className={`text-sm ${
                      status === 'Won' ? 'text-green-700' :
                      status === 'Lost' ? 'text-red-700' :
                      'text-slate-700'
                    }`}>{status}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Laborer Selection */}
          <div className="border border-slate-200 rounded-lg p-4">
            <label className="block text-sm font-semibold text-slate-900 mb-3">
              Assign Laborers
            </label>
            {(() => {
              // For existing jobs, combine active laborers with any snapshot laborers not in active list
              const availableLaborers = existingJob
                ? [...activeLaborers, ...existingJob.laborersSnapshot.filter(
                    (sl) => !activeLaborers.some((al) => al.id === sl.id)
                  )]
                : activeLaborers;

              if (availableLaborers.length === 0) {
                return <p className="text-slate-500 text-sm">No active laborers. Add laborers in Settings.</p>;
              }

              return (
                <div className="flex flex-wrap gap-2">
                  {availableLaborers.map((laborer) => {
                    const isSelected = selectedLaborerIds.includes(laborer.id);
                    const isInactive = !activeLaborers.some((al) => al.id === laborer.id);
                    return (
                      <button
                        key={laborer.id}
                        type="button"
                        onClick={() => handleLaborerToggle(laborer.id)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {laborer.name} (${laborer.fullyLoadedRate}/hr)
                        {isInactive && <span className="ml-1 text-xs opacity-75">(inactive)</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })()}
            {selectedLaborers.length > 0 && (
              <p className="text-sm text-slate-600 mt-2">
                Total labor rate: ${selectedLaborers.reduce((sum, l) => sum + l.fullyLoadedRate, 0).toFixed(2)}/hr
              </p>
            )}
          </div>

          {/* Calculation Results */}
          {calculation && (
            <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">Calculated Outputs</h3>

              {/* Material Costs */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">Material Costs</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Chip Needed</p>
                    <p className="text-lg font-semibold">{calculation.chipNeeded} boxes</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Chip Cost</p>
                    <p className="text-lg font-semibold">{formatCurrency(calculation.chipCost)}</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Base Gallons</p>
                    <p className="text-lg font-semibold">{calculation.baseGallons.toFixed(2)}</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Base Cost</p>
                    <p className="text-lg font-semibold">{formatCurrency(calculation.baseCost)}</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Top Gallons</p>
                    <p className="text-lg font-semibold">{calculation.topGallons.toFixed(2)}</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Top Cost</p>
                    <p className="text-lg font-semibold">{formatCurrency(calculation.topCost)}</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Crack Fill Gallons</p>
                    <p className="text-lg font-semibold">{calculation.crackFillGallons.toFixed(2)}</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Crack Fill Cost</p>
                    <p className="text-lg font-semibold">{formatCurrency(calculation.crackFillCost)}</p>
                  </div>
                </div>
              </div>

              {/* Operating Costs */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">Operating Costs</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Gas Generator</p>
                    <p className="text-lg font-semibold">{formatCurrency(calculation.gasGeneratorCost)}</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Gas Heater</p>
                    <p className="text-lg font-semibold">{formatCurrency(calculation.gasHeaterCost)}</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Gas Travel</p>
                    <p className="text-lg font-semibold">{formatCurrency(calculation.gasTravelCost)}</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Labor ({selectedLaborers.length} workers)</p>
                    <p className="text-lg font-semibold">{formatCurrency(calculation.laborCost)}</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Consumables</p>
                    <p className="text-lg font-semibold">{formatCurrency(calculation.consumablesCost)}</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Royalty (5%)</p>
                    <p className="text-lg font-semibold">{formatCurrency(calculation.royaltyCost)}</p>
                  </div>
                </div>
              </div>

              {/* Totals */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">Job Totals</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Price per Sqft</p>
                    <p className="text-lg font-semibold">{formatCurrency(calculation.pricePerSqft)}</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Total Costs</p>
                    <p className="text-lg font-semibold">{formatCurrency(calculation.totalCosts)}</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Cost per Sqft</p>
                    <p className="text-lg font-semibold">{formatCurrency(calculation.totalCostsPerSqft)}</p>
                  </div>
                  <div className={`bg-white p-3 rounded border ${calculation.jobMargin >= 0 ? 'border-green-300' : 'border-red-300'}`}>
                    <p className="text-xs text-slate-500">Job Margin</p>
                    <p className={`text-lg font-semibold ${calculation.jobMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(calculation.jobMargin)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Suggested Pricing */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-800 mb-3 uppercase tracking-wide">Suggested Pricing</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-blue-600">Discount</p>
                    <p className="text-lg font-semibold text-blue-900">{formatCurrency(calculation.suggestedDiscount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600">Crack Price</p>
                    <p className="text-lg font-semibold text-blue-900">{formatCurrency(calculation.suggestedCrackPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600">Floor $/sqft</p>
                    <p className="text-lg font-semibold text-blue-900">{formatCurrency(calculation.suggestedFloorPricePerSqft)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600">Floor Price</p>
                    <p className="text-lg font-semibold text-blue-900">{formatCurrency(calculation.suggestedFloorPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600">Vertical Price</p>
                    <p className="text-lg font-semibold text-blue-900">{formatCurrency(calculation.suggestedVerticalPrice)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-blue-200">
                  <div>
                    <p className="text-sm text-blue-600">Suggested Total</p>
                    <p className="text-2xl font-bold text-blue-900">{formatCurrency(calculation.suggestedTotal)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600">Suggested Margin</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(calculation.suggestedMargin)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600">Margin %</p>
                    <p className="text-2xl font-bold text-green-600">{calculation.suggestedMarginPct.toFixed(1)}%</p>
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
