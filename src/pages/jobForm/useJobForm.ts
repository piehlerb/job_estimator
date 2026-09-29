import { useState, useEffect, useRef, useMemo } from 'react';
import {
  getAllSystems,
  getJob,
  getAllJobs,
  getAllCustomers,
  addCustomer,
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
  getLead,
  updateLead,
  getAllCoatingInventory,
  saveCoatingInventory,
  getMiscInventory,
  saveMiscInventory,
  saveChipInventory,
  saveTintInventory,
} from '../../lib/db';
import { BaseColor, ChipSystem, Costs, Pricing, Job, JobCalculation, JobStatus, Laborer, InstallDaySchedule, ActualDaySchedule, ActualCosts, ChipInventory, CoatingRemovalType, Product, JobProduct, BaseCoatColor, JobReminder, JobFollowUp, TintInventory, CommunicationTemplate, JobEvaluation, InventoryActualsApplied, MiscInventory, Lead, JobMaterialAllocation } from '../../types';
import { coatingSkuId, findCoatingSku, DEFAULT_COATING_SKUS } from '../../lib/coatingSkus';
import { resolveJobMaterials, defaultBaseComponents, sharesValid } from '../../lib/materialAllocation';
import { calculateJobOutputs, calculateActualCosts } from '../../lib/calculations';
import { convertLegacyJobToSchedule } from '../../lib/jobMigration';
import { resolveAddressFields, type AddressFieldSet } from '../../lib/addressFields';
import { parseAddress } from '../../lib/addressParse';
import { useSaveFlash } from '../../hooks/useSaveFlash';
import { compareSnapshots, SnapshotChanges } from '../../lib/snapshotComparison';
import { SelectedChanges } from '../../components/SnapshotChangeBanner';
import { normalizeChipBlendName } from '../../lib/syncHelpers';
import { findChipInventoryItem } from '../../lib/chipInventory';
import {
  buildInventoryActualsUpdate,
  buildInventoryReviewRows,
  type InventoryReviewRow,
} from '../../lib/inventoryActuals';
import { stageForLinkedJobStatus } from '../../lib/leadPipeline';
import { ensureCustomerPersistence } from '../../lib/customerPersistence';
import { localToday, toLocalDateString, timestampToLocalDateString } from '../../lib/dateUtils';
import { buildAutoReminders } from '../../lib/autoReminders';

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function parseJobTags(input: string): string[] {
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

export function copySelectedFields<T extends object>(base: T, source: T, fields: Array<keyof T>): T {
  const merged = { ...base };
  for (const field of fields) {
    merged[field] = source[field];
  }
  return merged;
}

export interface JobFormProps {
  jobId?: string;
  leadId?: string;
  onBack: () => void;
  onEditJob?: (jobId: string) => void;
  onViewJobSheet?: (jobId: string) => void;
}

export interface CustomerOption {
  name: string;
  address?: string;
}

export type EditableInventoryReviewRow = InventoryReviewRow & { newValueEdited?: boolean };

export function createDefaultMiscInventory(): MiscInventory {
  return {
    id: 'current',
    crackRepair: 0,
    moistureMitigation: 0,
    silicaSand: 0,
    shot: 0,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * State and handlers for the job form. The view (pages/JobForm.tsx) and its
 * section components read everything they need from the returned object.
 */
export function useJobForm({ jobId, leadId, onBack, onEditJob, onViewJobSheet }: JobFormProps) {
  const [systems, setSystems] = useState<ChipSystem[]>([]);
  const [costs, setCosts] = useState<Costs>(getDefaultCosts());
  const [pricing, setPricing] = useState<Pricing>(getDefaultPricing());
  const [activeLaborers, setActiveLaborers] = useState<Laborer[]>([]);
  const [installSchedule, setInstallSchedule] = useState<InstallDaySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Shared by all four job-save buttons; the reminder modal keeps its own.
  const jobFlash = useSaveFlash();
  const reminderFlash = useSaveFlash();
  const [calculation, setCalculation] = useState<JobCalculation | null>(null);
  const [usedPricing, setUsedPricing] = useState<Pricing>(getDefaultPricing());
  const [usedCosts, setUsedCosts] = useState<Costs>(getDefaultCosts());
  const [usedSystem, setUsedSystem] = useState<ChipSystem | null>(null);
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
  // The structured projection of customerAddress. Held separately from formData
  // because it is derived on blur rather than per keystroke, and because a hand
  // correction here has to survive until save.
  const [addressFields, setAddressFields] = useState<AddressFieldSet>({});
  // The raw text the current structured fields were derived from, so an edit to the
  // address can be told from merely tabbing through the field.
  const [addressSourceRaw, setAddressSourceRaw] = useState<string | undefined>(undefined);
  // Flips the copy button to a checkmark for a couple seconds after a copy.
  const [addressCopied, setAddressCopied] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [linkedLead, setLinkedLead] = useState<Lead | null>(null);

  // Products state
  const [jobProducts, setJobProducts] = useState<JobProduct[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [showProductsSection, setShowProductsSection] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');

  // Material allocation state (per-job override of default coating allocation)
  const [showAllocationSection, setShowAllocationSection] = useState(false);
  const [allocationOverrideEnabled, setAllocationOverrideEnabled] = useState(false);
  const [topAllocation, setTopAllocation] = useState<Array<{ variant: string; sharePct: number }>>([]);
  const [baseAllocation, setBaseAllocation] = useState<Array<{ variant: string; color: string; sharePct: number; tintColor: string }>>([]);
  const [allocationError, setAllocationError] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'reminders' | 'actuals'>('details');
  const [currentStep, setCurrentStep] = useState(0);
  const STEP_LABELS = ['Customer', 'Measure', 'System', 'Price'] as const;

  // Actuals state (for Won jobs)
  const [actualInstallSchedule, setActualInstallSchedule] = useState<ActualDaySchedule[]>([]);
  const [actualMaterials, setActualMaterials] = useState({
    actualBaseCoatGallons: '',
    actualTopCoatGallons: '',
    actualCyclo1Gallons: '',
    actualTintOz: '',
    actualChipBoxes: '',
    actualCrackRepairOz: '',
    actualMoistureMitigationGallons: '',
    actualSlabTemp: '',
    actualExpenseAdjustment: '',
    actualExpenseAdjustmentNotes: '',
  });
  const [actualCalculation, setActualCalculation] = useState<ActualCosts | null>(null);
  const actualsInitialized = useRef(false);
  const [showInventoryUpdateModal, setShowInventoryUpdateModal] = useState(false);
  const [inventoryReviewRows, setInventoryReviewRows] = useState<EditableInventoryReviewRow[]>([]);
  const [pendingInventoryJob, setPendingInventoryJob] = useState<Job | null>(null);
  const [pendingInventoryBaseline, setPendingInventoryBaseline] = useState<InventoryActualsApplied | null>(null);
  const [inventoryUpdateError, setInventoryUpdateError] = useState('');
  const [applyingInventoryUpdate, setApplyingInventoryUpdate] = useState(false);

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
    date: localToday(),
    notes: '',
  });

  // Evaluation state
  const [evaluation, setEvaluation] = useState<JobEvaluation>({ moisture: [], ph: [], hardness: [], cacl: [] });
  const [evalInputs, setEvalInputs] = useState({ moisture: '', ph: '', hardness: '', cacl: '' });

  // Snapshot comparison state
  const [snapshotChanges, setSnapshotChanges] = useState<SnapshotChanges | null>(null);
  const [showSnapshotBanner, setShowSnapshotBanner] = useState(false);

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
    leadId: '',
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
    estimateDate: localToday(),
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
  }, [formData, systems, costs, pricing, activeLaborers, installSchedule, existingJob, jobProducts]);

  // Reactively compute actual costs when actuals change
  useEffect(() => {
    if (!existingJob || actualInstallSchedule.length === 0) {
      setActualCalculation(null);
      return;
    }
    const costsToUse = { ...getDefaultCosts(), ...existingJob.costsSnapshot };
    const pricingToUse = existingJob.pricingSnapshot
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
        products: jobProducts,
        actualBaseCoatGallons: parseFloat(actualMaterials.actualBaseCoatGallons) || 0,
        actualTopCoatGallons: parseFloat(actualMaterials.actualTopCoatGallons) || 0,
        actualCyclo1Gallons: parseFloat(actualMaterials.actualCyclo1Gallons) || 0,
        actualTintOz: parseFloat(actualMaterials.actualTintOz) || 0,
        actualChipBoxes: parseFloat(actualMaterials.actualChipBoxes) || 0,
        actualCrackRepairOz: parseFloat(actualMaterials.actualCrackRepairOz) || 0,
        actualMoistureMitigationGallons: parseFloat(actualMaterials.actualMoistureMitigationGallons) || 0,
        chipBoxCost,
        totalPrice: parseFloat(formData.totalPrice) || 0,
        installDays: parseFloat(formData.installDays) || 1,
        installDate: formData.installDate,
        travelDistance: parseFloat(formData.travelDistance) || 0,
        disableGasHeater: formData.disableGasHeater,
        actualExpenseAdjustment: parseFloat(actualMaterials.actualExpenseAdjustment) || 0,
      },
      costsToUse,
      pricingToUse,
      laborersToUse
    );
    setActualCalculation(calc);
  }, [actualInstallSchedule, actualMaterials, formData.totalPrice, formData.installDays, formData.installDate, formData.travelDistance, formData.disableGasHeater, existingJob, activeLaborers, costs, pricing, jobProducts]);


  const productsTotalPrice = useMemo(
    () => jobProducts.reduce((sum, p) => sum + p.quantity * p.unitPrice, 0),
    [jobProducts]
  );
  const productsTotalCost = useMemo(
    () => jobProducts.reduce((sum, p) => sum + p.quantity * p.unitCost, 0),
    [jobProducts]
  );

  // ── Material allocation helpers ──────────────────────────────────────────
  const buildAllocationOverride = (): JobMaterialAllocation | undefined => {
    if (!allocationOverrideEnabled) return undefined;
    const top = topAllocation
      .filter((t) => t.variant.trim())
      .map((t) => ({ variant: t.variant.trim(), share: t.sharePct / 100 }));
    const base = baseAllocation
      .filter((b) => b.variant.trim() && b.color)
      .map((b) => ({
        variant: b.variant.trim(),
        color: b.color,
        share: b.sharePct / 100,
        tintColor: b.color === 'Clear' && b.tintColor ? b.tintColor : undefined,
      }));
    const override: JobMaterialAllocation = {};
    if (top.length > 0) override.top = top;
    if (base.length > 0) override.base = base;
    return override.top || override.base ? override : undefined;
  };

  const validateAllocationOverride = (): string => {
    if (!allocationOverrideEnabled) return '';
    if (topAllocation.length > 0) {
      if (topAllocation.some((t) => !t.variant.trim())) {
        return 'Each topcoat flavor needs a variant name.';
      }
      if (!sharesValid(topAllocation.map((t) => ({ share: t.sharePct / 100 })))) {
        return 'Topcoat flavor shares must sum to 100%.';
      }
    }
    if (baseAllocation.length > 0) {
      if (baseAllocation.some((b) => !b.variant.trim() || !b.color)) {
        return 'Each Base B component needs a variant and color.';
      }
      if (!sharesValid(baseAllocation.map((b) => ({ share: b.sharePct / 100 })))) {
        return 'Base B component shares must sum to 100%.';
      }
    }
    return '';
  };

  const defaultBaseAllocationRows = () => {
    const defaults = defaultBaseComponents(formData.baseColor || undefined);
    if (!defaults) return [{ variant: 'Normal', color: '', sharePct: 100, tintColor: '' }];
    return defaults.map((d) => ({
      variant: d.variant,
      color: d.color,
      sharePct: Math.round(d.share * 1000) / 10,
      tintColor: d.tintColor || '',
    }));
  };

  const enableAllocationOverride = () => {
    setAllocationOverrideEnabled(true);
    if (topAllocation.length === 0) {
      setTopAllocation([{ variant: 'Original', sharePct: 100 }]);
    }
    if (baseAllocation.length === 0) {
      setBaseAllocation(defaultBaseAllocationRows());
    }
  };

  const resetAllocationToDefaults = () => {
    setTopAllocation([{ variant: 'Original', sharePct: 100 }]);
    setBaseAllocation(defaultBaseAllocationRows());
    setAllocationError('');
  };

  const applyMochaPreset = (rows: Array<{ variant: string; color: string; sharePct: number; tintColor: string }>) => {
    if (!allocationOverrideEnabled) {
      setAllocationOverrideEnabled(true);
      if (topAllocation.length === 0) {
        setTopAllocation([{ variant: 'Original', sharePct: 100 }]);
      }
    }
    setBaseAllocation(rows);
    setAllocationError('');
  };

  const allocationTintColorOptions = (current: string): string[] => {
    const options = tintInventory.map((t) => t.color);
    if (current && !options.some((c) => c.toLowerCase() === current.toLowerCase())) {
      options.push(current);
    }
    return options;
  };

  // Known variant choices for the allocation dropdowns; keeps any custom value
  // already stored on the row selectable so old data never disappears
  const allocationVariantOptions = (known: string[], current: string): string[] =>
    current && !known.includes(current) ? [...known, current] : known;

  const resolvedMaterials = useMemo(() => {
    if (!calculation) return null;
    if (!(calculation.baseGallons > 0) && !(calculation.topGallons > 0)) return null;
    return resolveJobMaterials({
      baseGallons: calculation.baseGallons,
      topGallons: calculation.topGallons,
      baseColor: formData.baseColor || undefined,
      tintColor: formData.tintColor || undefined,
      includeBasecoatTint: formData.includeBasecoatTint,
      includeTopcoatTint: formData.includeTopcoatTint,
      override: buildAllocationOverride(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    calculation,
    formData.baseColor,
    formData.tintColor,
    formData.includeBasecoatTint,
    formData.includeTopcoatTint,
    allocationOverrideEnabled,
    topAllocation,
    baseAllocation,
  ]);

  const topAllocationTotalPct = topAllocation.reduce((sum, t) => sum + (t.sharePct || 0), 0);
  const baseAllocationTotalPct = baseAllocation.reduce((sum, b) => sum + (b.sharePct || 0), 0);

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
    setLinkedLead(null);
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

        if (leadId) {
          const lead = await getLead(leadId);
          if (lead) {
            setLinkedLead(lead);
            setFormData((prev) => ({
              ...prev,
              leadId: lead.id,
              name: prev.name || `${lead.name || 'Lead'} Estimate`,
              customerName: lead.name || prev.customerName,
              customerAddress: lead.address || prev.customerAddress,
            }));
          }
        }
      }

      if (jobId) {
        console.log('[JobForm] Loading existing job:', jobId);
        const job = await getJob(jobId);
        console.log('[JobForm] Job loaded:', !!job);
        if (job) {
          setExistingJob(job);
          setAddressFields({
            street: job.customerStreet,
            street2: job.customerStreet2,
            city: job.customerCity,
            state: job.customerState,
            zip: job.customerZip,
            tier: job.addressParseTier,
            verifiedAt: job.addressVerifiedAt,
          });
          setAddressSourceRaw(job.customerAddress);
          if (job.leadId) {
            const lead = await getLead(job.leadId);
            setLinkedLead(lead);
          }
          setFormData({
            name: job.name,
            leadId: job.leadId || '',
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
            estimateDate: job.estimateDate || timestampToLocalDateString(job.createdAt),
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
            setActualInstallSchedule(schedule.map(d => ({ ...d, laborerIds: [...d.laborerIds] })));
          } else if (job.installDays >= 1) {
            // No estimated schedule to copy — seed empty days matching the plan
            setActualInstallSchedule(
              Array.from({ length: Math.round(job.installDays) }, (_, i) => ({
                day: i + 1,
                hours: job.installDays > 0 ? job.jobHours / job.installDays : 0,
                laborerIds: [],
              }))
            );
          }
          if (
            job.actualBaseCoatGallons != null ||
            job.actualTopCoatGallons != null ||
            job.actualMoistureMitigationGallons != null ||
            job.actualSlabTemp != null
          ) {
            actualsInitialized.current = true;
          }
          setActualMaterials({
            actualBaseCoatGallons: job.actualBaseCoatGallons?.toString() || '',
            actualTopCoatGallons: job.actualTopCoatGallons?.toString() || '',
            actualCyclo1Gallons: job.actualCyclo1Gallons?.toString() || '',
            actualTintOz: job.actualTintOz?.toString() || '',
            actualChipBoxes: job.actualChipBoxes?.toString() || '',
            actualCrackRepairOz: job.actualCrackRepairOz?.toString() || '',
            actualMoistureMitigationGallons: job.actualMoistureMitigationGallons?.toString() || '',
            actualSlabTemp: job.actualSlabTemp?.toString() || '',
            actualExpenseAdjustment: job.actualExpenseAdjustment?.toString() || '',
            actualExpenseAdjustmentNotes: job.actualExpenseAdjustmentNotes || '',
          });
          // Load products from existing job
          if (job.products && job.products.length > 0) {
            setJobProducts(job.products);
            setShowProductsSection(true);
          }
          // Load material allocation override from existing job
          if (job.materialAllocation && (job.materialAllocation.top?.length || job.materialAllocation.base?.length)) {
            setAllocationOverrideEnabled(true);
            setShowAllocationSection(true);
            setTopAllocation(
              (job.materialAllocation.top || []).map((t) => ({
                variant: t.variant,
                sharePct: Math.round(t.share * 1000) / 10,
              }))
            );
            setBaseAllocation(
              (job.materialAllocation.base || []).map((b) => ({
                variant: b.variant,
                color: b.color,
                sharePct: Math.round(b.share * 1000) / 10,
                tintColor: b.tintColor || '',
              }))
            );
          }
          if (job.reminders && job.reminders.length > 0) {
            setReminders(job.reminders);
          }
          if (job.followUps && job.followUps.length > 0) {
            setFollowUps(job.followUps);
          }
          if (job.evaluation) {
            setEvaluation(job.evaluation);
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

    // Use snapshot costs if editing existing job, otherwise use current costs
    // existingJob.costsSnapshot already reflects any selective updates the user accepted
    const costsToUse = existingJob
      ? {
          ...getDefaultCosts(),
          ...existingJob.costsSnapshot,
          antiSlipCostPerGal: existingJob.costsSnapshot.antiSlipCostPerGal ?? costs.antiSlipCostPerGal,
          abrasionResistanceCostPerGal: existingJob.costsSnapshot.abrasionResistanceCostPerGal ?? costs.abrasionResistanceCostPerGal,
          moistureMitigationCostPerGal: existingJob.costsSnapshot.moistureMitigationCostPerGal ?? costs.moistureMitigationCostPerGal,
          moistureMitigationSpreadRate: existingJob.costsSnapshot.moistureMitigationSpreadRate ?? costs.moistureMitigationSpreadRate,
        }
      : costs;
    const pricingToUse = existingJob && existingJob.pricingSnapshot
      ? { ...getDefaultPricing(), ...existingJob.pricingSnapshot }
      : pricing;
    setUsedPricing(pricingToUse);

    // For system snapshot, merge current defaults for fields added after the snapshot was taken.
    // If the user changed the system from the original, use the newly selected system directly.
    const systemChanged = existingJob && formData.system !== existingJob.systemId;
    const systemToUse = existingJob && !systemChanged
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
      products: jobProducts,
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
    setUsedCosts(costsToUse);
    setUsedSystem(systemToUse);
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
    if (newStatus === 'Lost') {
      setReminders(prev => prev.filter(r => r.completed));
    }
  };

  const handleSystemChange = (systemId: string) => {
    // Reset actual pricing so it re-initializes from new suggested values
    actualPricingInitialized.current = false;
    setFormData((prev) => ({ ...prev, system: systemId }));
    setShowBlendDropdown(true);
  };

  const handleFloorFootageChange = (newFootage: string) => {
    if (!actualPricingInitialized.current) {
      setFormData(prev => ({ ...prev, floorFootage: newFootage }));
      return;
    }
    const footage = parseFloat(newFootage) || 0;
    setFormData(prev => {
      const perSqft = parseFloat(prev.actualFloorPricePerSqft) || 0;
      const newFloorPrice = perSqft * footage;
      const total = (parseFloat(prev.actualDiscount) || 0)
        + (parseFloat(prev.actualCrackPrice) || 0)
        + newFloorPrice
        + (parseFloat(prev.actualVerticalPrice) || 0)
        + (parseFloat(prev.actualAntiSlipPrice) || 0)
        + (parseFloat(prev.actualAbrasionResistancePrice) || 0)
        + (parseFloat(prev.actualCoatingRemovalPrice) || 0)
        + (parseFloat(prev.actualMoistureMitigationPrice) || 0)
        + productsTotalPrice;
      return {
        ...prev,
        floorFootage: newFootage,
        actualFloorPrice: newFloorPrice.toFixed(2),
        totalPrice: total.toFixed(2),
      };
    });
  };

  const handleVerticalFootageChange = (newFootage: string) => {
    if (!actualPricingInitialized.current) {
      setFormData(prev => ({ ...prev, verticalFootage: newFootage }));
      return;
    }
    const footage = parseFloat(newFootage) || 0;
    setFormData(prev => {
      const perSqft = parseFloat(prev.actualVerticalPricePerSqft) || 0;
      const newVerticalPrice = perSqft > 0 ? perSqft * footage : 0;
      const total = (parseFloat(prev.actualDiscount) || 0)
        + (parseFloat(prev.actualCrackPrice) || 0)
        + (parseFloat(prev.actualFloorPrice) || 0)
        + newVerticalPrice
        + (parseFloat(prev.actualAntiSlipPrice) || 0)
        + (parseFloat(prev.actualAbrasionResistancePrice) || 0)
        + (parseFloat(prev.actualCoatingRemovalPrice) || 0)
        + (parseFloat(prev.actualMoistureMitigationPrice) || 0)
        + productsTotalPrice;
      return {
        ...prev,
        verticalFootage: newFootage,
        actualVerticalPrice: newVerticalPrice.toFixed(2),
        totalPrice: total.toFixed(2),
      };
    });
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
    handleAddressBlur(customer.address || '');
  };

  /**
   * Derive the structured address from the free text.
   *
   * Passing `rawChanged` lets the helper distinguish an edited address — rebuild
   * the projection, drop any stale confirmation — from merely tabbing through the
   * field, where a hand correction must survive.
   */
  const handleAddressBlur = (raw: string) => {
    const trimmed = raw.trim() || undefined;
    setAddressFields((previous) =>
      resolveAddressFields(trimmed, previous, trimmed !== addressSourceRaw)
    );
    setAddressSourceRaw(trimmed);
  };

  /**
   * Copy the job site address so it can be pasted straight into a maps app.
   * navigator.clipboard is unavailable on insecure origins and older mobile
   * browsers, so fall back to the hidden-textarea trick the invite codes use.
   */
  const handleCopyAddress = async () => {
    const address = formData.customerAddress.trim();
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      const el = document.createElement('textarea');
      el.value = address;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 2000);
  };

  const matchedCustomer = useMemo(
    () =>
      availableCustomers.find(
        (customer) => customer.name.toLowerCase() === formData.customerName.trim().toLowerCase()
      ),
    [availableCustomers, formData.customerName]
  );
  const matchedCustomerAddress = matchedCustomer?.address?.trim() || undefined;

  // Derived rather than stored: a boolean flag would drift out of agreement with
  // the two addresses it claims to describe.
  const addressMatchesCustomer =
    !!matchedCustomerAddress &&
    matchedCustomerAddress.toLowerCase() === formData.customerAddress.trim().toLowerCase();

  const handleSameAsCustomer = (checked: boolean) => {
    // Unchecking clears the job site address rather than inventing one: a job at a
    // different property needs a real address typed, not a guess.
    const next = checked ? matchedCustomerAddress ?? '' : '';
    setFormData({ ...formData, customerAddress: next });
    handleAddressBlur(next);
  };

  const addressNote = useMemo(
    () => (formData.customerAddress.trim() ? parseAddress(formData.customerAddress).note : undefined),
    [formData.customerAddress]
  );

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
    const defaultDays = pricing.defaultReminderDays ?? 7;
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + defaultDays);
    setReminderForm({
      subject: '',
      details: '',
      dueDate: toLocalDateString(defaultDate),
      dueTime: pricing.defaultReminderTime ?? '05:00',
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
      reminderFlash.flashSaved(closeReminderModal);
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
      const nextDefaultDays = pricing.defaultReminderDays ?? 7;
      const nextDefaultDate = new Date();
      nextDefaultDate.setDate(nextDefaultDate.getDate() + nextDefaultDays);
      setNextReminderForm({
        subject: '',
        dueDate: toLocalDateString(nextDefaultDate),
        dueTime: pricing.defaultReminderTime ?? '05:00',
        details: '',
      });
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
    setFollowUpForm({ date: localToday(), notes: '' });
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
        products: job.products,
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

  const handleUpdateToCurrentValues = async (selected: SelectedChanges) => {
    setShowSnapshotBanner(false);

    if (existingJob) {
      const selectedSystem = systems.find((s) => s.id === formData.system);

      // Selectively merge: only update fields the user accepted
      const mergedCosts = copySelectedFields(existingJob.costsSnapshot, costs, selected.costFields);

      const systemBase = existingJob.systemSnapshot || selectedSystem;
      const mergedSystem = systemBase && selectedSystem
        ? copySelectedFields(systemBase, selectedSystem, selected.systemFields)
        : systemBase;

      const updatedJob: Job = {
        ...existingJob,
        costsSnapshot: mergedCosts,
        systemSnapshot: mergedSystem,
        updatedAt: new Date().toISOString(),
        synced: false,
      };
      await updateJob(updatedJob);
      setExistingJob(updatedJob);
    }
  };

  const handleKeepOriginalValues = () => {
    setShowSnapshotBanner(false);
  };

  const jobSourceFrom = (job: Job) => ({
    actualBaseCoatGallons: job.actualBaseCoatGallons,
    actualTopCoatGallons: job.actualTopCoatGallons,
    actualCyclo1Gallons: job.actualCyclo1Gallons,
    actualTintOz: job.actualTintOz,
    actualChipBoxes: job.actualChipBoxes,
    actualCrackRepairOz: job.actualCrackRepairOz,
    actualMoistureMitigationGallons: job.actualMoistureMitigationGallons,
    chipBlend: job.chipBlend,
    systemId: job.systemId,
    baseColor: job.baseColor,
    tintColor: job.tintColor,
    includeBasecoatTint: job.includeBasecoatTint,
    includeTopcoatTint: job.includeTopcoatTint,
    materialAllocation: job.materialAllocation,
    inventoryActualsApplied: job.inventoryActualsApplied,
  });

  const prepareInventoryReview = async (deltas: Parameters<typeof buildInventoryReviewRows>[0]['deltas']) => {
    const [chipInventoryRows, tintInventoryRows, coatingInventoryRows, miscInventory] = await Promise.all([
      getAllChipInventory(),
      getAllTintInventory(),
      getAllCoatingInventory(),
      getMiscInventory(),
    ]);

    return buildInventoryReviewRows({
      deltas,
      chipInventory: chipInventoryRows,
      tintInventory: tintInventoryRows,
      coatingInventory: coatingInventoryRows,
      miscInventory,
    });
  };

  const updateInventoryReviewNewValue = (rowKey: string, value: string) => {
    const parsed = Number.parseFloat(value);
    setInventoryReviewRows((prev) =>
      prev.map((row) =>
        row.key === rowKey
          ? {
              ...row,
              newValue: Number.isFinite(parsed) ? parsed : 0,
              newValueEdited: true,
            }
          : row
      )
    );
  };

  const handleCancelInventoryUpdate = () => {
    setShowInventoryUpdateModal(false);
    setInventoryReviewRows([]);
    setPendingInventoryJob(null);
    setPendingInventoryBaseline(null);
    setInventoryUpdateError('');
    setApplyingInventoryUpdate(false);
    onBack();
  };

  const handleApplyInventoryUpdate = async () => {
    if (!pendingInventoryJob || !pendingInventoryBaseline) {
      handleCancelInventoryUpdate();
      return;
    }

    setApplyingInventoryUpdate(true);
    setInventoryUpdateError('');

    try {
      const [chipInventoryRows, tintInventoryRows, coatingInventoryRows, miscInventoryRecord] = await Promise.all([
        getAllChipInventory(),
        getAllTintInventory(),
        getAllCoatingInventory(),
        getMiscInventory(),
      ]);

      const now = new Date().toISOString();
      let miscInventory = { ...createDefaultMiscInventory(), ...miscInventoryRecord };
      let hasMiscChanges = false;
      const getFreshCurrentValue = (row: EditableInventoryReviewRow) => {
        if (row.target.kind === 'chip') {
          const existing = findChipInventoryItem(chipInventoryRows, row.target.blend, row.target.systemId);
          return existing?.pounds ?? 0;
        }

        if (row.target.kind === 'tint') {
          const target = row.target;
          const existing = tintInventoryRows.find((inventory) => inventory.color === target.color);
          return existing?.ounces ?? 0;
        }

        if (row.target.kind === 'coating') {
          const target = row.target;
          const existing = findCoatingSku(coatingInventoryRows, target.part, target.variant, target.color);
          return existing?.gallons ?? 0;
        }

        return miscInventory[row.target.field] ?? 0;
      };

      const rowsToApply: EditableInventoryReviewRow[] = inventoryReviewRows.map((row) => {
        const freshCurrentValue = getFreshCurrentValue(row);
        const computedValue = row.newValueEdited ? row.newValue : freshCurrentValue - row.usedDelta;
        return {
          ...row,
          newValue: computedValue,
          newValueEdited: true,
        };
      });

      setInventoryReviewRows(rowsToApply);

      for (const row of rowsToApply) {
        if (row.target.kind === 'chip') {
          const target = row.target;
          const existing = findChipInventoryItem(chipInventoryRows, target.blend, target.systemId);

          await saveChipInventory({
            id: existing?.id || generateId(),
            blend: existing?.blend || target.blend,
            // Deducting from unassigned legacy stock claims it for this system.
            systemId: existing?.systemId || target.systemId,
            pounds: row.newValue,
            updatedAt: now,
            deleted: false,
          });
          continue;
        }

        if (row.target.kind === 'tint') {
          const target = row.target;
          const existing = tintInventoryRows.find((inventory) => inventory.color === target.color);

          await saveTintInventory({
            id: existing?.id || generateId(),
            color: existing?.color || target.color,
            ounces: row.newValue,
            updatedAt: now,
            deleted: false,
          });
          continue;
        }

        if (row.target.kind === 'coating') {
          const target = row.target;
          const existing = findCoatingSku(coatingInventoryRows, target.part, target.variant, target.color);

          if (existing) {
            await saveCoatingInventory({
              ...existing,
              gallons: row.newValue,
              updatedAt: now,
            });
          } else {
            const defaultSku = DEFAULT_COATING_SKUS.find(
              (sku) =>
                sku.part === target.part &&
                (sku.variant || '') === (target.variant || '') &&
                (sku.color || '') === (target.color || '')
            );
            await saveCoatingInventory({
              id: coatingSkuId(target),
              part: target.part,
              variant: target.variant,
              color: target.color,
              gallons: row.newValue,
              sortOrder: defaultSku?.sortOrder,
              updatedAt: now,
            });
          }
          continue;
        }

        miscInventory = {
          ...miscInventory,
          [row.target.field]: row.newValue,
          updatedAt: now,
        };
        hasMiscChanges = true;
      }

      if (hasMiscChanges) {
        await saveMiscInventory(miscInventory);
      }

      await updateJob({
        ...pendingInventoryJob,
        inventoryActualsApplied: pendingInventoryBaseline,
        updatedAt: now,
        synced: false,
      });

      setShowInventoryUpdateModal(false);
      setInventoryReviewRows([]);
      setPendingInventoryJob(null);
      setPendingInventoryBaseline(null);
      setInventoryUpdateError('');
      setApplyingInventoryUpdate(false);
      onBack();
    } catch (error) {
      console.error('Error applying inventory update:', error);
      setInventoryUpdateError('Inventory update failed before it could be completed. Review inventory levels before trying again.');
      setApplyingInventoryUpdate(false);
    }
  };

  const syncLinkedLeadFromJob = async (job: Job) => {
    if (!job.leadId) return;

    const lead = await getLead(job.leadId);
    if (!lead) return;

    const now = new Date().toISOString();
    const nextStage = stageForLinkedJobStatus(job.status);
    await updateLead({
      ...lead,
      stage: nextStage,
      closedAt: nextStage === 'Won' || nextStage === 'Lost' ? lead.closedAt || now : lead.closedAt,
      updatedAt: now,
    });
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

      // Validate material allocation override before saving
      const allocationValidationError = validateAllocationOverride();
      if (allocationValidationError) {
        setAllocationError(allocationValidationError);
        setShowAllocationSection(true);
        alert(`Material Allocation: ${allocationValidationError}`);
        setSaving(false);
        return;
      }
      setAllocationError('');

      // Calculate total hours from schedule
      const totalHours = installSchedule.reduce((sum, day) => sum + day.hours, 0);

      // Normalize chip blend name before saving (trim whitespace, title case)
      const normalizedChipBlend = normalizeChipBlendName(formData.chipBlend);
      const normalizedTags = parseJobTags(formData.tags);
      const customerName = formData.customerName.trim();
      const customerAddress = formData.customerAddress.trim();
      const savedAt = new Date().toISOString();

      // If chip blend is entered and not in the list, add it
      if (normalizedChipBlend && !chipBlends.some((b) => normalizeChipBlendName(b.name) === normalizedChipBlend)) {
        const newBlend: ChipBlend = {
          id: generateId(),
          name: normalizedChipBlend,
        };
        await addChipBlend(newBlend);
        setChipBlends([...chipBlends, newBlend]);
      }

      await ensureCustomerPersistence(
        { name: customerName, address: customerAddress },
        {
          getAllCustomers,
          addCustomer,
          generateId,
          now: () => savedAt,
        }
      );

      // New jobs pick up the auto-add reminders configured in Settings, timed
      // off the estimate date. Existing jobs are left alone so rule changes
      // never backfill reminders onto older jobs.
      const autoReminders = jobId
        ? []
        : buildAutoReminders({
            rules: pricing.autoReminderRules,
            templates: commTemplates,
            estimateDate: formData.estimateDate,
            customerName,
            defaultTime: pricing.defaultReminderTime,
            existingReminders: reminders,
            generateId,
          });
      const allReminders = [...reminders, ...autoReminders];

      const job: Job = {
        id: jobId || generateId(),
        name: formData.name,
        leadId: formData.leadId || undefined,
        customerName: customerName || undefined,
        customerAddress: customerAddress || undefined,
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
        materialAllocation: buildAllocationOverride(),
        status: formData.status,
        estimateDate: formData.estimateDate || undefined,
        decisionDate: formData.decisionDate || undefined,
        probability: parseInt(formData.probability) || 0,
        notes: formData.notes || undefined,
        evaluation: (evaluation.moisture.length || evaluation.ph.length || evaluation.hardness.length || evaluation.cacl.length) ? evaluation : undefined,
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
        actualMoistureMitigationGallons: parseFloat(actualMaterials.actualMoistureMitigationGallons) || undefined,
        actualSlabTemp: parseFloat(actualMaterials.actualSlabTemp) || undefined,
        inventoryActualsApplied: existingJob?.inventoryActualsApplied,
        actualExpenseAdjustment: parseFloat(actualMaterials.actualExpenseAdjustment) || undefined,
        actualExpenseAdjustmentNotes: actualMaterials.actualExpenseAdjustmentNotes.trim() || undefined,
        products: jobProducts.length > 0 ? jobProducts : undefined,
        reminders: allReminders.length > 0
          ? [...allReminders].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
          : undefined,
        followUps: followUps.length > 0
          ? [...followUps].sort((a, b) => a.date.localeCompare(b.date))
          : undefined,
        costsSnapshot: usedCosts,
        pricingSnapshot: usedPricing,
        systemSnapshot: usedSystem || selectedSystem,
        laborersSnapshot: laborersToSave,
        // Preserve group fields
        groupId: existingJob?.groupId,
        groupType: existingJob?.groupType,
        isPrimaryEstimate: existingJob?.isPrimaryEstimate,
        createdAt: existingJob?.createdAt || savedAt,
        updatedAt: savedAt,
        synced: false,
      };

      // The form already holds the structured projection, derived on blur and
      // possibly corrected by hand. Resolve once more against the final raw text so
      // a save without blurring still lands, then write whatever that produces —
      // a hand-corrected set carries tier 'M' and passes through untouched.
      const finalAddress = resolveAddressFields(
        customerAddress || undefined,
        addressFields,
        (customerAddress || undefined) !== addressSourceRaw
      );
      const jobWithAddress: Job = {
        ...job,
        customerStreet: finalAddress.street,
        customerStreet2: finalAddress.street2,
        customerCity: finalAddress.city,
        customerState: finalAddress.state,
        customerZip: finalAddress.zip,
        addressParseTier: finalAddress.tier,
        addressVerifiedAt: finalAddress.verifiedAt,
      };

      if (jobId) {
        await updateJob(jobWithAddress);
      } else {
        await addJob(jobWithAddress);
      }
      if (autoReminders.length > 0) {
        setReminders(allReminders);
        await requestReminderNotificationPermission();
      }
      await syncLinkedLeadFromJob(job);

      const { snapshot, deltas } = buildInventoryActualsUpdate(jobSourceFrom(job), new Date().toISOString());

      if (deltas.length > 0) {
        const shouldUpdateInventory = window.confirm('Actual material values changed. Update inventory from these actuals now?');
        if (shouldUpdateInventory) {
          try {
            const reviewRows = await prepareInventoryReview(deltas);
            if (reviewRows.length > 0) {
              setPendingInventoryJob(job);
              setPendingInventoryBaseline(snapshot);
              setInventoryReviewRows(reviewRows);
              setInventoryUpdateError('');
              setShowInventoryUpdateModal(true);
              setSaving(false);
              // The job is already written; the modal only reconciles inventory,
              // so confirm the save in place rather than on the way out.
              jobFlash.flashSaved();
              return;
            }
          } catch (inventoryError) {
            console.error('Error preparing inventory review:', inventoryError);
            alert('Job saved, but inventory could not be loaded. Inventory was not changed.');
            onBack();
            return;
          }
        }
      }

      jobFlash.flashSaved(onBack);
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

  const formatInventoryValue = (value: number, unit: InventoryReviewRow['unit']) => {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: unit === 'lbs' ? 0 : 2,
      maximumFractionDigits: unit === 'lbs' ? 0 : 2,
    });
  };

  // Calculate inventory status for chip blend
  const getInventoryStatus = () => {
    if (!formData.chipBlend || !calculation) {
      return null;
    }

    // Inventory is tracked per blend + chip system
    const inventoryItem = findChipInventoryItem(chipInventory, formData.chipBlend, formData.system);

    if (!inventoryItem || inventoryItem.pounds <= 0) {
      return {
        hasInventory: false,
        message: "We don't have this chip blend in inventory for this system",
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


  // Derived values shown in the summary and price sections
  const selectedLaborers = getSelectedLaborers();

  const marginPct = calculation && parseFloat(formData.totalPrice) > 0
    ? ((parseFloat(formData.totalPrice) - calculation.totalCosts) / parseFloat(formData.totalPrice)) * 100
    : 0;
  const perSqft = calculation && parseFloat(formData.floorFootage) > 0
    ? parseFloat(formData.totalPrice) / parseFloat(formData.floorFootage)
    : 0;

  return {
    selectedLaborers,
    marginPct,
    perSqft,
    systems,
    setSystems,
    costs,
    setCosts,
    pricing,
    setPricing,
    activeLaborers,
    setActiveLaborers,
    installSchedule,
    setInstallSchedule,
    loading,
    setLoading,
    saving,
    setSaving,
    jobFlash,
    reminderFlash,
    calculation,
    setCalculation,
    usedPricing,
    setUsedPricing,
    usedCosts,
    setUsedCosts,
    usedSystem,
    setUsedSystem,
    existingJob,
    setExistingJob,
    chipBlends,
    setChipBlends,
    chipBlendInput,
    setChipBlendInput,
    showBlendDropdown,
    setShowBlendDropdown,
    chipInventory,
    setChipInventory,
    baseCoatColors,
    setBaseCoatColors,
    tintInventory,
    setTintInventory,
    showTintColorDropdown,
    setShowTintColorDropdown,
    availableTags,
    setAvailableTags,
    showTagDropdown,
    setShowTagDropdown,
    availableCustomers,
    setAvailableCustomers,
    addressFields,
    setAddressFields,
    addressSourceRaw,
    setAddressSourceRaw,
    addressCopied,
    setAddressCopied,
    showCustomerDropdown,
    setShowCustomerDropdown,
    linkedLead,
    setLinkedLead,
    jobProducts,
    setJobProducts,
    allProducts,
    setAllProducts,
    showProductsSection,
    setShowProductsSection,
    selectedProductId,
    setSelectedProductId,
    showAllocationSection,
    setShowAllocationSection,
    allocationOverrideEnabled,
    setAllocationOverrideEnabled,
    topAllocation,
    setTopAllocation,
    baseAllocation,
    setBaseAllocation,
    allocationError,
    setAllocationError,
    activeTab,
    setActiveTab,
    currentStep,
    setCurrentStep,
    STEP_LABELS,
    actualInstallSchedule,
    setActualInstallSchedule,
    actualMaterials,
    setActualMaterials,
    actualCalculation,
    setActualCalculation,
    actualsInitialized,
    showInventoryUpdateModal,
    setShowInventoryUpdateModal,
    inventoryReviewRows,
    setInventoryReviewRows,
    pendingInventoryJob,
    setPendingInventoryJob,
    pendingInventoryBaseline,
    setPendingInventoryBaseline,
    inventoryUpdateError,
    setInventoryUpdateError,
    applyingInventoryUpdate,
    setApplyingInventoryUpdate,
    reminders,
    setReminders,
    showReminderModal,
    setShowReminderModal,
    editingReminderId,
    setEditingReminderId,
    savingReminder,
    setSavingReminder,
    reminderForm,
    setReminderForm,
    showNextReminderPrompt,
    setShowNextReminderPrompt,
    nextReminderForm,
    setNextReminderForm,
    followUps,
    setFollowUps,
    showFollowUpForm,
    setShowFollowUpForm,
    commTemplates,
    setCommTemplates,
    copiedReminderId,
    setCopiedReminderId,
    followUpForm,
    setFollowUpForm,
    evaluation,
    setEvaluation,
    evalInputs,
    setEvalInputs,
    snapshotChanges,
    setSnapshotChanges,
    showSnapshotBanner,
    setShowSnapshotBanner,
    groupJobs,
    setGroupJobs,
    ungroupedJobs,
    setUngroupedJobs,
    showGroupModal,
    setShowGroupModal,
    groupModalType,
    setGroupModalType,
    creatingGroupJob,
    setCreatingGroupJob,
    bundleAggregate,
    setBundleAggregate,
    modalView,
    setModalView,
    existingJobSearch,
    setExistingJobSearch,
    formData,
    setFormData,
    actualPricingInitialized,
    updatingFrom,
    productsTotalPrice,
    productsTotalCost,
    buildAllocationOverride,
    validateAllocationOverride,
    defaultBaseAllocationRows,
    enableAllocationOverride,
    resetAllocationToDefaults,
    applyMochaPreset,
    allocationTintColorOptions,
    allocationVariantOptions,
    resolvedMaterials,
    topAllocationTotalPct,
    baseAllocationTotalPct,
    tagSuggestions,
    customerSuggestions,
    applicableChipBlends,
    selectedBlend,
    availableBaseCoatColors,
    loadData,
    getSelectedLaborers,
    calculateCosts,
    recalcActualTotal,
    recalcTotalWithProducts,
    handleTotalPriceChange,
    handleStatusChange,
    handleSystemChange,
    handleFloorFootageChange,
    handleVerticalFootageChange,
    handleChipBlendSelect,
    handleChipBlendInputChange,
    handleTagInputChange,
    handleCustomerNameInputChange,
    handleCustomerSelect,
    handleAddressBlur,
    handleCopyAddress,
    matchedCustomer,
    matchedCustomerAddress,
    addressMatchesCustomer,
    handleSameAsCustomer,
    addressNote,
    handleTagSelect,
    openAddReminder,
    openEditReminder,
    closeReminderModal,
    requestReminderNotificationPermission,
    persistReminderChanges,
    handleSaveReminder,
    handleDeleteReminder,
    handleCompleteReminder,
    handleCreateNextReminder,
    persistFollowUpChanges,
    handleLogFollowUp,
    handleDeleteFollowUp,
    handleOpenGroupModal,
    handleCreateGroupEstimate,
    handleAddExistingJobToGroup,
    handleRemoveFromGroup,
    handleUpdateToCurrentValues,
    handleKeepOriginalValues,
    jobSourceFrom,
    prepareInventoryReview,
    updateInventoryReviewNewValue,
    handleCancelInventoryUpdate,
    handleApplyInventoryUpdate,
    syncLinkedLeadFromJob,
    handleSubmit,
    formatCurrency,
    formatInventoryValue,
    getInventoryStatus,
    noLaborersSelected,
    relevantActuals,
    jobId,
    leadId,
    onBack,
    onEditJob,
    onViewJobSheet,
  };
}

export type JobFormModel = ReturnType<typeof useJobForm>;
