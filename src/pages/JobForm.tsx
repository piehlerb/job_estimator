import { ArrowLeft, Save } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import {
  getAllSystems,
  getJob,
  addJob,
  updateJob,
  getCosts,
  getDefaultCosts,
  getPricing,
  getDefaultPricing,
  getActiveLaborers,
  getAllChipBlends,
  addChipBlend,
  ChipBlend,
  getAllChipInventory,
} from '../lib/db';
import { BaseColor, ChipSystem, Costs, Pricing, Job, JobCalculation, JobStatus, Laborer, InstallDaySchedule, ChipInventory, CoatingRemovalType } from '../types';
import { calculateJobOutputs } from '../lib/calculations';
import InstallDayScheduleComponent from '../components/InstallDaySchedule';
import { convertLegacyJobToSchedule } from '../lib/jobMigration';
import { compareSnapshots, SnapshotChanges } from '../lib/snapshotComparison';
import SnapshotChangeBanner from '../components/SnapshotChangeBanner';
import { normalizeChipBlendName } from '../lib/syncHelpers';

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
  const [pricing, setPricing] = useState<Pricing>(getDefaultPricing());
  const [activeLaborers, setActiveLaborers] = useState<Laborer[]>([]);
  const [installSchedule, setInstallSchedule] = useState<InstallDaySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calculation, setCalculation] = useState<JobCalculation | null>(null);
  const [usedPricing, setUsedPricing] = useState<Pricing>(getDefaultPricing());
  const [existingJob, setExistingJob] = useState<Job | null>(null);
  const [chipBlends, setChipBlends] = useState<ChipBlend[]>([]);
  const [chipBlendInput, setChipBlendInput] = useState('');
  const [showBlendDropdown, setShowBlendDropdown] = useState(false);
  const [chipInventory, setChipInventory] = useState<ChipInventory[]>([]);

  // Snapshot comparison state
  const [snapshotChanges, setSnapshotChanges] = useState<SnapshotChanges | null>(null);
  const [showSnapshotBanner, setShowSnapshotBanner] = useState(false);
  const [useCurrentValues, setUseCurrentValues] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    customerName: '',
    customerAddress: '',
    system: '',
    floorFootage: '',
    verticalFootage: '',
    crackFillFactor: '0',
    travelDistance: '0',
    installDate: '',
    installDays: '1',
    jobHours: '10',
    totalPrice: '0',
    chipBlend: '',
    baseColor: '' as BaseColor | '',
    status: 'Pending' as JobStatus,
    notes: '',
    includeBasecoatTint: false,
    includeTopcoatTint: false,
    antiSlip: false,
    abrasionResistance: false,
    cyclo1Topcoat: false,
    cyclo1Coats: '1',
    coatingRemoval: 'None' as CoatingRemovalType,
    moistureMitigation: false,
    // Actual pricing breakdown
    actualDiscount: '',
    actualCrackPrice: '',
    actualFloorPricePerSqft: '',
    actualFloorPrice: '',
    actualVerticalPrice: '',
    actualAntiSlipPrice: '',
    actualAbrasionResistancePrice: '',
    actualCoatingRemovalPrice: '',
    actualMoistureMitigationPrice: '',
  });

  // Track whether actual pricing has been initialized (to auto-populate from suggested)
  const actualPricingInitialized = useRef(false);
  // Track which field triggered a change to prevent circular updates
  const updatingFrom = useRef<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    calculateCosts();
  }, [formData, systems, costs, pricing, activeLaborers, installSchedule, useCurrentValues, existingJob]);

  const loadData = async () => {
    console.log('[JobForm] Loading data, jobId:', jobId);
    setLoading(true);
    try {
      const allSystems = await getAllSystems();
      const storedCosts = await getCosts();
      const storedPricing = await getPricing();
      const laborers = await getActiveLaborers();
      const blends = await getAllChipBlends();
      const inventory = await getAllChipInventory();
      console.log('[JobForm] Data loaded:', { systems: allSystems.length, costs: !!storedCosts, pricing: !!storedPricing, laborers: laborers.length });
      setSystems(allSystems);
      setActiveLaborers(laborers);
      setChipBlends(blends);
      setChipInventory(inventory);
      if (storedCosts) {
        // Merge with defaults to ensure new fields have values
        setCosts({ ...getDefaultCosts(), ...storedCosts });
      }
      if (storedPricing) {
        // Merge with defaults to ensure new fields have values
        setPricing({ ...getDefaultPricing(), ...storedPricing });
      }

      if (jobId) {
        console.log('[JobForm] Loading existing job:', jobId);
        const job = await getJob(jobId);
        console.log('[JobForm] Job loaded:', !!job);
        if (job) {
          setExistingJob(job);
          setFormData({
            name: job.name,
            customerName: job.customerName || '',
            customerAddress: job.customerAddress || '',
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
            notes: job.notes || '',
            includeBasecoatTint: job.includeBasecoatTint || false,
            includeTopcoatTint: job.includeTopcoatTint || false,
            antiSlip: job.antiSlip || false,
            abrasionResistance: job.abrasionResistance || false,
            cyclo1Topcoat: job.cyclo1Topcoat || false,
            cyclo1Coats: (job.cyclo1Coats || 1).toString(),
            coatingRemoval: job.coatingRemoval || 'None',
            moistureMitigation: job.moistureMitigation || false,
            // Actual pricing
            actualDiscount: job.actualDiscount?.toString() || '',
            actualCrackPrice: job.actualCrackPrice?.toString() || '',
            actualFloorPricePerSqft: job.actualFloorPricePerSqft?.toString() || '',
            actualFloorPrice: job.actualFloorPrice?.toString() || '',
            actualVerticalPrice: job.actualVerticalPrice?.toString() || '',
            actualAntiSlipPrice: job.actualAntiSlipPrice?.toString() || '',
            actualAbrasionResistancePrice: job.actualAbrasionResistancePrice?.toString() || '',
            actualCoatingRemovalPrice: job.actualCoatingRemovalPrice?.toString() || '',
            actualMoistureMitigationPrice: job.actualMoistureMitigationPrice?.toString() || '',
          });
          // Mark as initialized if job has actual pricing data
          if (job.actualFloorPricePerSqft != null) {
            actualPricingInitialized.current = true;
          }
          setChipBlendInput(job.chipBlend || '');
          // Load or convert to install schedule
          const schedule = convertLegacyJobToSchedule(job);
          if (schedule) {
            setInstallSchedule(schedule);
          }
          // Compare snapshots with current values
          try {
            const currentSystem = allSystems.find(s => s.id === job.systemId);
            console.log('[JobForm] Comparing snapshots...');
            const changes = compareSnapshots(
              job.systemSnapshot,
              currentSystem || null,
              job.costsSnapshot,
              storedCosts || null
            );
            console.log('[JobForm] Snapshot comparison result:', changes);

            if (changes.hasChanges) {
              console.log('[JobForm] Changes detected, showing banner');
              setSnapshotChanges(changes);
              setShowSnapshotBanner(true);
            }
          } catch (error) {
            console.error('Error comparing snapshots:', error);
            // Continue loading even if comparison fails
          }
        }
      }

      console.log('[JobForm] Data loading complete');
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      console.log('[JobForm] Setting loading to false');
      setLoading(false);
    }
  };

  const getSelectedLaborers = (): Laborer[] => {
    // Get unique laborers from install schedule
    const uniqueLaborerIds = new Set<string>();
    installSchedule.forEach(day => {
      day.laborerIds.forEach(id => uniqueLaborerIds.add(id));
    });

    // Get laborers from active list and snapshot
    const allLaborers = existingJob
      ? [...activeLaborers, ...existingJob.laborersSnapshot.filter(
          (sl) => !activeLaborers.some((al) => al.id === sl.id)
        )]
      : activeLaborers;

    return allLaborers.filter(l => uniqueLaborerIds.has(l.id));
  };

  const calculateCosts = () => {
    const selectedSystem = systems.find((s) => s.id === formData.system);
    if (!selectedSystem) {
      setCalculation(null);
      return;
    }

    // Use snapshot costs/pricing if editing existing job, otherwise use current costs/pricing
    // If user chose to use current values, override with current values
    const costsToUse = existingJob && !useCurrentValues
      ? {
          ...getDefaultCosts(),
          ...existingJob.costsSnapshot,
          // Override with current costs for new fields if snapshot doesn't have them
          antiSlipCostPerGal: existingJob.costsSnapshot.antiSlipCostPerGal ?? costs.antiSlipCostPerGal,
          abrasionResistanceCostPerGal: existingJob.costsSnapshot.abrasionResistanceCostPerGal ?? costs.abrasionResistanceCostPerGal,
        }
      : costs;
    const pricingToUse = existingJob && !useCurrentValues && existingJob.pricingSnapshot
      ? { ...getDefaultPricing(), ...existingJob.pricingSnapshot }
      : pricing;
    setUsedPricing(pricingToUse);

    // For system snapshot, merge new fields from current system if they don't exist in snapshot
    const systemToUse = existingJob && !useCurrentValues
      ? {
          ...existingJob.systemSnapshot,
          // Merge doubleBroadcast from current system if not in snapshot
          doubleBroadcast: existingJob.systemSnapshot.doubleBroadcast ?? selectedSystem?.doubleBroadcast,
        }
      : selectedSystem;
    const laborersToUse = getSelectedLaborers();

    const inputs = {
      floorFootage: parseFloat(formData.floorFootage) || 0,
      verticalFootage: parseFloat(formData.verticalFootage) || 0,
      crackFillFactor: parseFloat(formData.crackFillFactor) || 0,
      travelDistance: parseFloat(formData.travelDistance) || 0,
      installDate: formData.installDate,
      installDays: parseFloat(formData.installDays) || 1,
      jobHours: parseFloat(formData.jobHours) || 10,
      totalPrice: parseFloat(formData.totalPrice) || 0,
      includeBasecoatTint: formData.includeBasecoatTint,
      includeTopcoatTint: formData.includeTopcoatTint,
      antiSlip: formData.antiSlip,
      abrasionResistance: formData.abrasionResistance,
      cyclo1Topcoat: formData.cyclo1Topcoat,
      cyclo1Coats: parseInt(formData.cyclo1Coats) || 1,
      coatingRemoval: formData.coatingRemoval,
      moistureMitigation: formData.moistureMitigation,
      installSchedule: installSchedule.length > 0 ? installSchedule : undefined,
    };

    const calc = calculateJobOutputs(inputs, systemToUse, costsToUse, laborersToUse, pricingToUse);
    setCalculation(calc);
  };

  // Auto-populate actual pricing from suggested pricing when calculation first becomes available
  useEffect(() => {
    if (!calculation || actualPricingInitialized.current) return;
    // Initialize actual pricing from suggested values
    actualPricingInitialized.current = true;
    setFormData(prev => ({
      ...prev,
      actualDiscount: calculation.suggestedDiscount.toFixed(2),
      actualCrackPrice: calculation.suggestedCrackPrice.toFixed(2),
      actualFloorPricePerSqft: calculation.suggestedFloorPricePerSqft.toFixed(2),
      actualFloorPrice: calculation.suggestedFloorPrice.toFixed(2),
      actualVerticalPrice: calculation.suggestedVerticalPrice.toFixed(2),
      actualAntiSlipPrice: calculation.suggestedAntiSlipPrice.toFixed(2),
      actualAbrasionResistancePrice: calculation.suggestedAbrasionResistancePrice.toFixed(2),
      actualCoatingRemovalPrice: calculation.suggestedCoatingRemovalPrice.toFixed(2),
      actualMoistureMitigationPrice: calculation.suggestedMoistureMitigationPrice.toFixed(2),
      totalPrice: calculation.suggestedTotal.toFixed(2),
    }));
  }, [calculation]);

  // Recalculate total price from actual pricing components
  const recalcActualTotal = (updatedField: string, value: string) => {
    if (updatingFrom.current) return;
    updatingFrom.current = updatedField;

    const updated = { ...formData, [updatedField]: value };
    let floorPrice = parseFloat(updated.actualFloorPrice) || 0;
    let floorPricePerSqft = parseFloat(updated.actualFloorPricePerSqft) || 0;
    const floorFootage = parseFloat(updated.floorFootage) || 0;

    // Handle floor price / per sqft linkage
    if (updatedField === 'actualFloorPricePerSqft') {
      floorPrice = floorPricePerSqft * floorFootage;
      updated.actualFloorPrice = floorPrice.toFixed(2);
    } else if (updatedField === 'actualFloorPrice') {
      floorPricePerSqft = floorFootage > 0 ? floorPrice / floorFootage : 0;
      updated.actualFloorPricePerSqft = floorPricePerSqft.toFixed(2);
    }

    const total = (parseFloat(updated.actualDiscount) || 0)
      + (parseFloat(updated.actualCrackPrice) || 0)
      + floorPrice
      + (parseFloat(updated.actualVerticalPrice) || 0)
      + (parseFloat(updated.actualAntiSlipPrice) || 0)
      + (parseFloat(updated.actualAbrasionResistancePrice) || 0)
      + (parseFloat(updated.actualCoatingRemovalPrice) || 0)
      + (parseFloat(updated.actualMoistureMitigationPrice) || 0);

    updated.totalPrice = total.toFixed(2);
    setFormData(updated);
    setTimeout(() => { updatingFrom.current = null; }, 0);
  };

  // When total price changes, back-calculate floor price
  const handleTotalPriceChange = (newTotalPrice: string) => {
    if (updatingFrom.current) return;
    updatingFrom.current = 'totalPrice';

    const total = parseFloat(newTotalPrice) || 0;
    const nonFloor = (parseFloat(formData.actualDiscount) || 0)
      + (parseFloat(formData.actualCrackPrice) || 0)
      + (parseFloat(formData.actualVerticalPrice) || 0)
      + (parseFloat(formData.actualAntiSlipPrice) || 0)
      + (parseFloat(formData.actualAbrasionResistancePrice) || 0)
      + (parseFloat(formData.actualCoatingRemovalPrice) || 0)
      + (parseFloat(formData.actualMoistureMitigationPrice) || 0);
    const newFloorPrice = total - nonFloor;
    const floorFootage = parseFloat(formData.floorFootage) || 0;
    const newFloorPerSqft = floorFootage > 0 ? newFloorPrice / floorFootage : 0;

    setFormData({
      ...formData,
      totalPrice: newTotalPrice,
      actualFloorPrice: newFloorPrice.toFixed(2),
      actualFloorPricePerSqft: newFloorPerSqft.toFixed(2),
    });
    setTimeout(() => { updatingFrom.current = null; }, 0);
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

  const handleUpdateToCurrentValues = () => {
    setUseCurrentValues(true);
    setShowSnapshotBanner(false);
  };

  const handleKeepOriginalValues = () => {
    setUseCurrentValues(false);
    setShowSnapshotBanner(false);
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

      // Calculate total hours from schedule
      const totalHours = installSchedule.reduce((sum, day) => sum + day.hours, 0);

      // Normalize chip blend name before saving (trim whitespace, title case)
      const normalizedChipBlend = normalizeChipBlendName(formData.chipBlend);

      // If chip blend is entered and not in the list, add it
      if (normalizedChipBlend && !chipBlends.some((b) => normalizeChipBlendName(b.name) === normalizedChipBlend)) {
        const newBlend: ChipBlend = {
          id: generateId(),
          name: normalizedChipBlend,
        };
        await addChipBlend(newBlend);
        setChipBlends([...chipBlends, newBlend]);
      }

      const job: Job = {
        id: jobId || generateId(),
        name: formData.name,
        customerName: formData.customerName || undefined,
        customerAddress: formData.customerAddress || undefined,
        systemId: formData.system,
        floorFootage: parseFloat(formData.floorFootage) || 0,
        verticalFootage: parseFloat(formData.verticalFootage) || 0,
        crackFillFactor: parseFloat(formData.crackFillFactor) || 0,
        travelDistance: parseFloat(formData.travelDistance) || 0,
        installDate: formData.installDate,
        installDays: parseFloat(formData.installDays) || 1,
        jobHours: totalHours, // Store total hours for backward compatibility
        installSchedule: installSchedule.length > 0 ? installSchedule : undefined,
        totalPrice: parseFloat(formData.totalPrice) || 0,
        chipBlend: normalizedChipBlend || undefined,
        baseColor: formData.baseColor || undefined,
        status: formData.status,
        notes: formData.notes || undefined,
        includeBasecoatTint: formData.includeBasecoatTint,
        includeTopcoatTint: formData.includeTopcoatTint,
        antiSlip: formData.antiSlip,
        abrasionResistance: formData.abrasionResistance,
        cyclo1Topcoat: formData.cyclo1Topcoat,
        cyclo1Coats: parseInt(formData.cyclo1Coats) || 1,
        coatingRemoval: formData.coatingRemoval,
        moistureMitigation: formData.moistureMitigation,
        // Actual pricing breakdown
        actualDiscount: parseFloat(formData.actualDiscount) || undefined,
        actualCrackPrice: parseFloat(formData.actualCrackPrice) || undefined,
        actualFloorPricePerSqft: parseFloat(formData.actualFloorPricePerSqft) || undefined,
        actualFloorPrice: parseFloat(formData.actualFloorPrice) || undefined,
        actualVerticalPrice: parseFloat(formData.actualVerticalPrice) || undefined,
        actualAntiSlipPrice: parseFloat(formData.actualAntiSlipPrice) || undefined,
        actualAbrasionResistancePrice: parseFloat(formData.actualAbrasionResistancePrice) || undefined,
        actualCoatingRemovalPrice: parseFloat(formData.actualCoatingRemovalPrice) || undefined,
        actualMoistureMitigationPrice: parseFloat(formData.actualMoistureMitigationPrice) || undefined,
        // Update snapshots if user chose to use current values, otherwise preserve original
        // Laborers can be edited, so always save current selection
        costsSnapshot: existingJob && !useCurrentValues ? existingJob.costsSnapshot : costs,
        pricingSnapshot: existingJob && !useCurrentValues ? existingJob.pricingSnapshot : pricing,
        systemSnapshot: existingJob && !useCurrentValues ? existingJob.systemSnapshot : selectedSystem,
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

  // Calculate inventory status for chip blend
  const getInventoryStatus = () => {
    if (!formData.chipBlend || !calculation) {
      return null;
    }

    // Find matching inventory by blend name (using normalized comparison)
    const normalizedFormBlend = normalizeChipBlendName(formData.chipBlend);
    const inventoryItem = chipInventory.find(
      (inv) => normalizeChipBlendName(inv.blend) === normalizedFormBlend
    );

    if (!inventoryItem || inventoryItem.pounds <= 0) {
      return {
        hasInventory: false,
        message: "We don't have this chip blend in inventory",
      };
    }

    // Calculate how many boxes we have (40 lbs per box)
    const boxesInInventory = Math.floor(inventoryItem.pounds / 40);
    const boxesNeeded = calculation.chipNeeded;

    if (boxesInInventory >= boxesNeeded) {
      // We have enough in inventory
      const selectedSystem = systems.find((s) => s.id === formData.system);
      const boxCost = selectedSystem?.boxCost || 0;
      const savings = boxesNeeded * boxCost;

      return {
        hasInventory: true,
        boxesInInventory,
        boxesNeeded,
        savings,
        message: `We have this chip in inventory: You only need ${boxesNeeded} box${boxesNeeded !== 1 ? 'es' : ''}, saving ${formatCurrency(savings)}`,
      };
    } else {
      // We have some inventory but not enough
      const selectedSystem = systems.find((s) => s.id === formData.system);
      const boxCost = selectedSystem?.boxCost || 0;
      const boxesToBuy = boxesNeeded - boxesInInventory;
      const savings = boxesInInventory * boxCost;

      return {
        hasInventory: true,
        partial: true,
        boxesInInventory,
        boxesNeeded,
        boxesToBuy,
        savings,
        message: `We have ${boxesInInventory} box${boxesInInventory !== 1 ? 'es' : ''} in inventory. You need to buy ${boxesToBuy} more box${boxesToBuy !== 1 ? 'es' : ''}, saving ${formatCurrency(savings)}`,
      };
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  const selectedLaborers = getSelectedLaborers();

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-6xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4 sm:mb-6 transition-colors"
      >
        <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
        <span className="font-medium text-sm sm:text-base">Back</span>
      </button>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6 md:p-8">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 sm:mb-6">{jobId ? 'Edit Job' : 'Create New Job'}</h2>

        {/* Snapshot Change Banner */}
        {showSnapshotBanner && snapshotChanges && (
          <SnapshotChangeBanner
            changes={snapshotChanges}
            onUpdate={handleUpdateToCurrentValues}
            onDismiss={handleKeepOriginalValues}
          />
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* Job Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="md:col-span-2 lg:col-span-1">
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Job Name *</label>
              <input
                type="text"
                placeholder="e.g., Smith Residence - Kitchen"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Customer Name</label>
              <input
                type="text"
                placeholder="e.g., John Smith"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-1">
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Customer Address</label>
              <input
                type="text"
                placeholder="e.g., 123 Main St, City, State 12345"
                value={formData.customerAddress}
                onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Notes</label>
              <textarea
                placeholder="Add any additional notes about this job..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Chip System *</label>
              <select
                value={formData.system}
                onChange={(e) => setFormData({ ...formData, system: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
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
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Floor Sq Footage</label>
              <input
                type="number"
                placeholder="0"
                value={formData.floorFootage}
                onChange={(e) => setFormData({ ...formData, floorFootage: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Vertical Sq Footage</label>
              <input
                type="number"
                placeholder="0"
                value={formData.verticalFootage}
                onChange={(e) => setFormData({ ...formData, verticalFootage: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Crack Fill Factor</label>
              <input
                type="number"
                step="0.1"
                placeholder="0"
                value={formData.crackFillFactor}
                onChange={(e) => setFormData({ ...formData, crackFillFactor: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Travel Distance (miles)</label>
              <input
                type="number"
                placeholder="0"
                value={formData.travelDistance}
                onChange={(e) => setFormData({ ...formData, travelDistance: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Install Date</label>
              <input
                type="date"
                value={formData.installDate}
                onChange={(e) => setFormData({ ...formData, installDate: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Install Days</label>
              <input
                type="number"
                placeholder="1"
                min="1"
                value={formData.installDays}
                onChange={(e) => setFormData({ ...formData, installDays: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="relative">
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Chip Blend</label>
              <input
                type="text"
                placeholder="Type or select a blend..."
                value={chipBlendInput}
                onChange={(e) => handleChipBlendInputChange(e.target.value)}
                onFocus={() => setShowBlendDropdown(true)}
                onBlur={() => setTimeout(() => setShowBlendDropdown(false), 200)}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                        className="w-full px-3 sm:px-4 py-2 text-left hover:bg-slate-100 text-xs sm:text-sm"
                      >
                        {blend.name}
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Base Color</label>
              <div className="flex flex-wrap gap-3 sm:gap-4">
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
                    <span className="text-xs sm:text-sm text-slate-700">{color}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Status</label>
              <div className="flex flex-wrap gap-3 sm:gap-4">
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
                    <span className={`text-xs sm:text-sm ${
                      status === 'Won' ? 'text-green-700' :
                      status === 'Lost' ? 'text-red-700' :
                      'text-slate-700'
                    }`}>{status}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Include Basecoat Tint</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="includeBasecoatTint"
                    checked={!formData.includeBasecoatTint}
                    onChange={() => setFormData({ ...formData, includeBasecoatTint: false })}
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">No</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="includeBasecoatTint"
                    checked={formData.includeBasecoatTint}
                    onChange={() => setFormData({ ...formData, includeBasecoatTint: true })}
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">Yes</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Include Topcoat Tint</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="includeTopcoatTint"
                    checked={!formData.includeTopcoatTint}
                    onChange={() => setFormData({ ...formData, includeTopcoatTint: false })}
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">No</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="includeTopcoatTint"
                    checked={formData.includeTopcoatTint}
                    onChange={() => setFormData({ ...formData, includeTopcoatTint: true })}
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">Yes</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Anti-Slip</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="antiSlip"
                    checked={!formData.antiSlip}
                    onChange={() => setFormData({ ...formData, antiSlip: false })}
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">No</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="antiSlip"
                    checked={formData.antiSlip}
                    onChange={() => setFormData({ ...formData, antiSlip: true })}
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">Yes</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Abrasion Resistance</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="abrasionResistance"
                    checked={!formData.abrasionResistance}
                    onChange={() => setFormData({ ...formData, abrasionResistance: false })}
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">No</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="abrasionResistance"
                    checked={formData.abrasionResistance}
                    onChange={() => setFormData({ ...formData, abrasionResistance: true })}
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">Yes</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Cyclo1 Topcoat</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="cyclo1Topcoat"
                    checked={!formData.cyclo1Topcoat}
                    onChange={() => setFormData({ ...formData, cyclo1Topcoat: false })}
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">No</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="cyclo1Topcoat"
                    checked={formData.cyclo1Topcoat}
                    onChange={() => setFormData({ ...formData, cyclo1Topcoat: true })}
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">Yes</span>
                </label>
              </div>
            </div>

            {formData.cyclo1Topcoat && (
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Cyclo1 Coats</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="cyclo1Coats"
                      checked={formData.cyclo1Coats === '1'}
                      onChange={() => setFormData({ ...formData, cyclo1Coats: '1' })}
                      className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-xs sm:text-sm text-slate-700">1 Coat</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="cyclo1Coats"
                      checked={formData.cyclo1Coats === '2'}
                      onChange={() => setFormData({ ...formData, cyclo1Coats: '2' })}
                      className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-xs sm:text-sm text-slate-700">2 Coats</span>
                  </label>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Coating Removal</label>
              <div className="flex flex-wrap gap-3 sm:gap-4">
                {(['None', 'Paint', 'Epoxy'] as CoatingRemovalType[]).map((type) => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="coatingRemoval"
                      value={type}
                      checked={formData.coatingRemoval === type}
                      onChange={(e) => setFormData({ ...formData, coatingRemoval: e.target.value as CoatingRemovalType })}
                      className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-xs sm:text-sm text-slate-700">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Moisture Mitigation</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="moistureMitigation"
                    checked={!formData.moistureMitigation}
                    onChange={() => setFormData({ ...formData, moistureMitigation: false })}
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">No</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="moistureMitigation"
                    checked={formData.moistureMitigation}
                    onChange={() => setFormData({ ...formData, moistureMitigation: true })}
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">Yes</span>
                </label>
              </div>
            </div>
          </div>

          {/* Daily Schedule Section */}
          <div className="border border-slate-200 rounded-lg p-3 sm:p-4 bg-slate-50">
            <InstallDayScheduleComponent
              installDays={parseInt(formData.installDays) || 1}
              schedule={installSchedule}
              availableLaborers={(() => {
                // For existing jobs, combine active laborers with snapshot laborers
                return existingJob
                  ? [...activeLaborers, ...existingJob.laborersSnapshot.filter(
                      (sl) => !activeLaborers.some((al) => al.id === sl.id)
                    )]
                  : activeLaborers;
              })()}
              onChange={setInstallSchedule}
            />
          </div>

          {/* Calculation Results */}
          {calculation && (
            <div className="bg-slate-50 rounded-lg p-3 sm:p-4 md:p-6 border border-slate-200">
              <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-3 sm:mb-4">Calculated Outputs</h3>

              {/* Material Costs */}
              <div className="mb-4 sm:mb-6">
                <h4 className="text-xs sm:text-sm font-semibold text-slate-700 mb-2 sm:mb-3 uppercase tracking-wide">Material Costs</h4>

                {/* Inventory Status */}
                {(() => {
                  const inventoryStatus = getInventoryStatus();
                  if (!inventoryStatus) return null;

                  return (
                    <div className={`mb-3 sm:mb-4 p-3 sm:p-4 rounded-lg border-2 ${
                      inventoryStatus.hasInventory
                        ? inventoryStatus.partial
                          ? 'bg-yellow-50 border-yellow-400'
                          : 'bg-green-50 border-green-400'
                        : 'bg-slate-50 border-slate-300'
                    }`}>
                      <p className={`text-sm sm:text-base font-semibold ${
                        inventoryStatus.hasInventory
                          ? inventoryStatus.partial
                            ? 'text-yellow-800'
                            : 'text-green-800'
                          : 'text-slate-700'
                      }`}>
                        {inventoryStatus.message}
                      </p>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                  <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Chip Needed</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold">{calculation.chipNeeded} boxes</p>
                  </div>
                  <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Chip Cost</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.chipCost)}</p>
                  </div>
                  <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Base Gallons</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold">{calculation.baseGallons.toFixed(2)}</p>
                  </div>
                  <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Base Cost</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.baseCost)}</p>
                  </div>
                  <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Top Gallons</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold">{calculation.topGallons.toFixed(2)}</p>
                  </div>
                  <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Top Cost</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.topCost)}</p>
                  </div>
                  <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Crack Fill Gallons</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold">{calculation.crackFillGallons.toFixed(2)}</p>
                  </div>
                  <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Crack Fill Cost</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.crackFillCost)}</p>
                  </div>
                  <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Cyclo1 Needed</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold">{calculation.cyclo1Needed.toFixed(2)} gal</p>
                  </div>
                  <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Cyclo1 Cost</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.cyclo1Cost)}</p>
                  </div>
                  <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Tint Needed</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold">{calculation.tintNeeded.toFixed(2)} oz</p>
                  </div>
                  <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Tint Cost</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.tintCost)}</p>
                  </div>
                  <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Anti-Slip Cost</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.antiSlipCost)}</p>
                  </div>
                  <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Abrasion Resistance Cost</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.abrasionResistanceCost)}</p>
                  </div>
                </div>
              </div>

              {/* Operating Costs */}
              <div className="mb-4 sm:mb-6">
                <h4 className="text-xs sm:text-sm font-semibold text-slate-700 mb-2 sm:mb-3 uppercase tracking-wide">Operating Costs</h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                  <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Gas Generator</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.gasGeneratorCost)}</p>
                  </div>
                  <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Gas Heater</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.gasHeaterCost)}</p>
                  </div>
                  <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Gas Travel</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.gasTravelCost)}</p>
                  </div>
                  <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Labor ({selectedLaborers.length} workers)</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.laborCost)}</p>
                  </div>
                  <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Consumables</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.consumablesCost)}</p>
                  </div>
                  <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Royalty (5%)</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.royaltyCost)}</p>
                  </div>
                </div>
              </div>

              {/* Job Totals */}
              <div className="mb-4 sm:mb-6">
                <h4 className="text-xs sm:text-sm font-semibold text-slate-700 mb-2 sm:mb-3 uppercase tracking-wide">Job Totals</h4>
                <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4">
                  <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Total Costs</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.totalCosts)}</p>
                  </div>
                  <div className={`bg-white p-2 sm:p-3 rounded border ${calculation.marginPerDay >= 0 ? 'border-green-300' : 'border-red-300'}`}>
                    <p className="text-xs text-slate-500">Margin per Day</p>
                    <p className={`text-sm sm:text-base md:text-lg font-semibold ${calculation.marginPerDay >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(calculation.marginPerDay)}
                    </p>
                  </div>
                  <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
                    <p className="text-xs text-slate-500">Cost per Sqft</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.totalCostsPerSqft)}</p>
                  </div>
                </div>
              </div>

              {/* Actual Pricing - editable */}
              <div className="bg-green-50 rounded-lg p-3 sm:p-4 border border-green-200 mb-4 sm:mb-6">
                <h4 className="text-xs sm:text-sm font-semibold text-green-800 mb-2 sm:mb-3 uppercase tracking-wide">Actual Pricing</h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4">
                  <div>
                    <label className="text-xs text-green-600">Discount</label>
                    <input type="number" step="0.01" value={formData.actualDiscount}
                      onChange={(e) => recalcActualTotal('actualDiscount', e.target.value)}
                      className="w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b border-green-300 focus:outline-none focus:border-green-600 p-0" />
                  </div>
                  <div>
                    <label className="text-xs text-green-600">Crack Price</label>
                    <input type="number" step="0.01" value={formData.actualCrackPrice}
                      onChange={(e) => recalcActualTotal('actualCrackPrice', e.target.value)}
                      className="w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b border-green-300 focus:outline-none focus:border-green-600 p-0" />
                  </div>
                  <div>
                    <label className="text-xs text-green-600">Floor $/sqft</label>
                    <input type="number" step="0.01" value={formData.actualFloorPricePerSqft}
                      onChange={(e) => recalcActualTotal('actualFloorPricePerSqft', e.target.value)}
                      className="w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b border-green-300 focus:outline-none focus:border-green-600 p-0" />
                  </div>
                  <div>
                    <label className="text-xs text-green-600">Floor Price</label>
                    <input type="number" step="0.01" value={formData.actualFloorPrice}
                      onChange={(e) => recalcActualTotal('actualFloorPrice', e.target.value)}
                      className="w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b border-green-300 focus:outline-none focus:border-green-600 p-0" />
                  </div>
                  <div>
                    <label className="text-xs text-green-600">Vertical Price</label>
                    <input type="number" step="0.01" value={formData.actualVerticalPrice}
                      onChange={(e) => recalcActualTotal('actualVerticalPrice', e.target.value)}
                      className="w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b border-green-300 focus:outline-none focus:border-green-600 p-0" />
                  </div>
                  <div>
                    <label className="text-xs text-green-600">Anti-Slip Price</label>
                    <input type="number" step="0.01" value={formData.actualAntiSlipPrice}
                      onChange={(e) => recalcActualTotal('actualAntiSlipPrice', e.target.value)}
                      className="w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b border-green-300 focus:outline-none focus:border-green-600 p-0" />
                  </div>
                  <div>
                    <label className="text-xs text-green-600">Abrasion Resistance</label>
                    <input type="number" step="0.01" value={formData.actualAbrasionResistancePrice}
                      onChange={(e) => recalcActualTotal('actualAbrasionResistancePrice', e.target.value)}
                      className="w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b border-green-300 focus:outline-none focus:border-green-600 p-0" />
                  </div>
                  <div>
                    <label className="text-xs text-green-600">Coating Removal</label>
                    <input type="number" step="0.01" value={formData.actualCoatingRemovalPrice}
                      onChange={(e) => recalcActualTotal('actualCoatingRemovalPrice', e.target.value)}
                      className="w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b border-green-300 focus:outline-none focus:border-green-600 p-0" />
                  </div>
                  <div>
                    <label className="text-xs text-green-600">Moisture Mitigation</label>
                    <input type="number" step="0.01" value={formData.actualMoistureMitigationPrice}
                      onChange={(e) => recalcActualTotal('actualMoistureMitigationPrice', e.target.value)}
                      className="w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b border-green-300 focus:outline-none focus:border-green-600 p-0" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-green-200">
                  {(() => {
                    const totalPrice = parseFloat(formData.totalPrice) || 0;
                    const floorFootage = parseFloat(formData.floorFootage) || 0;
                    const effectivePricePerSqft = floorFootage > 0 ? totalPrice / floorFootage : 0;
                    const actualMargin = totalPrice - calculation.totalCosts;
                    const actualMarginPct = totalPrice > 0 ? (actualMargin / totalPrice) * 100 : 0;
                    const minimumMarginBuffer = pricing.minimumMarginBuffer ?? 2000;
                    const selectedSystem = systems.find(s => s.id === formData.system);
                    const floorPriceMin = selectedSystem?.floorPriceMin ?? 6;
                    const floorPriceMax = selectedSystem?.floorPriceMax ?? 8;
                    const actualFloorPerSqft = parseFloat(formData.actualFloorPricePerSqft) || 0;
                    const floorOutOfRange = actualFloorPerSqft < floorPriceMin || actualFloorPerSqft > floorPriceMax;
                    const marginBelowMin = actualMargin < minimumMarginBuffer;

                    return (
                      <>
                        <div>
                          <p className="text-xs sm:text-sm text-green-600">Effective $/Sqft</p>
                          <p className={`text-xl sm:text-2xl font-bold ${floorOutOfRange ? 'text-red-600' : 'text-green-900'}`}>{formatCurrency(effectivePricePerSqft)}</p>
                        </div>
                        <div>
                          <label className="text-xs sm:text-sm text-green-600">Total Price</label>
                          <input type="number" step="0.01" value={formData.totalPrice}
                            onChange={(e) => handleTotalPriceChange(e.target.value)}
                            className="w-full text-xl sm:text-2xl font-bold text-green-900 bg-transparent border-b border-green-300 focus:outline-none focus:border-green-600 p-0" />
                        </div>
                        <div>
                          <p className="text-xs sm:text-sm text-green-600">Actual Margin</p>
                          <p className={`text-xl sm:text-2xl font-bold ${marginBelowMin ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(actualMargin)}</p>
                        </div>
                        <div>
                          <p className="text-xs sm:text-sm text-green-600">Margin %</p>
                          <p className={`text-xl sm:text-2xl font-bold ${marginBelowMin ? 'text-red-600' : 'text-green-600'}`}>{actualMarginPct.toFixed(1)}%</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Suggested Pricing */}
              <div className="bg-blue-50 rounded-lg p-3 sm:p-4 border border-blue-200">
                <h4 className="text-xs sm:text-sm font-semibold text-blue-800 mb-2 sm:mb-3 uppercase tracking-wide">Suggested Pricing</h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4">
                  <div>
                    <p className="text-xs text-blue-600">Discount</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold text-blue-900">{formatCurrency(calculation.suggestedDiscount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600">Crack Price</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold text-blue-900">{formatCurrency(calculation.suggestedCrackPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600">Floor $/sqft</p>
                    <p className={`text-sm sm:text-base md:text-lg font-semibold ${(() => {
                      const selectedSystem = systems.find(s => s.id === formData.system);
                      const min = selectedSystem?.floorPriceMin ?? 6;
                      const max = selectedSystem?.floorPriceMax ?? 8;
                      return (calculation.suggestedFloorPricePerSqft < min || calculation.suggestedFloorPricePerSqft > max) ? 'text-red-600' : 'text-blue-900';
                    })()}`}>
                      {formatCurrency(calculation.suggestedFloorPricePerSqft)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600">Floor Price</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold text-blue-900">{formatCurrency(calculation.suggestedFloorPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600">Vertical Price - {formatCurrency(usedPricing.verticalPricePerSqft)}/sqft</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold text-blue-900">{formatCurrency(calculation.suggestedVerticalPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600">Anti-Slip Price - {formatCurrency(usedPricing.antiSlipPricePerSqft)}/sqft</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold text-blue-900">{formatCurrency(calculation.suggestedAntiSlipPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600">Abrasion Resistance - {formatCurrency(usedPricing.abrasionResistancePricePerSqft)}/sqft</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold text-blue-900">{formatCurrency(calculation.suggestedAbrasionResistancePrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600">
                      Coating Removal - {formData.coatingRemoval}
                      {formData.coatingRemoval === 'Paint' && ` - ${formatCurrency(usedPricing.coatingRemovalPaintPerSqft)}/sqft`}
                      {formData.coatingRemoval === 'Epoxy' && ` - ${formatCurrency(usedPricing.coatingRemovalEpoxyPerSqft)}/sqft`}
                    </p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold text-blue-900">{formatCurrency(calculation.suggestedCoatingRemovalPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600">Moisture Mitigation - {formatCurrency(usedPricing.moistureMitigationPerSqft)}/sqft</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold text-blue-900">{formatCurrency(calculation.suggestedMoistureMitigationPrice)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-blue-200">
                  <div>
                    <p className="text-xs sm:text-sm text-blue-600">Effective $/Sqft</p>
                    <p className="text-xl sm:text-2xl font-bold text-blue-900">{formatCurrency(calculation.suggestedEffectivePricePerSqft)}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-blue-600">Suggested Total</p>
                    <p className="text-xl sm:text-2xl font-bold text-blue-900">{formatCurrency(calculation.suggestedTotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-blue-600">Suggested Margin</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-600">{formatCurrency(calculation.suggestedMargin)}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-blue-600">Margin %</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-600">{calculation.suggestedMarginPct.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              <Save size={18} className="sm:w-5 sm:h-5" />
              {saving ? 'Saving...' : jobId ? 'Update Job' : 'Create Job'}
            </button>
            <button
              type="button"
              onClick={onBack}
              disabled={saving}
              className="px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-200 text-slate-900 rounded-lg font-semibold hover:bg-slate-300 active:bg-slate-400 transition-colors disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
