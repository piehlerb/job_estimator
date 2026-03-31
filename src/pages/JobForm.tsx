import { ArrowLeft, Save, ChevronDown, ChevronUp, X, Plus, Trash2, Link, Shuffle, Check, Copy } from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import {
  getAllSystems,
  getJob,
  getAllJobs,
  getAllCustomers,
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
  getAllProducts,
  getAllBaseCoatColors,
  getAllJobsByGroupId,
  getAllTintInventory,
  getAllCommTemplates,
} from '../lib/db';
import { BaseColor, ChipSystem, Costs, Pricing, Job, JobCalculation, JobStatus, Laborer, InstallDaySchedule, ActualDaySchedule, ActualCosts, ChipInventory, CoatingRemovalType, Product, JobProduct, BaseCoatColor, JobReminder, JobFollowUp, TintInventory, CommunicationTemplate } from '../types';
import { calculateJobOutputs, calculateActualCosts } from '../lib/calculations';
import InstallDayScheduleComponent from '../components/InstallDaySchedule';
import { convertLegacyJobToSchedule } from '../lib/jobMigration';
import { compareSnapshots, SnapshotChanges } from '../lib/snapshotComparison';
import SnapshotChangeBanner from '../components/SnapshotChangeBanner';
import { normalizeChipBlendName } from '../lib/syncHelpers';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function parseJobTags(input: string): string[] {
  const seen = new Set<string>();
  return input
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .filter((tag) => {
      const normalized = tag.toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
}

interface JobFormProps {
  jobId?: string;
  onBack: () => void;
  onEditJob?: (jobId: string) => void;
}

interface CustomerOption {
  name: string;
  address?: string;
}

export default function JobForm({ jobId, onBack, onEditJob }: JobFormProps) {
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
  const [baseCoatColors, setBaseCoatColors] = useState<BaseCoatColor[]>([]);
  const [tintInventory, setTintInventory] = useState<TintInventory[]>([]);
  const [showTintColorDropdown, setShowTintColorDropdown] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [availableCustomers, setAvailableCustomers] = useState<CustomerOption[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Products state
  const [jobProducts, setJobProducts] = useState<JobProduct[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [showProductsSection, setShowProductsSection] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'reminders' | 'actuals'>('details');

  // Actuals state (for Won jobs)
  const [actualInstallSchedule, setActualInstallSchedule] = useState<ActualDaySchedule[]>([]);
  const [actualMaterials, setActualMaterials] = useState({
    actualBaseCoatGallons: '',
    actualTopCoatGallons: '',
    actualCyclo1Gallons: '',
    actualTintOz: '',
    actualChipBoxes: '',
    actualCrackRepairOz: '',
  });
  const [actualCalculation, setActualCalculation] = useState<ActualCosts | null>(null);
  const actualsInitialized = useRef(false);

  // Reminders state
  const [reminders, setReminders] = useState<JobReminder[]>([]);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [savingReminder, setSavingReminder] = useState(false);
  const [reminderForm, setReminderForm] = useState({
    subject: '',
    details: '',
    dueDate: '',
    dueTime: '',
  });
  const [showNextReminderPrompt, setShowNextReminderPrompt] = useState(false);
  const [nextReminderForm, setNextReminderForm] = useState({ subject: '', dueDate: '', dueTime: '', details: '' });

  // Follow-ups state
  const [followUps, setFollowUps] = useState<JobFollowUp[]>([]);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [commTemplates, setCommTemplates] = useState<CommunicationTemplate[]>([]);
  const [copiedReminderId, setCopiedReminderId] = useState<string | null>(null);
  const [followUpForm, setFollowUpForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  // Snapshot comparison state
  const [snapshotChanges, setSnapshotChanges] = useState<SnapshotChanges | null>(null);
  const [showSnapshotBanner, setShowSnapshotBanner] = useState(false);
  const [useCurrentValues, setUseCurrentValues] = useState(false);

  // Estimate group state
  const [groupJobs, setGroupJobs] = useState<Job[]>([]);
  const [ungroupedJobs, setUngroupedJobs] = useState<Job[]>([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupModalType, setGroupModalType] = useState<'alternative' | 'bundled'>('alternative');
  const [creatingGroupJob, setCreatingGroupJob] = useState(false);
  const [bundleAggregate, setBundleAggregate] = useState<{ totalPrice: number; totalCosts: number } | null>(null);
  const [modalView, setModalView] = useState<'options' | 'existing-search'>('options');
  const [existingJobSearch, setExistingJobSearch] = useState('');

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
    tags: '',
    baseColor: '' as BaseColor | '',
    status: 'Pending' as JobStatus,
    probability: '20',
    estimateDate: new Date().toISOString().split('T')[0],
    decisionDate: '',
    notes: '',
    includeBasecoatTint: false,
    includeTopcoatTint: false,
    tintColor: '',
    antiSlip: false,
    abrasionResistance: false,
    cyclo1Topcoat: false,
    cyclo1Coats: '0',
    coatingRemoval: 'None' as CoatingRemovalType,
    moistureMitigation: false,
    disableGasHeater: false,
    // Actual pricing breakdown
    actualDiscount: '',
    actualCrackPrice: '',
    actualFloorPricePerSqft: '',
    actualFloorPrice: '',
    actualVerticalPricePerSqft: '',
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

  // Reactively compute actual costs when actuals change
  useEffect(() => {
    if (!existingJob || actualInstallSchedule.length === 0) {
      setActualCalculation(null);
      return;
    }
    const costsToUse = existingJob ? { ...getDefaultCosts(), ...existingJob.costsSnapshot } : costs;
    const pricingToUse = existingJob?.pricingSnapshot
      ? { ...getDefaultPricing(), ...existingJob.pricingSnapshot }
      : pricing;
    const laborersToUse = [
      ...activeLaborers,
      ...existingJob.laborersSnapshot.filter(sl => !activeLaborers.some(al => al.id === sl.id)),
    ];
    const chipBoxCost = existingJob.systemSnapshot?.boxCost ?? 0;

    const calc = calculateActualCosts(
      {
        actualSchedule: actualInstallSchedule,
        actualBaseCoatGallons: parseFloat(actualMaterials.actualBaseCoatGallons) || 0,
        actualTopCoatGallons: parseFloat(actualMaterials.actualTopCoatGallons) || 0,
        actualCyclo1Gallons: parseFloat(actualMaterials.actualCyclo1Gallons) || 0,
        actualTintOz: parseFloat(actualMaterials.actualTintOz) || 0,
        actualChipBoxes: parseFloat(actualMaterials.actualChipBoxes) || 0,
        actualCrackRepairOz: parseFloat(actualMaterials.actualCrackRepairOz) || 0,
        chipBoxCost,
        totalPrice: parseFloat(formData.totalPrice) || 0,
        installDays: parseFloat(formData.installDays) || 1,
        installDate: formData.installDate,
        travelDistance: parseFloat(formData.travelDistance) || 0,
        disableGasHeater: formData.disableGasHeater,
      },
      costsToUse,
      pricingToUse,
      laborersToUse
    );
    setActualCalculation(calc);
  }, [actualInstallSchedule, actualMaterials, formData.totalPrice, formData.installDays, formData.installDate, formData.travelDistance, formData.disableGasHeater, existingJob, activeLaborers, costs, pricing]);


  const productsTotalPrice = useMemo(
    () => jobProducts.reduce((sum, p) => sum + p.quantity * p.unitPrice, 0),
    [jobProducts]
  );
  const productsTotalCost = useMemo(
    () => jobProducts.reduce((sum, p) => sum + p.quantity * p.unitCost, 0),
    [jobProducts]
  );

  const tagSuggestions = useMemo(() => {
    const segments = formData.tags.split(',');
    const query = (segments[segments.length - 1] || '').trim().toLowerCase();
    const completed = new Set(
      segments
        .slice(0, -1)
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    );

    return availableTags
      .filter((tag) => !completed.has(tag.toLowerCase()))
      .filter((tag) => query.length === 0 || tag.toLowerCase().includes(query))
      .slice(0, 8);
  }, [formData.tags, availableTags]);

    const customerSuggestions = useMemo(() => {
    const query = formData.customerName.trim().toLowerCase();
    return availableCustomers
      .filter((customer) => query.length === 0 || customer.name.toLowerCase().includes(query))
      .slice(0, 8);
  }, [formData.customerName, availableCustomers]);

  const applicableChipBlends = useMemo(() => {
    const filtered = !formData.system
      ? chipBlends
      : chipBlends.filter((blend) => {
          if (!blend.systemIds || blend.systemIds.length === 0) return true;
          return blend.systemIds.includes(formData.system);
        });
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [chipBlends, formData.system]);

  const selectedBlend = useMemo(() => {
    const normalized = normalizeChipBlendName(formData.chipBlend);
    if (!normalized) return null;
    return applicableChipBlends.find((blend) => normalizeChipBlendName(blend.name) === normalized) || null;
  }, [formData.chipBlend, applicableChipBlends]);

  const availableBaseCoatColors = useMemo(() => {
    if (!selectedBlend || !selectedBlend.baseCoatColorIds || selectedBlend.baseCoatColorIds.length === 0) {
      return baseCoatColors;
    }

    const allowedIds = new Set(selectedBlend.baseCoatColorIds);
    return baseCoatColors.filter((color) => allowedIds.has(color.id));
  }, [selectedBlend, baseCoatColors]);

  useEffect(() => {
    if (!formData.chipBlend) return;

    const normalized = normalizeChipBlendName(formData.chipBlend);
    if (!normalized) return;

    const isKnownBlend = chipBlends.some(
      (blend) => normalizeChipBlendName(blend.name) === normalized
    );
    if (!isKnownBlend) return;

    const isApplicable = applicableChipBlends.some(
      (blend) => normalizeChipBlendName(blend.name) === normalized
    );

    if (!isApplicable) {
      setChipBlendInput('');
      setFormData((prev) => ({ ...prev, chipBlend: '', baseColor: '' }));
    }
  }, [applicableChipBlends, chipBlends, formData.chipBlend]);

  useEffect(() => {
    if (!selectedBlend?.baseCoatColorIds || selectedBlend.baseCoatColorIds.length === 0) return;

    const mappedColors = baseCoatColors.filter((color) => selectedBlend.baseCoatColorIds!.includes(color.id));
    if (mappedColors.length === 0) return;

    setFormData((prev) => {
      if (mappedColors.some((color) => color.name === prev.baseColor)) {
        return prev;
      }
      return { ...prev, baseColor: mappedColors[0].name as BaseColor };
    });
  }, [selectedBlend, baseCoatColors]);

  useEffect(() => {
    if (!formData.baseColor) return;

    const isAvailable = availableBaseCoatColors.some((color) => color.name === formData.baseColor);
    if (!isAvailable) {
      setFormData((prev) => ({ ...prev, baseColor: '' }));
    }
  }, [availableBaseCoatColors, formData.baseColor]);

  


  const loadData = async () => {
    console.log('[JobForm] Loading data, jobId:', jobId);
    setLoading(true);
    try {
      const allSystems = await getAllSystems();
      const storedCosts = await getCosts();
      const storedPricing = await getPricing();
      const laborers = await getActiveLaborers();
      const allJobs = await getAllJobs();
      const allCustomers = await getAllCustomers();
      const blends = await getAllChipBlends();
      const inventory = await getAllChipInventory();
      const productCatalog = await getAllProducts();
      const baseCoatColorList = await getAllBaseCoatColors();
      const tintInv = await getAllTintInventory();
      const templates = await getAllCommTemplates();
      console.log('[JobForm] Data loaded:', { systems: allSystems.length, costs: !!storedCosts, pricing: !!storedPricing, laborers: laborers.length });
      setSystems(allSystems);
      setActiveLaborers(laborers);
      setChipBlends(blends);
      setChipInventory(inventory);
      setAllProducts(productCatalog);
      setBaseCoatColors(baseCoatColorList);
      setTintInventory(tintInv);
      setCommTemplates(templates);
      const tagSet = new Set<string>();
      const customerMap = new Map<string, { name: string; address?: string; updatedAt: string }>();

      // Seed customer map from the customer store first
      allCustomers.forEach((customer) => {
        const key = customer.name.trim().toLowerCase();
        customerMap.set(key, {
          name: customer.name.trim(),
          address: customer.address?.trim() || undefined,
          updatedAt: customer.updatedAt,
        });
      });

      // Merge in job-derived customer info (fills in addresses from jobs if missing in customer store)
      allJobs.forEach((job) => {
        (job.tags || []).forEach((tag) => tagSet.add(tag));

        const customerName = job.customerName?.trim();
        if (!customerName) return;

        const customerAddress = job.customerAddress?.trim() || undefined;
        const key = customerName.toLowerCase();
        const updatedAt = job.updatedAt || job.createdAt || '';
        const existing = customerMap.get(key);

        if (!existing) {
          customerMap.set(key, {
            name: customerName,
            address: customerAddress,
            updatedAt,
          });
        } else if (!existing.address && customerAddress) {
          customerMap.set(key, {
            ...existing,
            address: customerAddress,
          });
        }
      });
      setAvailableTags(Array.from(tagSet).sort((a, b) => a.localeCompare(b)));
      // Jobs available to be pulled into a group (no existing group, not the current job)
      setUngroupedJobs(allJobs.filter(j => !j.groupId && j.id !== jobId));
      setAvailableCustomers(
        Array.from(customerMap.values())
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((customer) => ({ name: customer.name, address: customer.address }))
      );
      if (storedCosts) {
        // Merge with defaults to ensure new fields have values
        setCosts({ ...getDefaultCosts(), ...storedCosts });
      }
      if (storedPricing) {
        // Merge with defaults to ensure new fields have values
        setPricing({ ...getDefaultPricing(), ...storedPricing });
      }

      if (!jobId) {
        const defaultSystem = allSystems.find((s) => s.isDefault);
        if (defaultSystem) {
          setFormData((prev) => ({ ...prev, system: defaultSystem.id }));
        }
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
            tags: (job.tags || []).join(', '),
            baseColor: job.baseColor || '',
            status: job.status || 'Pending',
            probability: (job.probability?.toString()) ?? (job.status === 'Won' ? '100' : job.status === 'Lost' ? '0' : job.status === 'Verbal' ? '80' : '20'),
            estimateDate: job.estimateDate || job.createdAt.split('T')[0],
            decisionDate: job.decisionDate || '',
            notes: job.notes || '',
            includeBasecoatTint: job.includeBasecoatTint || false,
            includeTopcoatTint: job.includeTopcoatTint || false,
            tintColor: job.tintColor || '',
            antiSlip: job.antiSlip || false,
            abrasionResistance: job.abrasionResistance || false,
            cyclo1Topcoat: job.cyclo1Topcoat || false,
            cyclo1Coats: (job.cyclo1Coats ?? 0).toString(),
            coatingRemoval: job.coatingRemoval || 'None',
            moistureMitigation: job.moistureMitigation || false,
            disableGasHeater: job.disableGasHeater || false,
            // Actual pricing
            actualDiscount: job.actualDiscount?.toString() || '',
            actualCrackPrice: job.actualCrackPrice?.toString() || '',
            actualFloorPricePerSqft: job.actualFloorPricePerSqft?.toString() || '',
            actualFloorPrice: job.actualFloorPrice?.toString() || '',
            actualVerticalPricePerSqft: job.actualVerticalPricePerSqft?.toString() || '',
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
          // Load actuals data for Won jobs
          if (job.actualInstallSchedule && job.actualInstallSchedule.length > 0) {
            setActualInstallSchedule(job.actualInstallSchedule);
            actualsInitialized.current = true;
          } else if (schedule) {
            // Pre-populate from estimated schedule as starting point
            setActualInstallSchedule(schedule.map(d => ({ ...d })));
          }
          if (job.actualBaseCoatGallons != null || job.actualTopCoatGallons != null) {
            actualsInitialized.current = true;
          }
          setActualMaterials({
            actualBaseCoatGallons: job.actualBaseCoatGallons?.toString() || '',
            actualTopCoatGallons: job.actualTopCoatGallons?.toString() || '',
            actualCyclo1Gallons: job.actualCyclo1Gallons?.toString() || '',
            actualTintOz: job.actualTintOz?.toString() || '',
            actualChipBoxes: job.actualChipBoxes?.toString() || '',
            actualCrackRepairOz: job.actualCrackRepairOz?.toString() || '',
          });
          // Load products from existing job
          if (job.products && job.products.length > 0) {
            setJobProducts(job.products);
            setShowProductsSection(true);
          }
          if (job.reminders && job.reminders.length > 0) {
            setReminders(job.reminders);
          }
          if (job.followUps && job.followUps.length > 0) {
            setFollowUps(job.followUps);
          }
          // Load sibling jobs if this job belongs to a group
          if (job.groupId) {
            const siblings = await getAllJobsByGroupId(job.groupId);
            setGroupJobs(siblings);
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
          moistureMitigationCostPerGal: existingJob.costsSnapshot.moistureMitigationCostPerGal ?? costs.moistureMitigationCostPerGal,
          moistureMitigationSpreadRate: existingJob.costsSnapshot.moistureMitigationSpreadRate ?? costs.moistureMitigationSpreadRate,
        }
      : costs;
    const pricingToUse = existingJob && !useCurrentValues && existingJob.pricingSnapshot
      ? { ...getDefaultPricing(), ...existingJob.pricingSnapshot }
      : pricing;
    setUsedPricing(pricingToUse);

    // For system snapshot, merge current defaults for fields added after the snapshot was taken
    const systemToUse = existingJob && !useCurrentValues
      ? {
          ...existingJob.systemSnapshot,
          baseCoats: existingJob.systemSnapshot.baseCoats ?? selectedSystem?.baseCoats ?? 1,
          topCoats: existingJob.systemSnapshot.topCoats
            ?? (((existingJob.systemSnapshot as unknown as { doubleBroadcast?: boolean }).doubleBroadcast ? 2 : undefined)
            ?? selectedSystem?.topCoats
            ?? 1),
          cyclo1Coats: existingJob.systemSnapshot.cyclo1Coats ?? selectedSystem?.cyclo1Coats ?? 1,
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
      cyclo1Coats: parseInt(formData.cyclo1Coats) || 0,
      coatingRemoval: formData.coatingRemoval,
      moistureMitigation: formData.moistureMitigation,
      disableGasHeater: formData.disableGasHeater,
      installSchedule: installSchedule.length > 0 ? installSchedule : undefined,
      tags: formData.tags.split(',').map((t) => t.trim()).filter(Boolean),
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
      actualVerticalPricePerSqft: (() => {
        const vf = parseFloat(formData.verticalFootage) || 0;
        return vf > 0 ? (calculation.suggestedVerticalPrice / vf).toFixed(2) : '';
      })(),
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

    let verticalPrice = parseFloat(updated.actualVerticalPrice) || 0;
    let verticalPricePerSqft = parseFloat(updated.actualVerticalPricePerSqft) || 0;
    const verticalFootage = parseFloat(updated.verticalFootage) || 0;

    // Handle floor price / per sqft linkage
    if (updatedField === 'actualFloorPricePerSqft') {
      floorPrice = floorPricePerSqft * floorFootage;
      updated.actualFloorPrice = floorPrice.toFixed(2);
    } else if (updatedField === 'actualFloorPrice') {
      floorPricePerSqft = floorFootage > 0 ? floorPrice / floorFootage : 0;
      updated.actualFloorPricePerSqft = floorPricePerSqft.toFixed(2);
    }

    // Handle vertical price / per sqft linkage
    if (updatedField === 'actualVerticalPricePerSqft') {
      verticalPrice = verticalPricePerSqft * verticalFootage;
      updated.actualVerticalPrice = verticalPrice.toFixed(2);
    } else if (updatedField === 'actualVerticalPrice') {
      verticalPricePerSqft = verticalFootage > 0 ? verticalPrice / verticalFootage : 0;
      updated.actualVerticalPricePerSqft = verticalPricePerSqft.toFixed(2);
    }

    const total = (parseFloat(updated.actualDiscount) || 0)
      + (parseFloat(updated.actualCrackPrice) || 0)
      + floorPrice
      + verticalPrice
      + (parseFloat(updated.actualAntiSlipPrice) || 0)
      + (parseFloat(updated.actualAbrasionResistancePrice) || 0)
      + (parseFloat(updated.actualCoatingRemovalPrice) || 0)
      + (parseFloat(updated.actualMoistureMitigationPrice) || 0)
      + productsTotalPrice;

    updated.totalPrice = total.toFixed(2);
    setFormData(updated);
    setTimeout(() => { updatingFrom.current = null; }, 0);
  };

  // Recalculate total when products change
  const recalcTotalWithProducts = () => {
    const total = (parseFloat(formData.actualDiscount) || 0)
      + (parseFloat(formData.actualCrackPrice) || 0)
      + (parseFloat(formData.actualFloorPrice) || 0)
      + (parseFloat(formData.actualVerticalPrice) || 0)
      + (parseFloat(formData.actualAntiSlipPrice) || 0)
      + (parseFloat(formData.actualAbrasionResistancePrice) || 0)
      + (parseFloat(formData.actualCoatingRemovalPrice) || 0)
      + (parseFloat(formData.actualMoistureMitigationPrice) || 0)
      + productsTotalPrice;
    setFormData(prev => ({ ...prev, totalPrice: total.toFixed(2) }));
  };

  useEffect(() => {
    if (actualPricingInitialized.current) {
      recalcTotalWithProducts();
    }
  }, [productsTotalPrice]);

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
      + (parseFloat(formData.actualMoistureMitigationPrice) || 0)
      + productsTotalPrice;
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

  const handleStatusChange = (newStatus: JobStatus) => {
    const probMap: Record<JobStatus, string> = { Won: '100', Lost: '0', Pending: '20', Verbal: '80' };
    setFormData(prev => ({ ...prev, status: newStatus, probability: probMap[newStatus] }));
  };

  const handleSystemChange = (systemId: string) => {
    setFormData((prev) => ({ ...prev, system: systemId }));
    setShowBlendDropdown(true);
  };

  const handleChipBlendSelect = (blend: ChipBlend) => {
    setChipBlendInput(blend.name);
    setFormData((prev) => ({ ...prev, chipBlend: blend.name }));
    setShowBlendDropdown(false);
  };

  const handleChipBlendInputChange = (value: string) => {
    setChipBlendInput(value);
    setFormData((prev) => ({ ...prev, chipBlend: value }));
    setShowBlendDropdown(true);
  };

  const handleTagInputChange = (value: string) => {
    setFormData({ ...formData, tags: value });
    setShowTagDropdown(true);
  };

  const handleCustomerNameInputChange = (value: string) => {
    const exactMatch = availableCustomers.find(
      (customer) => customer.name.toLowerCase() === value.trim().toLowerCase()
    );

    setFormData({
      ...formData,
      customerName: value,
      customerAddress: exactMatch?.address || formData.customerAddress,
    });
    setShowCustomerDropdown(true);
  };

  const handleCustomerSelect = (customer: CustomerOption) => {
    setFormData({
      ...formData,
      customerName: customer.name,
      customerAddress: customer.address || '',
    });
    setShowCustomerDropdown(false);
  };

  const handleTagSelect = (selectedTag: string) => {
    const segments = formData.tags.split(',');
    const completed = segments
      .slice(0, -1)
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (!completed.some((tag) => tag.toLowerCase() === selectedTag.toLowerCase())) {
      completed.push(selectedTag);
    }

    const nextValue = completed.length > 0 ? `${completed.join(', ')}, ` : `${selectedTag}, `;
    setFormData({ ...formData, tags: nextValue });
    setShowTagDropdown(false);
  };

  
  const openAddReminder = () => {
    setActiveTab('reminders');
    setEditingReminderId(null);
    setReminderForm({
      subject: '',
      details: '',
      dueDate: new Date().toISOString().split('T')[0],
      dueTime: '09:00',
    });
    setShowReminderModal(true);
  };

  const openEditReminder = (reminder: JobReminder) => {
    setEditingReminderId(reminder.id);
    setReminderForm({
      subject: reminder.subject,
      details: reminder.details || '',
      dueDate: reminder.dueDate,
      dueTime: reminder.dueTime,
    });
    setShowReminderModal(true);
  };

  const closeReminderModal = () => {
    setShowReminderModal(false);
    setEditingReminderId(null);
    setReminderForm({ subject: '', details: '', dueDate: '', dueTime: '' });
  };

  const requestReminderNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (error) {
        console.warn('Notification permission request failed:', error);
      }
    }
  };

  const persistReminderChanges = async (nextReminders: JobReminder[]) => {
    setReminders(nextReminders);

    if (!jobId || !existingJob) {
      return;
    }

    const now = new Date().toISOString();
    const nextJob: Job = {
      ...existingJob,
      reminders: nextReminders.length > 0
        ? [...nextReminders].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
        : undefined,
      updatedAt: now,
      synced: false,
    };

    await updateJob(nextJob);
    setExistingJob(nextJob);
  };

  const handleSaveReminder = async () => {
    if (!reminderForm.subject.trim() || !reminderForm.dueDate || !reminderForm.dueTime) {
      alert('Please enter subject, date, and time for the reminder.');
      return;
    }

    const dueAt = new Date(`${reminderForm.dueDate}T${reminderForm.dueTime}`).toISOString();
    const now = new Date().toISOString();
    const nextReminders = editingReminderId
      ? reminders.map((reminder) => {
          if (reminder.id !== editingReminderId) return reminder;
          return {
            ...reminder,
            subject: reminderForm.subject.trim(),
            details: reminderForm.details.trim() || undefined,
            dueDate: reminderForm.dueDate,
            dueTime: reminderForm.dueTime,
            dueAt,
            updatedAt: now,
          };
        })
      : [
          ...reminders,
          {
            id: generateId(),
            subject: reminderForm.subject.trim(),
            details: reminderForm.details.trim() || undefined,
            dueDate: reminderForm.dueDate,
            dueTime: reminderForm.dueTime,
            dueAt,
            completed: false,
            createdAt: now,
            updatedAt: now,
          },
        ];

    setSavingReminder(true);
    try {
      await persistReminderChanges(nextReminders);
      await requestReminderNotificationPermission();
      closeReminderModal();
    } catch (error) {
      console.error('Error saving reminder:', error);
      alert('Error saving reminder. Please try again.');
    } finally {
      setSavingReminder(false);
    }
  };

  const handleDeleteReminder = async (id: string) => {
    const nextReminders = reminders.filter((reminder) => reminder.id !== id);
    try {
      await persistReminderChanges(nextReminders);
    } catch (error) {
      console.error('Error deleting reminder:', error);
      alert('Error deleting reminder. Please try again.');
    }
  };

  const handleCompleteReminder = async (id: string) => {
    const now = new Date().toISOString();
    const nextReminders = reminders.map((r) =>
      r.id === id ? { ...r, completed: true, updatedAt: now } : r
    );
    try {
      await persistReminderChanges(nextReminders);
      setNextReminderForm({ subject: '', dueDate: '', dueTime: '', details: '' });
      setShowNextReminderPrompt(true);
    } catch (error) {
      console.error('Error completing reminder:', error);
      alert('Error completing reminder. Please try again.');
    }
  };

  const handleCreateNextReminder = async () => {
    if (!nextReminderForm.subject.trim() || !nextReminderForm.dueDate || !nextReminderForm.dueTime) {
      alert('Please enter a subject, date, and time.');
      return;
    }
    const dueAt = new Date(`${nextReminderForm.dueDate}T${nextReminderForm.dueTime}`).toISOString();
    const now = new Date().toISOString();
    const newReminder: JobReminder = {
      id: generateId(),
      subject: nextReminderForm.subject.trim(),
      details: nextReminderForm.details.trim() || undefined,
      dueDate: nextReminderForm.dueDate,
      dueTime: nextReminderForm.dueTime,
      dueAt,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await persistReminderChanges([...reminders, newReminder]);
      setShowNextReminderPrompt(false);
    } catch (error) {
      console.error('Error creating next reminder:', error);
      alert('Error creating reminder. Please try again.');
    }
  };

  const persistFollowUpChanges = async (nextFollowUps: JobFollowUp[]) => {
    setFollowUps(nextFollowUps);

    if (!jobId || !existingJob) {
      return;
    }

    const now = new Date().toISOString();
    const nextJob: Job = {
      ...existingJob,
      followUps: nextFollowUps.length > 0
        ? [...nextFollowUps].sort((a, b) => a.date.localeCompare(b.date))
        : undefined,
      updatedAt: now,
      synced: false,
    };

    await updateJob(nextJob);
    setExistingJob(nextJob);
  };

  const handleLogFollowUp = async () => {
    if (!followUpForm.date) return;
    const now = new Date().toISOString();
    const newFollowUp: JobFollowUp = {
      id: generateId(),
      date: followUpForm.date,
      notes: followUpForm.notes.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    const nextFollowUps = [...followUps, newFollowUp];
    try {
      await persistFollowUpChanges(nextFollowUps);
    } catch (error) {
      console.error('Error saving follow-up:', error);
      alert('Error saving follow-up. Please try again.');
    }
    setFollowUpForm({ date: new Date().toISOString().slice(0, 10), notes: '' });
    setShowFollowUpForm(false);
  };

  const handleDeleteFollowUp = async (id: string) => {
    const nextFollowUps = followUps.filter(f => f.id !== id);
    try {
      await persistFollowUpChanges(nextFollowUps);
    } catch (error) {
      console.error('Error deleting follow-up:', error);
      alert('Error deleting follow-up. Please try again.');
    }
  };

  // Load bundle aggregate whenever groupJobs change (for bundled type)
  useEffect(() => {
    if (!existingJob?.groupId || existingJob?.groupType !== 'bundled' || groupJobs.length === 0) {
      setBundleAggregate(null);
      return;
    }
    let totalPrice = 0;
    let totalCosts = 0;
    for (const job of groupJobs) {
      totalPrice += job.totalPrice;
      const sys = { ...job.systemSnapshot };
      const c = { ...getDefaultCosts(), ...job.costsSnapshot };
      const p = job.pricingSnapshot ? { ...getDefaultPricing(), ...job.pricingSnapshot } : getDefaultPricing();
      const inputs = {
        floorFootage: job.floorFootage,
        verticalFootage: job.verticalFootage,
        crackFillFactor: job.crackFillFactor,
        travelDistance: job.travelDistance,
        installDate: job.installDate,
        installDays: job.installDays,
        jobHours: job.jobHours,
        totalPrice: job.totalPrice,
        includeBasecoatTint: job.includeBasecoatTint || false,
        includeTopcoatTint: job.includeTopcoatTint || false,
        antiSlip: job.antiSlip || false,
        abrasionResistance: job.abrasionResistance || false,
        cyclo1Topcoat: job.cyclo1Topcoat || false,
        cyclo1Coats: job.cyclo1Coats || 0,
        coatingRemoval: job.coatingRemoval || 'None' as const,
        moistureMitigation: job.moistureMitigation || false,
        disableGasHeater: job.disableGasHeater || false,
        installSchedule: job.installSchedule,
        tags: job.tags,
      };
      const calc = calculateJobOutputs(inputs, sys, c, job.laborersSnapshot, p);
      totalCosts += calc.totalCosts;
    }
    setBundleAggregate({ totalPrice, totalCosts });
  }, [groupJobs, existingJob]);

  const handleOpenGroupModal = (type: 'alternative' | 'bundled') => {
    setGroupModalType(type);
    setShowGroupModal(true);
  };

  const handleCreateGroupEstimate = async (copySource: boolean) => {
    if (!existingJob && !jobId) return;
    setCreatingGroupJob(true);
    try {
      const now = new Date().toISOString();
      const newGroupId = existingJob?.groupId || generateId();
      const newJobId = generateId();

      // If current job has no groupId yet, assign one and mark as primary
      if (!existingJob?.groupId && existingJob) {
        const updatedCurrentJob: Job = {
          ...existingJob,
          groupId: newGroupId,
          groupType: groupModalType,
          isPrimaryEstimate: true,
          updatedAt: now,
          synced: false,
        };
        await updateJob(updatedCurrentJob);
        setExistingJob(updatedCurrentJob);
      }

      const siblingCount = groupJobs.length;
      const defaultName = groupModalType === 'alternative'
        ? `Option ${String.fromCharCode(65 + siblingCount)}` // A, B, C...
        : `Part ${siblingCount + 1}`;

      let newJob: Job;
      if (copySource && existingJob) {
        newJob = {
          ...existingJob,
          id: newJobId,
          name: defaultName,
          groupId: newGroupId,
          groupType: groupModalType,
          isPrimaryEstimate: false,
          createdAt: now,
          updatedAt: now,
          synced: false,
          reminders: undefined,
        };
      } else {
        // Blank job - carry only customer info and group fields
        const defaultSystem = systems.find(s => s.isDefault) || systems[0];
        newJob = {
          id: newJobId,
          name: defaultName,
          customerName: existingJob?.customerName,
          customerAddress: existingJob?.customerAddress,
          systemId: defaultSystem?.id || existingJob?.systemId || '',
          floorFootage: 0,
          verticalFootage: 0,
          crackFillFactor: 0,
          travelDistance: 0,
          installDate: '',
          installDays: 1,
          jobHours: 0,
          totalPrice: 0,
          status: 'Pending',
          groupId: newGroupId,
          groupType: groupModalType,
          isPrimaryEstimate: false,
          costsSnapshot: existingJob?.costsSnapshot || costs,
          pricingSnapshot: existingJob?.pricingSnapshot || pricing,
          systemSnapshot: defaultSystem || existingJob?.systemSnapshot || systems[0],
          laborersSnapshot: [],
          createdAt: now,
          updatedAt: now,
          synced: false,
        };
      }

      await addJob(newJob);
      setShowGroupModal(false);

      // Refresh group jobs list
      const siblings = await getAllJobsByGroupId(newGroupId);
      setGroupJobs(siblings);

      // Navigate to the new job
      if (onEditJob) {
        onEditJob(newJobId);
      }
    } catch (error) {
      console.error('Error creating group estimate:', error);
      alert('Error creating estimate. Please try again.');
    } finally {
      setCreatingGroupJob(false);
    }
  };

  const handleAddExistingJobToGroup = async (targetJob: Job) => {
    if (!existingJob && !jobId) return;
    setCreatingGroupJob(true);
    try {
      const now = new Date().toISOString();
      const newGroupId = existingJob?.groupId || generateId();

      // If current job has no groupId yet, assign one and mark as primary
      if (!existingJob?.groupId && existingJob) {
        const updatedCurrent: Job = {
          ...existingJob,
          groupId: newGroupId,
          groupType: groupModalType,
          isPrimaryEstimate: true,
          updatedAt: now,
          synced: false,
        };
        await updateJob(updatedCurrent);
        setExistingJob(updatedCurrent);
      }

      // Update the target job to join this group
      await updateJob({
        ...targetJob,
        groupId: newGroupId,
        groupType: groupModalType,
        isPrimaryEstimate: false,
        updatedAt: now,
        synced: false,
      });

      setShowGroupModal(false);
      setModalView('options');
      setExistingJobSearch('');

      // Refresh group jobs and remove target from the ungrouped list
      const siblings = await getAllJobsByGroupId(newGroupId);
      setGroupJobs(siblings);
      setUngroupedJobs(prev => prev.filter(j => j.id !== targetJob.id));
    } catch (error) {
      console.error('Error adding existing job to group:', error);
      alert('Error adding job. Please try again.');
    } finally {
      setCreatingGroupJob(false);
    }
  };

  const handleRemoveFromGroup = async () => {
    if (!existingJob?.groupId) return;
    if (!window.confirm('Remove this estimate from the group? The estimate will remain but will no longer be part of this bundle/alternative set.')) return;
    try {
      const now = new Date().toISOString();
      const groupId = existingJob.groupId;

      // Clear group fields on the current job
      const updatedCurrent: Job = {
        ...existingJob,
        groupId: undefined,
        groupType: undefined,
        isPrimaryEstimate: undefined,
        updatedAt: now,
        synced: false,
      };
      await updateJob(updatedCurrent);

      // Check remaining siblings
      const remaining = groupJobs.filter(j => j.id !== existingJob.id);
      if (remaining.length === 1) {
        // Auto-ungroup the lone sibling
        await updateJob({
          ...remaining[0],
          groupId: undefined,
          groupType: undefined,
          isPrimaryEstimate: undefined,
          updatedAt: now,
          synced: false,
        });
      }

      // Navigate back so the dashboard reflects the ungrouped state
      onBack();
    } catch (error) {
      console.error('Error removing job from group:', error);
      alert('Error removing from group. Please try again.');
    }
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

      if (laborersToSave.length === 0) {
        const proceed = window.confirm('No laborers are assigned to any install days. Save anyway?');
        if (!proceed) {
          setSaving(false);
          return;
        }
      }

      if (hasMissingActuals) {
        const proceed = window.confirm('Some actual pricing fields are empty. Save anyway?');
        if (!proceed) {
          setSaving(false);
          return;
        }
      }

      // Calculate total hours from schedule
      const totalHours = installSchedule.reduce((sum, day) => sum + day.hours, 0);

      // Normalize chip blend name before saving (trim whitespace, title case)
      const normalizedChipBlend = normalizeChipBlendName(formData.chipBlend);
      const normalizedTags = parseJobTags(formData.tags);

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
        tags: normalizedTags.length > 0 ? normalizedTags : undefined,
        baseColor: formData.baseColor || undefined,
        status: formData.status,
        estimateDate: formData.estimateDate || undefined,
        decisionDate: formData.decisionDate || undefined,
        probability: parseInt(formData.probability) || 0,
        notes: formData.notes || undefined,
        includeBasecoatTint: formData.includeBasecoatTint,
        includeTopcoatTint: formData.includeTopcoatTint,
        tintColor: (formData.includeBasecoatTint || formData.includeTopcoatTint) ? (formData.tintColor || undefined) : undefined,
        antiSlip: formData.antiSlip,
        abrasionResistance: formData.abrasionResistance,
        cyclo1Topcoat: formData.cyclo1Topcoat,
        cyclo1Coats: parseInt(formData.cyclo1Coats) || 0,
        coatingRemoval: formData.coatingRemoval,
        moistureMitigation: formData.moistureMitigation,
        disableGasHeater: formData.disableGasHeater,
        // Actual pricing breakdown
        actualDiscount: parseFloat(formData.actualDiscount) || undefined,
        actualCrackPrice: parseFloat(formData.actualCrackPrice) || undefined,
        actualFloorPricePerSqft: parseFloat(formData.actualFloorPricePerSqft) || undefined,
        actualFloorPrice: parseFloat(formData.actualFloorPrice) || undefined,
        actualVerticalPricePerSqft: parseFloat(formData.actualVerticalPricePerSqft) || undefined,
        actualVerticalPrice: parseFloat(formData.actualVerticalPrice) || undefined,
        actualAntiSlipPrice: parseFloat(formData.actualAntiSlipPrice) || undefined,
        actualAbrasionResistancePrice: parseFloat(formData.actualAbrasionResistancePrice) || undefined,
        actualCoatingRemovalPrice: parseFloat(formData.actualCoatingRemovalPrice) || undefined,
        actualMoistureMitigationPrice: parseFloat(formData.actualMoistureMitigationPrice) || undefined,
        // Actual execution data
        actualInstallSchedule: actualInstallSchedule.length > 0 ? actualInstallSchedule : undefined,
        actualBaseCoatGallons: parseFloat(actualMaterials.actualBaseCoatGallons) || undefined,
        actualTopCoatGallons: parseFloat(actualMaterials.actualTopCoatGallons) || undefined,
        actualCyclo1Gallons: parseFloat(actualMaterials.actualCyclo1Gallons) || undefined,
        actualTintOz: parseFloat(actualMaterials.actualTintOz) || undefined,
        actualChipBoxes: parseFloat(actualMaterials.actualChipBoxes) || undefined,
        actualCrackRepairOz: parseFloat(actualMaterials.actualCrackRepairOz) || undefined,
        products: jobProducts.length > 0 ? jobProducts : undefined,
        reminders: reminders.length > 0
          ? [...reminders].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
          : undefined,
        followUps: followUps.length > 0
          ? [...followUps].sort((a, b) => a.date.localeCompare(b.date))
          : undefined,
        // Update snapshots if user chose to use current values, otherwise preserve original
        // Laborers can be edited, so always save current selection
        costsSnapshot: existingJob && !useCurrentValues ? existingJob.costsSnapshot : costs,
        pricingSnapshot: existingJob && !useCurrentValues ? existingJob.pricingSnapshot : pricing,
        systemSnapshot: existingJob && !useCurrentValues ? existingJob.systemSnapshot : selectedSystem,
        laborersSnapshot: laborersToSave,
        // Preserve group fields
        groupId: existingJob?.groupId,
        groupType: existingJob?.groupType,
        isPrimaryEstimate: existingJob?.isPrimaryEstimate,
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

  const noLaborersSelected = installSchedule.length === 0 || installSchedule.every(day => day.laborerIds.length === 0);

  // Visual cues: highlight any actual pricing field where the suggested value > 0 (field is relevant for this job)
  const relevantActuals = calculation ? {
    crackPrice: calculation.suggestedCrackPrice > 0,
    floorPrice: calculation.suggestedFloorPrice > 0,
    verticalPrice: calculation.suggestedVerticalPrice > 0,
    antiSlipPrice: calculation.suggestedAntiSlipPrice > 0,
    abrasionResistancePrice: calculation.suggestedAbrasionResistancePrice > 0,
    coatingRemovalPrice: calculation.suggestedCoatingRemovalPrice > 0,
    moistureMitigationPrice: calculation.suggestedMoistureMitigationPrice > 0,
  } : null;
  // Save-time warning: warn if actual is zero/empty when suggested > 0
  const hasMissingActuals = calculation ? (
    (calculation.suggestedCrackPrice > 0 && !(parseFloat(formData.actualCrackPrice) > 0)) ||
    (calculation.suggestedFloorPrice > 0 && !(parseFloat(formData.actualFloorPrice) > 0)) ||
    (calculation.suggestedVerticalPrice > 0 && !(parseFloat(formData.actualVerticalPrice) > 0)) ||
    (calculation.suggestedAntiSlipPrice > 0 && !(parseFloat(formData.actualAntiSlipPrice) > 0)) ||
    (calculation.suggestedAbrasionResistancePrice > 0 && !(parseFloat(formData.actualAbrasionResistancePrice) > 0)) ||
    (calculation.suggestedCoatingRemovalPrice > 0 && !(parseFloat(formData.actualCoatingRemovalPrice) > 0)) ||
    (calculation.suggestedMoistureMitigationPrice > 0 && !(parseFloat(formData.actualMoistureMitigationPrice) > 0))
  ) : false;

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
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{jobId ? 'Edit Job' : 'Create New Job'}</h2>
          <div className="flex items-center gap-2">
            {jobId && !existingJob?.groupId && (
              <>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-100 text-slate-800 rounded-lg font-semibold hover:bg-slate-200 active:bg-slate-300 transition-colors text-sm sm:text-base"
                  onClick={() => handleOpenGroupModal('alternative')}
                >
                  <Shuffle size={14} />
                  <span className="hidden sm:inline">Alternatives</span>
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-100 text-slate-800 rounded-lg font-semibold hover:bg-slate-200 active:bg-slate-300 transition-colors text-sm sm:text-base"
                  onClick={() => handleOpenGroupModal('bundled')}
                >
                  <Link size={14} />
                  <span className="hidden sm:inline">Bundle</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={openAddReminder}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-100 text-slate-800 rounded-lg font-semibold hover:bg-slate-200 active:bg-slate-300 transition-colors text-sm sm:text-base"
            >
              <Plus size={16} className="sm:w-[18px] sm:h-[18px]" />
              Add Reminder
            </button>
            <button
              type="submit"
              form="job-form"
              disabled={saving}
              className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-gf-lime text-white rounded-lg font-semibold hover:bg-gf-dark-green active:bg-gf-dark-green transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              <Save size={16} className="sm:w-[18px] sm:h-[18px]" />
              {saving ? 'Saving...' : jobId ? 'Update Job' : 'Create Job'}
            </button>
          </div>
        </div>

        {/* Group navigation bar */}
        {existingJob?.groupId && groupJobs.length > 0 && (
          <div className={`mb-4 rounded-lg border p-3 ${existingJob.groupType === 'bundled' ? 'bg-blue-50 border-blue-200' : 'bg-purple-50 border-purple-200'}`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                {existingJob.groupType === 'bundled' ? (
                  <Link size={14} className="text-blue-600 flex-shrink-0" />
                ) : (
                  <Shuffle size={14} className="text-purple-600 flex-shrink-0" />
                )}
                <span className={`text-xs font-bold uppercase tracking-wide ${existingJob.groupType === 'bundled' ? 'text-blue-700' : 'text-purple-700'}`}>
                  {existingJob.groupType === 'bundled' ? 'Bundle' : 'Alternatives'}
                </span>
                <span className="text-xs text-slate-500">{existingJob.customerName || 'Unnamed Customer'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleOpenGroupModal(existingJob.groupType || 'alternative')}
                  className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${existingJob.groupType === 'bundled' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
                >
                  <Plus size={11} />
                  {existingJob.groupType === 'bundled' ? 'Add Part' : 'Add Alternative'}
                </button>
                <button
                  type="button"
                  onClick={handleRemoveFromGroup}
                  title="Remove this estimate from the group"
                  className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md transition-colors bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600"
                >
                  <X size={11} />
                  Remove
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {groupJobs.map((gj) => (
                <button
                  key={gj.id}
                  type="button"
                  onClick={() => gj.id !== jobId && onEditJob && onEditJob(gj.id)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    gj.id === jobId
                      ? existingJob.groupType === 'bundled'
                        ? 'bg-blue-600 text-white'
                        : 'bg-purple-600 text-white'
                      : 'bg-white border border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-800 cursor-pointer'
                  }`}
                >
                  {gj.name}
                </button>
              ))}
            </div>
            {existingJob.groupType === 'bundled' && bundleAggregate && (
              <div className="mt-2 pt-2 border-t border-blue-200 flex items-center gap-4 text-xs text-blue-800 flex-wrap">
                <span>Combined Total: <strong>{formatCurrency(bundleAggregate.totalPrice)}</strong></span>
                <span>Total Cost: <strong>{formatCurrency(bundleAggregate.totalCosts)}</strong></span>
                <span>Combined Margin: <strong className={bundleAggregate.totalPrice > 0 ? ((bundleAggregate.totalPrice - bundleAggregate.totalCosts) / bundleAggregate.totalPrice * 100) >= 30 ? 'text-green-700' : 'text-orange-600' : ''}>
                  {bundleAggregate.totalPrice > 0 ? (((bundleAggregate.totalPrice - bundleAggregate.totalCosts) / bundleAggregate.totalPrice) * 100).toFixed(0) : 0}%
                </strong></span>
              </div>
            )}
          </div>
        )}

        {/* Snapshot Change Banner */}
        {showSnapshotBanner && snapshotChanges && (
          <SnapshotChangeBanner
            changes={snapshotChanges}
            onUpdate={handleUpdateToCurrentValues}
            onDismiss={handleKeepOriginalValues}
          />
        )}

        <form id="job-form" onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'details'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Details
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reminders')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'reminders'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Reminders
              {reminders.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-5 h-5 px-1 text-xs font-semibold rounded-full bg-gf-lime text-white">
                  {reminders.length}
                </span>
              )}
            </button>
            {formData.status === 'Won' && jobId && (
              <button
                type="button"
                onClick={() => setActiveTab('actuals')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'actuals'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Actuals
              </button>
            )}
          </div>

          {activeTab === 'details' && (
            <>
          {/* Job Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="md:col-span-2 lg:col-span-1">
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Job Name *</label>
              <input
                type="text"
                placeholder="e.g., Smith Residence - Kitchen"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-2 flex gap-3">
              <div className="relative w-1/4 min-w-0">
                <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Customer Name</label>
                <input
                  type="text"
                  placeholder="e.g., John Smith"
                  value={formData.customerName}
                  onChange={(e) => handleCustomerNameInputChange(e.target.value)}
                  onFocus={() => setShowCustomerDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                />
                {showCustomerDropdown && customerSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {customerSuggestions.map((customer) => (
                      <button
                        key={customer.name}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleCustomerSelect(customer);
                        }}
                        onClick={() => handleCustomerSelect(customer)}
                        className="w-full px-3 sm:px-4 py-2 text-left hover:bg-slate-100 text-xs sm:text-sm"
                      >
                        <div className="font-medium text-slate-800">{customer.name}</div>
                        {customer.address && <div className="text-slate-500 truncate">{customer.address}</div>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Customer Address</label>
                <input
                  type="text"
                  placeholder="e.g., 123 Main St, City, State 12345"
                  value={formData.customerAddress}
                  onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                />
              </div>
              <div className="w-28 shrink-0">
                <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Travel (mi)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={formData.travelDistance}
                  onChange={(e) => setFormData({ ...formData, travelDistance: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                />
              </div>
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
                <div className="flex-1">
                  <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Status</label>
                  <div className="flex flex-wrap gap-3 sm:gap-4">
                    {(['Pending', 'Verbal', 'Won', 'Lost'] as JobStatus[]).map((status) => (
                      <label key={status} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="status"
                          value={status}
                          checked={formData.status === status}
                          onChange={() => handleStatusChange(status)}
                          className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
                        />
                        <span className={`text-xs sm:text-sm ${
                          status === 'Won' ? 'text-green-700' :
                          status === 'Lost' ? 'text-red-700' :
                          status === 'Verbal' ? 'text-blue-700' :
                          'text-slate-700'
                        }`}>{status}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Probability</label>
                  <select
                    value={formData.probability}
                    onChange={(e) => setFormData(prev => ({ ...prev, probability: e.target.value }))}
                    className="w-28 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
                  >
                    {[0, 20, 40, 60, 80, 100].map(p => (
                      <option key={p} value={p}>{p}%</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Decision Date</label>
                  <input
                    type="date"
                    value={formData.decisionDate}
                    onChange={(e) => setFormData({ ...formData, decisionDate: e.target.value })}
                    className="w-full sm:w-auto px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Notes</label>
              <textarea
                placeholder="Add any additional notes about this job..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent resize-y"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-3 relative">
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Tags</label>
              <input
                type="text"
                placeholder="e.g., Commercial, Warranty, HOA"
                value={formData.tags}
                onChange={(e) => handleTagInputChange(e.target.value)}
                onFocus={() => setShowTagDropdown(true)}
                onBlur={() => setTimeout(() => setShowTagDropdown(false), 200)}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
              />
              <p className="mt-1 text-xs text-slate-500">Comma-separated tags used for reporting and filtering.</p>
              {showTagDropdown && tagSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {tagSuggestions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleTagSelect(tag)}
                      className="w-full px-3 sm:px-4 py-2 text-left hover:bg-slate-100 text-xs sm:text-sm"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Chip System *</label>
              <select
                value={formData.system}
                onChange={(e) => handleSystemChange(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent bg-white"
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
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Vertical Sq Footage</label>
              <input
                type="number"
                placeholder="0"
                value={formData.verticalFootage}
                onChange={(e) => setFormData({ ...formData, verticalFootage: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
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
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Install Date</label>
              <input
                type="date"
                value={formData.installDate}
                onChange={(e) => setFormData({ ...formData, installDate: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
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
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
              />
              {showBlendDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {applicableChipBlends
                    .filter((b) => b.name.toLowerCase().includes(chipBlendInput.toLowerCase()))
                    .map((blend) => (
                      <button
                        key={blend.id}
                        type="button"
                        onClick={() => handleChipBlendSelect(blend)}
                        className="w-full px-3 sm:px-4 py-2 text-left hover:bg-slate-100 text-xs sm:text-sm"
                      >
                        {blend.name}
                      </button>
                    ))}
                  {applicableChipBlends.filter((b) => b.name.toLowerCase().includes(chipBlendInput.toLowerCase())).length === 0 && (
                    <p className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-500 italic">
                      No applicable chip blends for this system.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Base Coat Color</label>
              <select
                value={formData.baseColor}
                onChange={(e) => setFormData({ ...formData, baseColor: e.target.value as BaseColor })}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
              >
                <option value="">Select a base coat color...</option>
                {availableBaseCoatColors.map((color) => (
                  <option key={color.id} value={color.name}>
                    {color.name}
                  </option>
                ))}
              </select>
              {selectedBlend && selectedBlend.baseCoatColorIds && selectedBlend.baseCoatColorIds.length > 0 && availableBaseCoatColors.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">This blend has no active base coat colors assigned.</p>
              )}
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
                    className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">No</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="includeBasecoatTint"
                    checked={formData.includeBasecoatTint}
                    onChange={() => setFormData({ ...formData, includeBasecoatTint: true })}
                    className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
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
                    className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">No</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="includeTopcoatTint"
                    checked={formData.includeTopcoatTint}
                    onChange={() => setFormData({ ...formData, includeTopcoatTint: true })}
                    className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">Yes</span>
                </label>
              </div>
            </div>

            {(formData.includeBasecoatTint || formData.includeTopcoatTint) && (
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Tint Color</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.tintColor}
                    onChange={(e) => {
                      setFormData({ ...formData, tintColor: e.target.value });
                      setShowTintColorDropdown(true);
                    }}
                    onFocus={() => setShowTintColorDropdown(true)}
                    onBlur={() => setTimeout(() => setShowTintColorDropdown(false), 200)}
                    placeholder="Select or type a new color..."
                    className="w-full px-3 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
                  />
                  {showTintColorDropdown && tintInventory.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {tintInventory
                        .filter((t) => t.color.toLowerCase().includes(formData.tintColor.toLowerCase()))
                        .map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, tintColor: t.color });
                              setShowTintColorDropdown(false);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-slate-100 text-sm"
                          >
                            {t.color}
                            <span className="ml-2 text-slate-400 text-xs">{t.ounces} oz on hand</span>
                          </button>
                        ))}
                      {formData.tintColor && !tintInventory.some((t) => t.color.toLowerCase() === formData.tintColor.toLowerCase()) && (
                        <div className="px-3 py-2 text-sm text-slate-500 border-t border-slate-200">
                          New color — add to inventory to track usage
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Anti-Slip</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="antiSlip"
                    checked={!formData.antiSlip}
                    onChange={() => setFormData({ ...formData, antiSlip: false })}
                    className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">No</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="antiSlip"
                    checked={formData.antiSlip}
                    onChange={() => setFormData({ ...formData, antiSlip: true })}
                    className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
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
                    className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">No</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="abrasionResistance"
                    checked={formData.abrasionResistance}
                    onChange={() => setFormData({ ...formData, abrasionResistance: true })}
                    className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
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
                    className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">No</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="cyclo1Topcoat"
                    checked={formData.cyclo1Topcoat}
                    onChange={() => setFormData({ ...formData, cyclo1Topcoat: true })}
                    className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">Yes</span>
                </label>
              </div>
            </div>

            {formData.cyclo1Topcoat && (
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Additional Cyclo1 Coats (Job)</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="cyclo1Coats"
                      checked={formData.cyclo1Coats === '0'}
                      onChange={() => setFormData({ ...formData, cyclo1Coats: '0' })}
                      className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
                    />
                    <span className="text-xs sm:text-sm text-slate-700">0</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="cyclo1Coats"
                      checked={formData.cyclo1Coats === '1'}
                      onChange={() => setFormData({ ...formData, cyclo1Coats: '1' })}
                      className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
                    />
                    <span className="text-xs sm:text-sm text-slate-700">1</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="cyclo1Coats"
                      checked={formData.cyclo1Coats === '2'}
                      onChange={() => setFormData({ ...formData, cyclo1Coats: '2' })}
                      className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
                    />
                    <span className="text-xs sm:text-sm text-slate-700">2</span>
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
                      className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
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
                    className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">No</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="moistureMitigation"
                    checked={formData.moistureMitigation}
                    onChange={() => setFormData({ ...formData, moistureMitigation: true })}
                    className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">Yes</span>
                </label>
              </div>
            </div>

          </div>

          {/* Install Days - just above daily schedule */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Install Days</label>
            <input
              type="number"
              placeholder="1"
              min="1"
              value={formData.installDays}
              onChange={(e) => setFormData({ ...formData, installDays: e.target.value })}
              className="w-full sm:w-48 px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
            />
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
              defaultDayHours={pricing.defaultDayHours ?? 8}
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
                  {formData.moistureMitigation && (
                    <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
                      <p className="text-xs text-slate-500">Moisture Mitigation ({calculation.moistureMitigationGallons} gal)</p>
                      <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.moistureMitigationMaterialCost)}</p>
                    </div>
                  )}
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
                    <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={formData.disableGasHeater}
                        onChange={(e) => setFormData({ ...formData, disableGasHeater: e.target.checked })}
                        className="w-3.5 h-3.5 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
                      />
                      Disable (force $0)
                    </label>
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
                {noLaborersSelected && (
                  <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-300 rounded-lg text-xs text-yellow-800">
                    <span className="font-semibold">⚠ No laborers assigned.</span>
                    <span>Labor costs will be $0. Assign laborers in the Daily Schedule above.</span>
                  </div>
                )}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4">
                  <div>
                    <label className="text-xs text-green-600">Discount</label>
                    <input type="number" step="0.01" value={formData.actualDiscount}
                      onChange={(e) => recalcActualTotal('actualDiscount', e.target.value)}
                      className="w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b border-green-300 focus:outline-none focus:border-green-600 p-0" />
                  </div>
                  <div className={relevantActuals?.crackPrice ? 'rounded px-1 -mx-1 bg-orange-50' : ''}>
                    <label className="text-xs text-green-600">Crack Price</label>
                    <input type="number" step="0.01" value={formData.actualCrackPrice}
                      onChange={(e) => recalcActualTotal('actualCrackPrice', e.target.value)}
                      className={`w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b focus:outline-none p-0 ${relevantActuals?.crackPrice ? 'border-orange-400 focus:border-orange-500' : 'border-green-300 focus:border-green-600'}`} />
                  </div>
                  <div className={relevantActuals?.floorPrice ? 'rounded px-1 -mx-1 bg-orange-50' : ''}>
                    <label className="text-xs text-green-600">Floor $/sqft</label>
                    <input type="number" step="0.01" value={formData.actualFloorPricePerSqft}
                      onChange={(e) => recalcActualTotal('actualFloorPricePerSqft', e.target.value)}
                      className={`w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b focus:outline-none p-0 ${relevantActuals?.floorPrice ? 'border-orange-400 focus:border-orange-500' : 'border-green-300 focus:border-green-600'}`} />
                  </div>
                  <div className={relevantActuals?.floorPrice ? 'rounded px-1 -mx-1 bg-orange-50' : ''}>
                    <label className="text-xs text-green-600">Floor Price</label>
                    <input type="number" step="0.01" value={formData.actualFloorPrice}
                      onChange={(e) => recalcActualTotal('actualFloorPrice', e.target.value)}
                      className={`w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b focus:outline-none p-0 ${relevantActuals?.floorPrice ? 'border-orange-400 focus:border-orange-500' : 'border-green-300 focus:border-green-600'}`} />
                  </div>
                  <div className={relevantActuals?.verticalPrice ? 'rounded px-1 -mx-1 bg-orange-50' : ''}>
                    <label className="text-xs text-green-600">Vertical $/sqft</label>
                    <input type="number" step="0.01" value={formData.actualVerticalPricePerSqft}
                      onChange={(e) => recalcActualTotal('actualVerticalPricePerSqft', e.target.value)}
                      className={`w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b focus:outline-none p-0 ${relevantActuals?.verticalPrice ? 'border-orange-400 focus:border-orange-500' : 'border-green-300 focus:border-green-600'}`} />
                  </div>
                  <div className={relevantActuals?.verticalPrice ? 'rounded px-1 -mx-1 bg-orange-50' : ''}>
                    <label className="text-xs text-green-600">Vertical Price</label>
                    <input type="number" step="0.01" value={formData.actualVerticalPrice}
                      onChange={(e) => recalcActualTotal('actualVerticalPrice', e.target.value)}
                      className={`w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b focus:outline-none p-0 ${relevantActuals?.verticalPrice ? 'border-orange-400 focus:border-orange-500' : 'border-green-300 focus:border-green-600'}`} />
                  </div>
                  <div className={relevantActuals?.antiSlipPrice ? 'rounded px-1 -mx-1 bg-orange-50' : ''}>
                    <label className="text-xs text-green-600">Anti-Slip Price</label>
                    <input type="number" step="0.01" value={formData.actualAntiSlipPrice}
                      onChange={(e) => recalcActualTotal('actualAntiSlipPrice', e.target.value)}
                      className={`w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b focus:outline-none p-0 ${relevantActuals?.antiSlipPrice ? 'border-orange-400 focus:border-orange-500' : 'border-green-300 focus:border-green-600'}`} />
                  </div>
                  <div className={relevantActuals?.abrasionResistancePrice ? 'rounded px-1 -mx-1 bg-orange-50' : ''}>
                    <label className="text-xs text-green-600">Abrasion Resistance</label>
                    <input type="number" step="0.01" value={formData.actualAbrasionResistancePrice}
                      onChange={(e) => recalcActualTotal('actualAbrasionResistancePrice', e.target.value)}
                      className={`w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b focus:outline-none p-0 ${relevantActuals?.abrasionResistancePrice ? 'border-orange-400 focus:border-orange-500' : 'border-green-300 focus:border-green-600'}`} />
                  </div>
                  <div className={relevantActuals?.coatingRemovalPrice ? 'rounded px-1 -mx-1 bg-orange-50' : ''}>
                    <label className="text-xs text-green-600">Coating Removal</label>
                    <input type="number" step="0.01" value={formData.actualCoatingRemovalPrice}
                      onChange={(e) => recalcActualTotal('actualCoatingRemovalPrice', e.target.value)}
                      className={`w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b focus:outline-none p-0 ${relevantActuals?.coatingRemovalPrice ? 'border-orange-400 focus:border-orange-500' : 'border-green-300 focus:border-green-600'}`} />
                  </div>
                  <div className={relevantActuals?.moistureMitigationPrice ? 'rounded px-1 -mx-1 bg-orange-50' : ''}>
                    <label className="text-xs text-green-600">Moisture Mitigation</label>
                    <input type="number" step="0.01" value={formData.actualMoistureMitigationPrice}
                      onChange={(e) => recalcActualTotal('actualMoistureMitigationPrice', e.target.value)}
                      className={`w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b focus:outline-none p-0 ${relevantActuals?.moistureMitigationPrice ? 'border-orange-400 focus:border-orange-500' : 'border-green-300 focus:border-green-600'}`} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-green-200">
                  {(() => {
                    const totalPrice = parseFloat(formData.totalPrice) || 0;
                    const floorFootage = parseFloat(formData.floorFootage) || 0;
                    const effectivePricePerSqft = floorFootage > 0 ? totalPrice / floorFootage : 0;
                    const actualMargin = totalPrice - calculation.totalCosts - productsTotalCost;
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

              {/* Products (collapsible) */}
              <div className="rounded-lg border border-slate-200 mb-4 sm:mb-6">
                <button
                  type="button"
                  onClick={() => setShowProductsSection(!showProductsSection)}
                  className="w-full flex items-center justify-between px-3 sm:px-4 py-3 text-left hover:bg-slate-50 transition-colors rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs sm:text-sm font-semibold text-slate-700 uppercase tracking-wide">Products</h4>
                    {jobProducts.length > 0 && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                        {jobProducts.length}
                      </span>
                    )}
                  </div>
                  {showProductsSection ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </button>

                {showProductsSection && (
                  <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-slate-200">
                    {/* Product selector */}
                    <div className="flex items-center gap-2 mt-3 mb-3">
                      <select
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                      >
                        <option value="">Select a product...</option>
                        {allProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — {formatCurrency(p.price)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedProductId) return;
                          const product = allProducts.find((p) => p.id === selectedProductId);
                          if (!product) return;
                          const existing = jobProducts.find((jp) => jp.productId === product.id);
                          if (existing) {
                            setJobProducts(jobProducts.map((jp) =>
                              jp.productId === product.id ? { ...jp, quantity: jp.quantity + 1 } : jp
                            ));
                          } else {
                            setJobProducts([...jobProducts, {
                              productId: product.id,
                              productName: product.name,
                              quantity: 1,
                              unitCost: product.cost,
                              unitPrice: product.price,
                            }]);
                          }
                          setSelectedProductId('');
                        }}
                        disabled={!selectedProductId}
                        className="flex items-center gap-1 px-3 py-2 bg-gf-lime text-white text-sm rounded-lg hover:bg-gf-dark-green transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus size={14} />
                        Add
                      </button>
                    </div>

                    {allProducts.length === 0 && (
                      <p className="text-sm text-slate-500 py-2">No products in catalog. Add products from the Products page first.</p>
                    )}

                    {/* Products table */}
                    {jobProducts.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-xs text-slate-500">
                              <th className="text-left py-2 font-medium">Product</th>
                              <th className="text-right py-2 font-medium w-20">Qty</th>
                              <th className="text-right py-2 font-medium">Unit Cost</th>
                              <th className="text-right py-2 font-medium w-28">Unit Price</th>
                              <th className="text-right py-2 font-medium">Line Total</th>
                              <th className="text-right py-2 font-medium w-10"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {jobProducts.map((jp, idx) => (
                              <tr key={jp.productId} className="border-b border-slate-100">
                                <td className="py-2 text-slate-900">{jp.productName}</td>
                                <td className="py-2 text-right">
                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={jp.quantity}
                                    onChange={(e) => {
                                      const qty = parseInt(e.target.value) || 1;
                                      setJobProducts(jobProducts.map((p, i) =>
                                        i === idx ? { ...p, quantity: qty } : p
                                      ));
                                    }}
                                    className="w-16 text-right text-sm bg-transparent border-b border-slate-300 focus:outline-none focus:border-gf-lime p-0"
                                  />
                                </td>
                                <td className="py-2 text-right text-slate-500">{formatCurrency(jp.unitCost)}</td>
                                <td className="py-2 text-right">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={jp.unitPrice}
                                    onChange={(e) => {
                                      const price = parseFloat(e.target.value) || 0;
                                      setJobProducts(jobProducts.map((p, i) =>
                                        i === idx ? { ...p, unitPrice: price } : p
                                      ));
                                    }}
                                    className="w-24 text-right text-sm bg-transparent border-b border-slate-300 focus:outline-none focus:border-gf-lime p-0"
                                  />
                                </td>
                                <td className="py-2 text-right text-slate-900 font-medium">
                                  {formatCurrency(jp.quantity * jp.unitPrice)}
                                </td>
                                <td className="py-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() => setJobProducts(jobProducts.filter((_, i) => i !== idx))}
                                    className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                  >
                                    <X size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-slate-200">
                              <td colSpan={2} className="py-2 text-xs text-slate-500 font-medium">Totals</td>
                              <td className="py-2 text-right text-xs text-slate-500 font-medium">{formatCurrency(productsTotalCost)}</td>
                              <td></td>
                              <td className="py-2 text-right text-sm text-slate-900 font-semibold">{formatCurrency(productsTotalPrice)}</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Suggested Pricing */}
              <div className="bg-green-50 rounded-lg p-3 sm:p-4 border border-green-200">
                <h4 className="text-xs sm:text-sm font-semibold text-gf-dark-green mb-2 sm:mb-3 uppercase tracking-wide">Suggested Pricing</h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4">
                  <div>
                    <p className="text-xs text-gf-dark-green">Discount</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold text-gf-dark-green">{formatCurrency(calculation.suggestedDiscount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gf-dark-green">Crack Price</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold text-gf-dark-green">{formatCurrency(calculation.suggestedCrackPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gf-dark-green">Floor $/sqft</p>
                    <p className={`text-sm sm:text-base md:text-lg font-semibold ${(() => {
                      const selectedSystem = systems.find(s => s.id === formData.system);
                      const min = selectedSystem?.floorPriceMin ?? 6;
                      const max = selectedSystem?.floorPriceMax ?? 8;
                      return (calculation.suggestedFloorPricePerSqft < min || calculation.suggestedFloorPricePerSqft > max) ? 'text-red-600' : 'text-gf-dark-green';
                    })()}`}>
                      {formatCurrency(calculation.suggestedFloorPricePerSqft)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gf-dark-green">Floor Price</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold text-gf-dark-green">{formatCurrency(calculation.suggestedFloorPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gf-dark-green">Vertical Price - {formatCurrency(usedPricing.verticalPricePerSqft)}/sqft</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold text-gf-dark-green">{formatCurrency(calculation.suggestedVerticalPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gf-dark-green">Anti-Slip Price - {formatCurrency(usedPricing.antiSlipPricePerSqft)}/sqft</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold text-gf-dark-green">{formatCurrency(calculation.suggestedAntiSlipPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gf-dark-green">Abrasion Resistance - {formatCurrency(usedPricing.abrasionResistancePricePerSqft)}/sqft</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold text-gf-dark-green">{formatCurrency(calculation.suggestedAbrasionResistancePrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gf-dark-green">
                      Coating Removal - {formData.coatingRemoval}
                      {formData.coatingRemoval === 'Paint' && ` - ${formatCurrency(usedPricing.coatingRemovalPaintPerSqft)}/sqft`}
                      {formData.coatingRemoval === 'Epoxy' && ` - ${formatCurrency(usedPricing.coatingRemovalEpoxyPerSqft)}/sqft`}
                    </p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold text-gf-dark-green">{formatCurrency(calculation.suggestedCoatingRemovalPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gf-dark-green">Moisture Mitigation - {formatCurrency(usedPricing.moistureMitigationPerSqft)}/sqft</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold text-gf-dark-green">{formatCurrency(calculation.suggestedMoistureMitigationPrice)}</p>
                    {calculation.moistureMitigationGallons > 0 && (
                      <p className="text-xs text-gf-grey mt-0.5">{calculation.moistureMitigationGallons} gal · material {formatCurrency(calculation.moistureMitigationMaterialCost)}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-green-200">
                  <div>
                    <p className="text-xs sm:text-sm text-gf-dark-green">Effective $/Sqft</p>
                    <p className="text-xl sm:text-2xl font-bold text-gf-dark-green">{formatCurrency(calculation.suggestedEffectivePricePerSqft)}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gf-dark-green">Suggested Total</p>
                    <p className="text-xl sm:text-2xl font-bold text-gf-dark-green">{formatCurrency(calculation.suggestedTotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gf-dark-green">Suggested Margin</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-600">{formatCurrency(calculation.suggestedMargin)}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gf-dark-green">Margin %</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-600">{calculation.suggestedMarginPct.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            </div>
          )}

            </>
          )}

          {activeTab === 'actuals' && (
            <div className="space-y-6">
              {/* Section A: Actual Labor */}
              <div className="rounded-lg border border-slate-200 p-4 sm:p-5 bg-slate-50">
                <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-1">Actual Labor</h3>
                <p className="text-xs text-slate-500 mb-4">Record actual hours and crew for each install day.</p>
                <InstallDayScheduleComponent
                  installDays={parseFloat(formData.installDays) || 1}
                  schedule={actualInstallSchedule}
                  availableLaborers={existingJob
                    ? [...activeLaborers, ...existingJob.laborersSnapshot.filter(sl => !activeLaborers.some(al => al.id === sl.id))]
                    : activeLaborers
                  }
                  onChange={(s) => setActualInstallSchedule(s as ActualDaySchedule[])}
                  defaultDayHours={pricing.defaultDayHours ?? 8}
                />
              </div>

              {/* Section B: Actual Materials */}
              <div className="rounded-lg border border-slate-200 p-4 sm:p-5 bg-slate-50">
                <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-1">Actual Materials Used</h3>
                <p className="text-xs text-slate-500 mb-4">Enter quantities actually consumed. Estimated amounts shown as reference.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Base Coat (gal)
                      {calculation && <span className="ml-1 text-slate-400 font-normal">est. {calculation.baseGallons.toFixed(1)}</span>}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder={calculation ? calculation.baseGallons.toFixed(1) : '0'}
                      value={actualMaterials.actualBaseCoatGallons}
                      onChange={(e) => setActualMaterials(prev => ({ ...prev, actualBaseCoatGallons: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Top Coat (gal)
                      {calculation && <span className="ml-1 text-slate-400 font-normal">est. {calculation.topGallons.toFixed(1)}</span>}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder={calculation ? calculation.topGallons.toFixed(1) : '0'}
                      value={actualMaterials.actualTopCoatGallons}
                      onChange={(e) => setActualMaterials(prev => ({ ...prev, actualTopCoatGallons: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Cyclo1 (gal)
                      {calculation && <span className="ml-1 text-slate-400 font-normal">est. {calculation.cyclo1Needed.toFixed(1)}</span>}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder={calculation ? calculation.cyclo1Needed.toFixed(1) : '0'}
                      value={actualMaterials.actualCyclo1Gallons}
                      onChange={(e) => setActualMaterials(prev => ({ ...prev, actualCyclo1Gallons: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tint (oz)
                      {calculation && <span className="ml-1 text-slate-400 font-normal">est. {calculation.tintNeeded.toFixed(1)}</span>}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder={calculation ? calculation.tintNeeded.toFixed(1) : '0'}
                      value={actualMaterials.actualTintOz}
                      onChange={(e) => setActualMaterials(prev => ({ ...prev, actualTintOz: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Chip Boxes
                      {calculation && <span className="ml-1 text-slate-400 font-normal">est. {calculation.chipNeeded}</span>}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder={calculation ? calculation.chipNeeded.toString() : '0'}
                      value={actualMaterials.actualChipBoxes}
                      onChange={(e) => setActualMaterials(prev => ({ ...prev, actualChipBoxes: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
                    />
                  </div>
                  {calculation && calculation.crackFillGallons > 0 && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Crack Repair (oz)
                        <span className="ml-1 text-slate-400 font-normal">est. {(calculation.crackFillGallons * 128).toFixed(0)}</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder={(calculation.crackFillGallons * 128).toFixed(0)}
                        value={actualMaterials.actualCrackRepairOz}
                        onChange={(e) => setActualMaterials(prev => ({ ...prev, actualCrackRepairOz: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Section C: Actual vs Estimated Cost Comparison */}
              {actualCalculation && calculation && (
                <div className="rounded-lg border border-slate-200 p-4 sm:p-5 bg-white">
                  <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-4">Estimated vs. Actual Costs</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 pr-4 text-xs font-semibold text-slate-600 w-32">Category</th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-slate-600">Estimated</th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-slate-600">Actual</th>
                          <th className="text-right py-2 pl-3 text-xs font-semibold text-slate-600">Difference</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[
                          { label: 'Chip', est: calculation.chipCost, act: actualCalculation.actualChipCost },
                          { label: 'Base Coat', est: calculation.baseCost, act: actualCalculation.actualBaseCost },
                          { label: 'Top Coat', est: calculation.topCost, act: actualCalculation.actualTopCost },
                          { label: 'Cyclo1', est: calculation.cyclo1Cost, act: actualCalculation.actualCyclo1Cost },
                          { label: 'Tint', est: calculation.tintCost, act: actualCalculation.actualTintCost },
                          ...(calculation.crackFillCost > 0 ? [{ label: 'Crack Repair', est: calculation.crackFillCost, act: actualCalculation.actualCrackRepairCost }] : []),
                          {
                            label: 'Gas',
                            est: calculation.gasGeneratorCost + calculation.gasHeaterCost + calculation.gasTravelCost,
                            act: actualCalculation.actualGasGeneratorCost + actualCalculation.actualGasHeaterCost + actualCalculation.actualGasTravelCost,
                          },
                          { label: 'Labor', est: calculation.laborCost, act: actualCalculation.actualLaborCost },
                          { label: 'Consumables', est: calculation.consumablesCost, act: actualCalculation.actualConsumablesCost },
                          { label: 'Royalty', est: calculation.royaltyCost, act: actualCalculation.actualRoyaltyCost },
                        ].map(({ label, est, act }) => {
                          const diff = act - est;
                          return (
                            <tr key={label}>
                              <td className="py-2 pr-4 text-xs text-slate-700">{label}</td>
                              <td className="py-2 px-3 text-right text-xs text-slate-600">{formatCurrency(est)}</td>
                              <td className="py-2 px-3 text-right text-xs text-slate-800 font-medium">{formatCurrency(act)}</td>
                              <td className={`py-2 pl-3 text-right text-xs font-medium ${diff > 0.01 ? 'text-red-600' : diff < -0.01 ? 'text-green-700' : 'text-slate-500'}`}>
                                {diff > 0.01 ? '+' : ''}{formatCurrency(diff)}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="border-t-2 border-slate-300 font-semibold">
                          <td className="py-2.5 pr-4 text-sm text-slate-900">Total</td>
                          <td className="py-2.5 px-3 text-right text-sm text-slate-700">{formatCurrency(calculation.totalCosts)}</td>
                          <td className="py-2.5 px-3 text-right text-sm text-slate-900">{formatCurrency(actualCalculation.actualTotalCosts)}</td>
                          <td className={`py-2.5 pl-3 text-right text-sm font-semibold ${(actualCalculation.actualTotalCosts - calculation.totalCosts) > 0.01 ? 'text-red-600' : 'text-green-700'}`}>
                            {(actualCalculation.actualTotalCosts - calculation.totalCosts) > 0.01 ? '+' : ''}{formatCurrency(actualCalculation.actualTotalCosts - calculation.totalCosts)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Margin summary cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-4 border-t border-slate-200">
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <p className="text-xs text-slate-500 mb-1">Estimated Margin</p>
                      <p className="text-lg font-bold text-slate-800">{formatCurrency(calculation.jobMargin)}</p>
                      <p className="text-xs text-slate-500">{calculation.totalCosts > 0 ? ((calculation.jobMargin / (parseFloat(formData.totalPrice) || 1)) * 100).toFixed(1) : '0.0'}%</p>
                    </div>
                    <div className={`rounded-lg p-3 border ${actualCalculation.actualMargin >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <p className="text-xs text-slate-500 mb-1">Actual Margin</p>
                      <p className={`text-lg font-bold ${actualCalculation.actualMargin >= 0 ? 'text-green-800' : 'text-red-700'}`}>
                        {formatCurrency(actualCalculation.actualMargin)}
                      </p>
                      <p className="text-xs text-slate-500">{actualCalculation.actualMarginPct.toFixed(1)}%</p>
                    </div>
                    <div className={`rounded-lg p-3 border ${(actualCalculation.actualMargin - calculation.jobMargin) >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <p className="text-xs text-slate-500 mb-1">Margin Difference</p>
                      <p className={`text-lg font-bold ${(actualCalculation.actualMargin - calculation.jobMargin) >= 0 ? 'text-green-800' : 'text-red-700'}`}>
                        {(actualCalculation.actualMargin - calculation.jobMargin) >= 0 ? '+' : ''}{formatCurrency(actualCalculation.actualMargin - calculation.jobMargin)}
                      </p>
                      <p className="text-xs text-slate-500">vs. estimated</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'reminders' && (
            <div className="rounded-lg border border-slate-200 p-4 sm:p-5 bg-slate-50">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-slate-900">Reminders</h3>
                  <p className="text-xs text-slate-500 mt-1">Task reminders related to this job.</p>
                </div>
                <button
                  type="button"
                  onClick={openAddReminder}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium bg-gf-lime text-white rounded-lg hover:bg-gf-dark-green transition-colors"
                >
                  <Plus size={14} />
                  Add Reminder
                </button>
              </div>

              {reminders.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No reminders added.</p>
              ) : (
                <div className="space-y-2">
                  {[...reminders]
                    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
                    .map((reminder) => (
                      <div key={reminder.id} className={`flex items-start justify-between gap-3 p-3 bg-white border rounded-lg ${reminder.completed ? 'border-slate-100 opacity-60' : 'border-slate-200'}`}>
                        <button
                          type="button"
                          onClick={() => !reminder.completed && openEditReminder(reminder)}
                          className="text-left flex-1"
                          disabled={reminder.completed}
                        >
                          <p className={`text-sm font-semibold ${reminder.completed ? 'line-through text-slate-400' : 'text-slate-900'}`}>{reminder.subject}</p>
                          <p className="text-xs text-slate-600">Due {new Date(reminder.dueAt).toLocaleString()}</p>
                          {reminder.details && (
                            <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">{reminder.details}</p>
                          )}
                          {reminder.completed && <p className="text-xs text-green-600 mt-0.5">Completed</p>}
                        </button>
                        <div className="flex items-center gap-1">
                          {reminder.details && (
                            <button
                              type="button"
                              onClick={async () => {
                                await navigator.clipboard.writeText(reminder.details!);
                                setCopiedReminderId(reminder.id);
                                setTimeout(() => setCopiedReminderId(null), 2000);
                              }}
                              className="p-1.5 text-slate-400 hover:text-gf-dark-green hover:bg-green-50 rounded-lg transition-colors"
                              title="Copy message"
                            >
                              {copiedReminderId === reminder.id ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                            </button>
                          )}
                          {!reminder.completed && (
                            <button
                              type="button"
                              onClick={() => handleCompleteReminder(reminder.id)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Mark complete"
                            >
                              <Check size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteReminder(reminder.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete reminder"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Follow-ups section */}
              <div className="mt-5 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-slate-900">Follow-ups</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Log contacts and interactions with this customer.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFollowUpForm({ date: new Date().toISOString().slice(0, 10), notes: '' });
                      setShowFollowUpForm(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium bg-gf-lime text-white rounded-lg hover:bg-gf-dark-green transition-colors"
                  >
                    <Plus size={14} />
                    Log Follow-up
                  </button>
                </div>

                {showFollowUpForm && (
                  <div className="mb-3 p-3 bg-white border border-gf-lime rounded-lg space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-700 mb-1">Date *</label>
                        <input
                          type="date"
                          value={followUpForm.date}
                          onChange={(e) => setFollowUpForm({ ...followUpForm, date: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                      <textarea
                        value={followUpForm.notes}
                        onChange={(e) => setFollowUpForm({ ...followUpForm, notes: e.target.value })}
                        placeholder="What happened? (optional)"
                        rows={3}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent resize-none"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setShowFollowUpForm(false)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleLogFollowUp}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-gf-lime rounded-lg hover:bg-gf-dark-green transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}

                {followUps.length === 0 && !showFollowUpForm ? (
                  <p className="text-sm text-slate-500 italic">No follow-ups logged.</p>
                ) : (
                  <div className="space-y-2">
                    {[...followUps]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((fu) => (
                        <div key={fu.id} className="flex items-start justify-between gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-900">{new Date(fu.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                            {fu.notes && <p className="text-xs text-slate-500 mt-0.5 whitespace-pre-wrap">{fu.notes}</p>}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteFollowUp(fu.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete follow-up"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Estimate Date</label>
            <input
              type="date"
              value={formData.estimateDate}
              onChange={(e) => setFormData({ ...formData, estimateDate: e.target.value })}
              className="w-full sm:w-48 px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-gf-lime text-white rounded-lg font-semibold hover:bg-gf-dark-green active:bg-gf-dark-green transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed text-sm sm:text-base"
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
      {showReminderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingReminderId ? 'Edit Reminder' : 'Add Reminder'}
              </h2>
              <button
                type="button"
                onClick={closeReminderModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Subject *</label>
                <input
                  type="text"
                  value={reminderForm.subject}
                  onChange={(e) => setReminderForm({ ...reminderForm, subject: e.target.value })}
                  placeholder="Reminder subject"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                />
              </div>
              {commTemplates.length > 0 && !editingReminderId && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Template (optional)</label>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const tpl = commTemplates.find(t => t.id === e.target.value);
                      if (tpl) {
                        const firstName = (formData.customerName || '').trim().split(' ')[0] || '[Name]';
                        const resolved = tpl.body.replace(/\[Name\]/gi, firstName);
                        setReminderForm(f => ({ ...f, details: resolved }));
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  >
                    <option value="">— Select a template —</option>
                    {commTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Message / Details</label>
                <textarea
                  value={reminderForm.details}
                  onChange={(e) => setReminderForm({ ...reminderForm, details: e.target.value })}
                  placeholder="Optional details"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                  <input
                    type="date"
                    value={reminderForm.dueDate}
                    onChange={(e) => setReminderForm({ ...reminderForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Time *</label>
                  <input
                    type="time"
                    value={reminderForm.dueTime}
                    onChange={(e) => setReminderForm({ ...reminderForm, dueTime: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeReminderModal}
                  disabled={savingReminder}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveReminder}
                  disabled={savingReminder}
                  className="px-4 py-2 text-sm font-medium text-white bg-gf-lime rounded-lg hover:bg-gf-dark-green transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                  {savingReminder ? 'Saving...' : editingReminderId ? 'Save Reminder' : 'Add Reminder'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNextReminderPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Create Next Reminder</h3>
              <button
                type="button"
                onClick={() => setShowNextReminderPrompt(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-slate-600">Reminder completed. Schedule a follow-up?</p>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
                <input
                  type="text"
                  value={nextReminderForm.subject}
                  onChange={(e) => setNextReminderForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="e.g. Follow up call"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={nextReminderForm.dueDate}
                    onChange={(e) => setNextReminderForm((f) => ({ ...f, dueDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Time</label>
                  <input
                    type="time"
                    value={nextReminderForm.dueTime}
                    onChange={(e) => setNextReminderForm((f) => ({ ...f, dueTime: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Details (optional)</label>
                <textarea
                  value={nextReminderForm.details}
                  onChange={(e) => setNextReminderForm((f) => ({ ...f, details: e.target.value }))}
                  rows={2}
                  placeholder="Additional notes..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent resize-none"
                />
              </div>
              <div className="pt-1 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCreateNextReminder}
                  className="px-3 py-2 text-sm font-medium text-white bg-gf-lime rounded-lg hover:bg-gf-dark-green transition-colors"
                >
                  Create Reminder
                </button>
                <button
                  type="button"
                  onClick={() => setShowNextReminderPrompt(false)}
                  className="px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  No Thanks
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Group creation modal */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                {modalView === 'existing-search' && (
                  <button
                    type="button"
                    onClick={() => { setModalView('options'); setExistingJobSearch(''); }}
                    className="p-1 text-slate-400 hover:text-slate-600 mr-1"
                  >
                    <ArrowLeft size={16} />
                  </button>
                )}
                {groupModalType === 'bundled' ? <Link size={18} className="text-blue-600" /> : <Shuffle size={18} className="text-purple-600" />}
                <h2 className="text-lg font-semibold text-slate-900">
                  {modalView === 'existing-search'
                    ? 'Select an Existing Estimate'
                    : groupModalType === 'bundled' ? 'Add Bundle Part' : 'Add Alternative Estimate'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => { setShowGroupModal(false); setModalView('options'); setExistingJobSearch(''); }}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5">
              {modalView === 'options' ? (
                <>
                  <p className="text-sm text-slate-600 mb-4">
                    {groupModalType === 'bundled'
                      ? 'Add another estimate to this bundle. Each part has a separate system, footage, and pricing. Aggregate totals are shown together.'
                      : 'Add an alternative estimate for the same customer. Each option has its own system, pricing, and specs for the customer to choose from.'}
                  </p>
                  <p className="text-sm font-semibold text-slate-700 mb-3">How should the new estimate start?</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      disabled={creatingGroupJob}
                      onClick={() => handleCreateGroupEstimate(true)}
                      className="flex flex-col items-center gap-1.5 p-4 border-2 border-slate-200 rounded-xl hover:border-gf-lime hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="text-2xl">📋</span>
                      <span className="font-semibold text-slate-800 text-sm">Copy This Job</span>
                      <span className="text-xs text-slate-500 text-center">Same settings, edit what's different</span>
                    </button>
                    <button
                      type="button"
                      disabled={creatingGroupJob}
                      onClick={() => handleCreateGroupEstimate(false)}
                      className="flex flex-col items-center gap-1.5 p-4 border-2 border-slate-200 rounded-xl hover:border-gf-lime hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="text-2xl">✨</span>
                      <span className="font-semibold text-slate-800 text-sm">Start Blank</span>
                      <span className="text-xs text-slate-500 text-center">Customer info carried over only</span>
                    </button>
                    <button
                      type="button"
                      disabled={creatingGroupJob || ungroupedJobs.length === 0}
                      onClick={() => setModalView('existing-search')}
                      className="flex flex-col items-center gap-1.5 p-4 border-2 border-slate-200 rounded-xl hover:border-gf-lime hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={ungroupedJobs.length === 0 ? 'No other ungrouped estimates available' : undefined}
                    >
                      <span className="text-2xl">🔍</span>
                      <span className="font-semibold text-slate-800 text-sm">Use Existing</span>
                      <span className="text-xs text-slate-500 text-center">
                        {ungroupedJobs.length === 0 ? 'No ungrouped estimates' : 'Add an estimate you already made'}
                      </span>
                    </button>
                  </div>
                  {creatingGroupJob && (
                    <p className="text-xs text-center text-slate-500 mt-3">Creating estimate...</p>
                  )}
                </>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Search by job name or customer..."
                    value={existingJobSearch}
                    onChange={(e) => setExistingJobSearch(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent mb-3"
                    autoFocus
                  />
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {ungroupedJobs
                      .filter(j => {
                        const q = existingJobSearch.trim().toLowerCase();
                        if (!q) return true;
                        return (j.name || '').toLowerCase().includes(q) || (j.customerName || '').toLowerCase().includes(q);
                      })
                      .slice(0, 8)
                      .map(j => (
                        <button
                          key={j.id}
                          type="button"
                          disabled={creatingGroupJob}
                          onClick={() => handleAddExistingJobToGroup(j)}
                          className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-slate-200 hover:border-gf-lime hover:bg-green-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{j.name || 'Untitled Job'}</p>
                            {j.customerName && <p className="text-xs text-slate-500 truncate">{j.customerName}</p>}
                          </div>
                          <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                            j.status === 'Won' ? 'bg-green-100 text-green-800' :
                            j.status === 'Lost' ? 'bg-red-100 text-red-800' :
                            j.status === 'Verbal' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {j.status}
                          </span>
                        </button>
                      ))}
                    {ungroupedJobs.filter(j => {
                      const q = existingJobSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (j.name || '').toLowerCase().includes(q) || (j.customerName || '').toLowerCase().includes(q);
                    }).length === 0 && (
                      <p className="text-sm text-slate-500 italic text-center py-4">No matching estimates found.</p>
                    )}
                  </div>
                  {creatingGroupJob && (
                    <p className="text-xs text-center text-slate-500 mt-3">Adding estimate...</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
















