import { ArrowLeft, Save, ChevronDown, ChevronUp, X, Plus } from 'lucide-react';
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
} from '../lib/db';
import { BaseColor, ChipSystem, Costs, Pricing, Job, JobCalculation, JobStatus, Laborer, InstallDaySchedule, ChipInventory, CoatingRemovalType, Product, JobProduct } from '../types';
import { calculateJobOutputs } from '../lib/calculations';
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
}

interface CustomerOption {
  name: string;
  address?: string;
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
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [availableCustomers, setAvailableCustomers] = useState<CustomerOption[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Products state
  const [jobProducts, setJobProducts] = useState<JobProduct[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [showProductsSection, setShowProductsSection] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');

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
    tags: '',
    baseColor: '' as BaseColor | '',
    status: 'Pending' as JobStatus,
    estimateDate: new Date().toISOString().split('T')[0],
    decisionDate: '',
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
      console.log('[JobForm] Data loaded:', { systems: allSystems.length, costs: !!storedCosts, pricing: !!storedPricing, laborers: laborers.length });
      setSystems(allSystems);
      setActiveLaborers(laborers);
      setChipBlends(blends);
      setChipInventory(inventory);
      setAllProducts(productCatalog);
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
            estimateDate: job.estimateDate || job.createdAt.split('T')[0],
            decisionDate: job.decisionDate || '',
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
          // Load products from existing job
          if (job.products && job.products.length > 0) {
            setJobProducts(job.products);
            setShowProductsSection(true);
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
        products: jobProducts.length > 0 ? jobProducts : undefined,
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
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{jobId ? 'Edit Job' : 'Create New Job'}</h2>
          <button
            type="submit"
            form="job-form"
            disabled={saving}
            className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            <Save size={16} className="sm:w-[18px] sm:h-[18px]" />
            {saving ? 'Saving...' : jobId ? 'Update Job' : 'Create Job'}
          </button>
        </div>

        {/* Snapshot Change Banner */}
        {showSnapshotBanner && snapshotChanges && (
          <SnapshotChangeBanner
            changes={snapshotChanges}
            onUpdate={handleUpdateToCurrentValues}
            onDismiss={handleKeepOriginalValues}
          />
        )}

        <form id="job-form" onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
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

            <div className="flex flex-col gap-3">
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
                <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Decision Date</label>
                <input
                  type="date"
                  value={formData.decisionDate}
                  onChange={(e) => setFormData({ ...formData, decisionDate: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Estimate Date</label>
              <input
                type="date"
                value={formData.estimateDate}
                onChange={(e) => setFormData({ ...formData, estimateDate: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-2 flex gap-3">
              <div className="relative w-2/5 min-w-0">
                <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Customer Name</label>
                <input
                  type="text"
                  placeholder="e.g., John Smith"
                  value={formData.customerName}
                  onChange={(e) => handleCustomerNameInputChange(e.target.value)}
                  onFocus={() => setShowCustomerDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
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

            <div className="md:col-span-2 lg:col-span-3 relative">
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Tags</label>
              <input
                type="text"
                placeholder="e.g., Commercial, Warranty, HOA"
                value={formData.tags}
                onChange={(e) => handleTagInputChange(e.target.value)}
                onFocus={() => setShowTagDropdown(true)}
                onBlur={() => setTimeout(() => setShowTagDropdown(false), 200)}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                        className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                        className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                                    className="w-16 text-right text-sm bg-transparent border-b border-slate-300 focus:outline-none focus:border-blue-600 p-0"
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
                                    className="w-24 text-right text-sm bg-transparent border-b border-slate-300 focus:outline-none focus:border-blue-600 p-0"
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
