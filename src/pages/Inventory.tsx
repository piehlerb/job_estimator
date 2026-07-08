import { useState, useEffect, Fragment } from 'react';
import { Plus, Trash2, Save, ClipboardList } from 'lucide-react';
import JobSummaryModal from '../components/JobSummaryModal';
import {
  getAllJobs,
  getAllChipBlends,
  addChipBlend,
  getAllChipInventory,
  saveChipInventory,
  deleteChipInventory,
  getAllTintInventory,
  saveTintInventory,
  deleteTintInventory,
  getAllCoatingInventory,
  saveCoatingInventory,
  deleteCoatingInventory,
  getMiscInventory,
  saveMiscInventory,
  getDefaultCosts,
  getCosts,
  getPricing,
  getDefaultPricing,
  ChipBlend,
} from '../lib/db';
import { Job, ChipInventory, TintInventory, CoatingInventory, CoatingPart, MiscInventory, Costs, Pricing } from '../types';
import { calculateJobOutputs } from '../lib/calculations';
import { normalizeChipBlendName } from '../lib/syncHelpers';
import {
  coatingSkuKey,
  coatingSkuLabel,
  coatingSkuId,
  findCoatingSku,
  DEFAULT_COATING_SKUS,
} from '../lib/coatingSkus';
import { resolveJobMaterials } from '../lib/materialAllocation';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

interface ChipCommitment {
  blend: string;
  committed: number; // Won jobs
  potential: number; // Won + Pending jobs
}

interface CoatCommitment {
  committed: number;
  potential: number;
}

const COATING_PART_ORDER: Record<CoatingPart, number> = { topA: 0, topB: 1, baseA: 2, baseB: 3 };
const COATING_GROUP_LABELS: Record<CoatingPart, string> = {
  topA: 'Top A',
  topB: 'Top B',
  baseA: 'Base A',
  baseB: 'Base B',
};

export default function Inventory({ onEditJob }: { onEditJob?: (jobId: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [chipBlends, setChipBlends] = useState<ChipBlend[]>([]);
  const [chipInventory, setChipInventory] = useState<ChipInventory[]>([]);
  const [coatingInventory, setCoatingInventory] = useState<CoatingInventory[]>([]);
  const [changedCoatingIds, setChangedCoatingIds] = useState<Set<string>>(new Set());
  const [miscInventory, setMiscInventory] = useState<MiscInventory>({
    id: 'current',
    crackRepair: 0,
    moistureMitigation: 0,
    silicaSand: 0,
    shot: 0,
    updatedAt: new Date().toISOString(),
  });

  // Commitments calculated from jobs
  const [chipCommitments, setChipCommitments] = useState<ChipCommitment[]>([]);
  const [coatingCommitments, setCoatingCommitments] = useState<Map<string, CoatCommitment>>(new Map());
  const [moistureMitigationCommitment, setMoistureMitigationCommitment] = useState<CoatCommitment>({ committed: 0, potential: 0 });

  const [tintInventory, setTintInventory] = useState<TintInventory[]>([]);
  const [tintCommitments, setTintCommitments] = useState<{ color: string; committed: number; potential: number }[]>([]);
  const [newTintColor, setNewTintColor] = useState('');
  const [newTintOunces, setNewTintOunces] = useState('');

  const [newChipBlend, setNewChipBlend] = useState('');
  const [newChipPounds, setNewChipPounds] = useState('');
  const [showBlendDropdown, setShowBlendDropdown] = useState(false);

  // Add-SKU form for coating inventory
  const [newSkuPart, setNewSkuPart] = useState<CoatingPart>('topA');
  const [newSkuVariant, setNewSkuVariant] = useState('');
  const [newSkuColor, setNewSkuColor] = useState('');
  const [newSkuGallons, setNewSkuGallons] = useState('');

  // Data for Job Summary modal
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [summaryCurrentCosts, setSummaryCurrentCosts] = useState<Costs>(getDefaultCosts());
  const [summaryCurrentPricing, setSummaryCurrentPricing] = useState<Pricing>(getDefaultPricing());
  const [showJobSummary, setShowJobSummary] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [blends, chips, tints, coatings, misc, jobs, currentCosts, currentPricing] = await Promise.all([
        getAllChipBlends(),
        getAllChipInventory(),
        getAllTintInventory().catch(() => [] as TintInventory[]),
        getAllCoatingInventory(),
        getMiscInventory(),
        getAllJobs(),
        getCosts(),
        getPricing(),
      ]);

      setChipBlends(blends);
      setChipInventory(chips);
      setTintInventory(tints);
      setCoatingInventory(coatings);
      setChangedCoatingIds(new Set());
      if (misc) setMiscInventory({ ...misc, moistureMitigation: misc.moistureMitigation ?? 0 });

      // Calculate commitments from jobs that are today or in the future
      const costs = currentCosts || getDefaultCosts();
      const pricing = currentPricing || getDefaultPricing();
      calculateCommitments(jobs, costs, pricing, tints);

      // Save for Job Summary modal
      setAllJobs(jobs);
      setSummaryCurrentCosts(costs);
      setSummaryCurrentPricing(pricing);
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateCommitments = (jobs: Job[], currentCosts: Costs, currentPricing: Pricing, currentTintInventory?: TintInventory[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Helper to merge job costs snapshot with current costs for new fields
    const getMergedCosts = (job: Job): Costs => ({
      ...getDefaultCosts(),
      ...job.costsSnapshot,
      // Use current costs for new additive fields if snapshot doesn't have them
      antiSlipCostPerGal: job.costsSnapshot.antiSlipCostPerGal ?? currentCosts.antiSlipCostPerGal,
      abrasionResistanceCostPerGal: job.costsSnapshot.abrasionResistanceCostPerGal ?? currentCosts.abrasionResistanceCostPerGal,
      moistureMitigationCostPerGal: job.costsSnapshot.moistureMitigationCostPerGal ?? currentCosts.moistureMitigationCostPerGal,
      moistureMitigationSpreadRate: job.costsSnapshot.moistureMitigationSpreadRate ?? currentCosts.moistureMitigationSpreadRate,
    });

    // Helper to merge job pricing snapshot with current pricing
    const getMergedPricing = (job: Job): Pricing =>
      job.pricingSnapshot
        ? { ...getDefaultPricing(), ...job.pricingSnapshot }
        : currentPricing;

    // Filter jobs that are today or in the future
    const relevantJobs = jobs.filter((job) => {
      if (!job.installDate) return false;
      const [y, m, d] = job.installDate.split('-').map(Number);
      const jobDate = new Date(y, m - 1, d);
      return jobDate >= today;
    });

    // Separate won and pending jobs
    const wonJobs = relevantJobs.filter((job) => job.status === 'Won');
    const pendingJobs = relevantJobs.filter((job) => job.status === 'Pending');
    const wonAndPendingJobs = [...wonJobs, ...pendingJobs];

    // Calculate chip commitments by blend
    const chipByBlend: Record<string, { committed: number; potential: number }> = {};

    const calculateChipForJobs = (jobList: Job[], type: 'committed' | 'potential') => {
      jobList.forEach((job) => {
        if (!job.chipBlend) return;

        const mergedCosts = getMergedCosts(job);
        const mergedPricing = getMergedPricing(job);
        // Calculate chip needed in pounds (chipNeeded is boxes, 40 lbs per box)
        const calc = calculateJobOutputs(
          {
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
            coatingRemoval: job.coatingRemoval || 'None',
            moistureMitigation: job.moistureMitigation || false,
            tags: job.tags,
          },
          job.systemSnapshot,
          mergedCosts,
          job.laborersSnapshot,
          mergedPricing
        );

        const poundsNeeded = calc.chipNeeded * 40; // Convert boxes to pounds

        // Normalize chip blend name for consistent grouping
        const normalizedBlend = normalizeChipBlendName(job.chipBlend);
        if (!chipByBlend[normalizedBlend]) {
          chipByBlend[normalizedBlend] = { committed: 0, potential: 0 };
        }
        chipByBlend[normalizedBlend][type] += poundsNeeded;
      });
    };

    calculateChipForJobs(wonJobs, 'committed');
    calculateChipForJobs(wonAndPendingJobs, 'potential');

    setChipCommitments(
      Object.entries(chipByBlend).map(([blend, values]) => ({
        blend,
        committed: values.committed,
        potential: values.potential,
      }))
    );

    // Calculate coating + tint commitments via the shared allocation resolver
    const coatingMap = new Map<string, CoatCommitment>();
    const tintByColor: Record<string, { committed: number; potential: number }> = {};

    const accumulateMaterialsForJobs = (jobList: Job[], type: 'committed' | 'potential') => {
      jobList.forEach((job) => {
        const mergedCosts = getMergedCosts(job);
        const mergedPricing = getMergedPricing(job);
        const calc = calculateJobOutputs(
          {
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
            coatingRemoval: job.coatingRemoval || 'None',
            moistureMitigation: job.moistureMitigation || false,
            tags: job.tags,
          },
          job.systemSnapshot,
          mergedCosts,
          job.laborersSnapshot,
          mergedPricing
        );

        const resolved = resolveJobMaterials({
          baseGallons: calc.baseGallons,
          topGallons: calc.topGallons,
          baseColor: job.baseColor,
          tintColor: job.tintColor,
          includeBasecoatTint: job.includeBasecoatTint,
          includeTopcoatTint: job.includeTopcoatTint,
          override: job.materialAllocation,
        });

        resolved.coating.forEach((line) => {
          const entry = coatingMap.get(line.key) || { committed: 0, potential: 0 };
          entry[type] += line.gallons;
          coatingMap.set(line.key, entry);
        });
        resolved.tint.forEach((line) => {
          if (!tintByColor[line.color]) tintByColor[line.color] = { committed: 0, potential: 0 };
          tintByColor[line.color][type] += line.oz;
        });
      });
    };

    accumulateMaterialsForJobs(wonJobs, 'committed');
    accumulateMaterialsForJobs(wonAndPendingJobs, 'potential');

    // Also include colors from inventory that have no commitments
    if (currentTintInventory) {
      currentTintInventory.forEach((inv) => {
        if (!tintByColor[inv.color]) {
          tintByColor[inv.color] = { committed: 0, potential: 0 };
        }
      });
    }

    setTintCommitments(
      Object.entries(tintByColor).map(([color, values]) => ({
        color,
        committed: values.committed,
        potential: values.potential,
      }))
    );

    setCoatingCommitments(coatingMap);

    const calculateMoistureMitigationForJobs = (jobList: Job[]) => {
      return jobList.reduce((sum, job) => {
        const mergedCosts = getMergedCosts(job);
        const mergedPricing = getMergedPricing(job);
        const calc = calculateJobOutputs(
          {
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
            coatingRemoval: job.coatingRemoval || 'None',
            moistureMitigation: job.moistureMitigation || false,
            tags: job.tags,
          },
          job.systemSnapshot,
          mergedCosts,
          job.laborersSnapshot,
          mergedPricing
        );
        return sum + calc.moistureMitigationGallons;
      }, 0);
    };

    setMoistureMitigationCommitment({
      committed: calculateMoistureMitigationForJobs(wonJobs),
      potential: calculateMoistureMitigationForJobs(wonAndPendingJobs),
    });
  };

  const handleAddTintInventory = async () => {
    if (!newTintColor.trim() || !newTintOunces) return;
    const color = newTintColor.trim();
    const inventory: TintInventory = {
      id: generateId(),
      color,
      ounces: parseFloat(newTintOunces) || 0,
      updatedAt: new Date().toISOString(),
    };
    await saveTintInventory(inventory);
    setTintInventory([...tintInventory, inventory]);
    if (!tintCommitments.find((t) => t.color === color)) {
      setTintCommitments([...tintCommitments, { color, committed: 0, potential: 0 }]);
    }
    setNewTintColor('');
    setNewTintOunces('');
  };

  const handleUpdateTintInventory = async (id: string, ounces: number) => {
    const updated = tintInventory.map((inv) =>
      inv.id === id ? { ...inv, ounces, updatedAt: new Date().toISOString() } : inv
    );
    setTintInventory(updated);
    const item = updated.find((inv) => inv.id === id);
    if (item) await saveTintInventory(item);
  };

  const handleDeleteTintInventory = async (id: string) => {
    await deleteTintInventory(id);
    setTintInventory(tintInventory.filter((inv) => inv.id !== id));
  };

  const handleAddChipInventory = async () => {
    if (!newChipBlend || !newChipPounds) return;

    // Normalize chip blend name (trim whitespace, title case)
    const normalizedBlend = normalizeChipBlendName(newChipBlend);
    if (!normalizedBlend) return;

    // If blend doesn't exist in the list, add it
    if (!chipBlends.some((b) => normalizeChipBlendName(b.name) === normalizedBlend)) {
      const newBlend: ChipBlend = {
        id: generateId(),
        name: normalizedBlend,
      };
      await addChipBlend(newBlend);
      setChipBlends([...chipBlends, newBlend]);
    }

    const inventory: ChipInventory = {
      id: generateId(),
      blend: normalizedBlend,
      pounds: parseFloat(newChipPounds) || 0,
      updatedAt: new Date().toISOString(),
    };

    await saveChipInventory(inventory);
    setChipInventory([...chipInventory, inventory]);
    setNewChipBlend('');
    setNewChipPounds('');
  };

  const handleBlendSelect = (blendName: string) => {
    setNewChipBlend(blendName);
    setShowBlendDropdown(false);
  };

  const handleUpdateChipInventory = async (id: string, pounds: number) => {
    const updated = chipInventory.map((inv) =>
      inv.id === id ? { ...inv, pounds, updatedAt: new Date().toISOString() } : inv
    );
    setChipInventory(updated);
    const item = updated.find((inv) => inv.id === id);
    if (item) await saveChipInventory(item);
  };

  const handleDeleteChipInventory = async (id: string) => {
    await deleteChipInventory(id);
    setChipInventory(chipInventory.filter((inv) => inv.id !== id));
  };

  const handleUpdateCoatingInventory = (id: string, gallons: number) => {
    setCoatingInventory((prev) => prev.map((inv) => (inv.id === id ? { ...inv, gallons } : inv)));
    setChangedCoatingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleAddCoatingSku = async () => {
    if (!newSkuGallons && newSkuGallons !== '0') return;
    const variant = newSkuVariant.trim() || undefined;
    const color = newSkuPart === 'baseB' ? newSkuColor || undefined : undefined;

    if (findCoatingSku(coatingInventory, newSkuPart, variant, color)) {
      alert('That coating SKU already exists.');
      return;
    }

    const coords = { part: newSkuPart, variant, color };
    const defaultSku = DEFAULT_COATING_SKUS.find(
      (sku) =>
        sku.part === newSkuPart &&
        (sku.variant || '') === (variant || '') &&
        (sku.color || '') === (color || '')
    );
    const record: CoatingInventory = {
      id: coatingSkuId(coords),
      part: newSkuPart,
      variant,
      color,
      gallons: parseFloat(newSkuGallons) || 0,
      sortOrder: defaultSku?.sortOrder,
      updatedAt: new Date().toISOString(),
    };

    await saveCoatingInventory(record);
    setCoatingInventory([...coatingInventory.filter((inv) => inv.id !== record.id), record]);
    setNewSkuVariant('');
    setNewSkuColor('');
    setNewSkuGallons('');
  };

  const handleDeleteCoatingSku = async (id: string) => {
    await deleteCoatingInventory(id);
    setCoatingInventory(coatingInventory.filter((inv) => inv.id !== id));
    setChangedCoatingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleSaveAll = async () => {
    const now = new Date().toISOString();
    const changedSkus = coatingInventory.filter((inv) => changedCoatingIds.has(inv.id));
    await Promise.all([
      ...changedSkus.map((inv) => saveCoatingInventory({ ...inv, updatedAt: now })),
      saveMiscInventory(miscInventory),
    ]);
    setChangedCoatingIds(new Set());
  };

  const getAvailable = (onHand: number, committed: number) => onHand - committed;
  const getAvailablePotential = (onHand: number, potential: number) => onHand - potential;

  // SKUs sorted for display: grouped by part, then sortOrder, then label
  const sortedCoatingSkus = coatingInventory
    .slice()
    .sort((a, b) => {
      const partDiff = COATING_PART_ORDER[a.part] - COATING_PART_ORDER[b.part];
      if (partDiff !== 0) return partDiff;
      const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return coatingSkuLabel(a).localeCompare(coatingSkuLabel(b));
    });

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Inventory</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveAll}
            className="flex items-center gap-2 px-4 py-2 bg-gf-lime text-white rounded-lg font-medium hover:bg-gf-dark-green transition-colors"
          >
            <Save size={18} />
            Save
          </button>
          <button
            onClick={() => setShowJobSummary(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gf-lime text-white rounded-lg font-medium hover:bg-gf-dark-green transition-colors"
          >
            <ClipboardList size={18} />
            Job Summary
          </button>
        </div>
      </div>

      {/* Chip Inventory */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Chip Inventory</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-2 font-semibold">Blend</th>
                <th className="text-right py-3 px-2 font-semibold">On Hand (lbs)</th>
                <th className="text-right py-3 px-2 font-semibold">Committed</th>
                <th className="text-right py-3 px-2 font-semibold">Available</th>
                <th className="text-right py-3 px-2 font-semibold">Potential</th>
                <th className="text-right py-3 px-2 font-semibold">Avail (Potential)</th>
                <th className="py-3 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {chipInventory
                .slice()
                .sort((a, b) => a.blend.localeCompare(b.blend))
                .map((inv) => {
                // Use normalized blend name for commitment lookup
                const normalizedInvBlend = normalizeChipBlendName(inv.blend);
                const commitment = chipCommitments.find((c) => c.blend === normalizedInvBlend);
                const committed = commitment?.committed || 0;
                const potential = commitment?.potential || 0;
                const available = getAvailable(inv.pounds, committed);
                const availablePotential = getAvailablePotential(inv.pounds, potential);

                return (
                  <tr key={inv.id} className="border-b border-slate-100">
                    <td className="py-3 px-2 font-medium">{inv.blend}</td>
                    <td className="py-3 px-2 text-right">
                      <input
                        type="number"
                        value={inv.pounds}
                        onChange={(e) => handleUpdateChipInventory(inv.id, parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 border border-slate-300 rounded text-right"
                      />
                    </td>
                    <td className="py-3 px-2 text-right">{committed.toFixed(0)}</td>
                    <td className={`py-3 px-2 text-right font-semibold ${available < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {available.toFixed(0)}
                    </td>
                    <td className="py-3 px-2 text-right text-slate-500">{potential.toFixed(0)}</td>
                    <td className={`py-3 px-2 text-right ${availablePotential < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                      {availablePotential.toFixed(0)}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <button
                        onClick={() => handleDeleteChipInventory(inv.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex gap-2 items-end">
          <div className="relative">
            <label className="block text-xs text-slate-600 mb-1">Blend</label>
            <input
              type="text"
              value={newChipBlend}
              onChange={(e) => {
                setNewChipBlend(e.target.value);
                setShowBlendDropdown(true);
              }}
              onFocus={() => setShowBlendDropdown(true)}
              onBlur={() => setTimeout(() => setShowBlendDropdown(false), 200)}
              placeholder="Type or select..."
              className="w-48 px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            {showBlendDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {chipBlends
                  .filter((b) =>
                    !chipInventory.some((inv) => inv.blend === b.name) &&
                    b.name.toLowerCase().includes(newChipBlend.toLowerCase())
                  )
                  .map((blend) => (
                    <button
                      key={blend.id}
                      type="button"
                      onClick={() => handleBlendSelect(blend.name)}
                      className="w-full px-3 py-2 text-left hover:bg-slate-100 text-sm"
                    >
                      {blend.name}
                    </button>
                  ))}
                {newChipBlend && !chipBlends.some((b) => b.name.toLowerCase() === newChipBlend.toLowerCase()) && (
                  <div className="px-3 py-2 text-sm text-slate-500 border-t border-slate-200">
                    Press Add to create "{newChipBlend}"
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Pounds</label>
            <input
              type="number"
              value={newChipPounds}
              onChange={(e) => setNewChipPounds(e.target.value)}
              placeholder="0"
              className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <button
            onClick={handleAddChipInventory}
            disabled={!newChipBlend || !newChipPounds}
            className="flex items-center gap-1 px-3 py-2 bg-gf-lime text-white rounded-lg text-sm font-medium hover:bg-gf-dark-green disabled:bg-slate-300"
          >
            <Plus size={16} />
            Add
          </button>
        </div>
      </div>

      {/* Tint Inventory */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Tint Inventory</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-2 font-semibold">Color</th>
                <th className="text-right py-3 px-2 font-semibold">On Hand (oz)</th>
                <th className="text-right py-3 px-2 font-semibold">Committed</th>
                <th className="text-right py-3 px-2 font-semibold">Available</th>
                <th className="text-right py-3 px-2 font-semibold">Potential</th>
                <th className="text-right py-3 px-2 font-semibold">Avail (Potential)</th>
                <th className="py-3 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {tintInventory
                .slice()
                .sort((a, b) => a.color.localeCompare(b.color))
                .map((inv) => {
                  const commitment = tintCommitments.find((c) => c.color === inv.color);
                  const committed = commitment?.committed || 0;
                  const potential = commitment?.potential || 0;
                  const available = inv.ounces - committed;
                  const availablePotential = inv.ounces - potential;
                  return (
                    <tr key={inv.id} className="border-b border-slate-100">
                      <td className="py-3 px-2 font-medium">{inv.color}</td>
                      <td className="py-3 px-2 text-right">
                        <input
                          type="number"
                          step="0.5"
                          value={inv.ounces}
                          onChange={(e) => handleUpdateTintInventory(inv.id, parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 border border-slate-300 rounded text-right"
                        />
                      </td>
                      <td className="py-3 px-2 text-right">{committed.toFixed(1)}</td>
                      <td className={`py-3 px-2 text-right font-semibold ${available < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {available.toFixed(1)}
                      </td>
                      <td className="py-3 px-2 text-right text-slate-500">{potential.toFixed(1)}</td>
                      <td className={`py-3 px-2 text-right ${availablePotential < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                        {availablePotential.toFixed(1)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <button
                          onClick={() => handleDeleteTintInventory(inv.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              {tintInventory.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-slate-400 text-sm">No tint colors added yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex gap-2 items-end">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Color Name</label>
            <input
              type="text"
              value={newTintColor}
              onChange={(e) => setNewTintColor(e.target.value)}
              placeholder="e.g. Slate Gray"
              className="w-48 px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Ounces</label>
            <input
              type="number"
              step="0.5"
              value={newTintOunces}
              onChange={(e) => setNewTintOunces(e.target.value)}
              placeholder="0"
              className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <button
            onClick={handleAddTintInventory}
            disabled={!newTintColor.trim() || !newTintOunces}
            className="flex items-center gap-1 px-3 py-2 bg-gf-lime text-white rounded-lg text-sm font-medium hover:bg-gf-dark-green disabled:bg-slate-300"
          >
            <Plus size={16} />
            Add
          </button>
        </div>
      </div>

      {/* Coating Inventory */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Coating Inventory</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-2 font-semibold">Product</th>
                <th className="text-right py-3 px-2 font-semibold">On Hand (gal)</th>
                <th className="text-right py-3 px-2 font-semibold">Committed</th>
                <th className="text-right py-3 px-2 font-semibold">Available</th>
                <th className="text-right py-3 px-2 font-semibold">Potential</th>
                <th className="text-right py-3 px-2 font-semibold">Avail (Potential)</th>
                <th className="py-3 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {sortedCoatingSkus.map((inv, idx) => {
                const commitment =
                  coatingCommitments.get(coatingSkuKey(inv.part, inv.variant, inv.color)) ||
                  { committed: 0, potential: 0 };
                const available = getAvailable(inv.gallons, commitment.committed);
                const availablePotential = getAvailablePotential(inv.gallons, commitment.potential);
                const showGroupHeader = idx === 0 || sortedCoatingSkus[idx - 1].part !== inv.part;

                return (
                  <Fragment key={inv.id}>
                    {showGroupHeader && (
                      <tr className="bg-slate-50">
                        <td colSpan={7} className="py-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {COATING_GROUP_LABELS[inv.part]}
                        </td>
                      </tr>
                    )}
                    <tr className="border-b border-slate-100">
                      <td className="py-3 px-2 font-medium">{coatingSkuLabel(inv)}</td>
                      <td className="py-3 px-2 text-right">
                        <input
                          type="number"
                          step="0.1"
                          value={inv.gallons}
                          onChange={(e) => handleUpdateCoatingInventory(inv.id, parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 border border-slate-300 rounded text-right"
                        />
                      </td>
                      <td className="py-3 px-2 text-right">{commitment.committed.toFixed(2)}</td>
                      <td className={`py-3 px-2 text-right font-semibold ${available < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {available.toFixed(2)}
                      </td>
                      <td className="py-3 px-2 text-right text-slate-500">{commitment.potential.toFixed(2)}</td>
                      <td className={`py-3 px-2 text-right ${availablePotential < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                        {availablePotential.toFixed(2)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <button
                          onClick={() => handleDeleteCoatingSku(inv.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
              {sortedCoatingSkus.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-slate-400 text-sm">No coating SKUs added yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Part</label>
            <select
              value={newSkuPart}
              onChange={(e) => {
                const part = e.target.value as CoatingPart;
                setNewSkuPart(part);
                if (part !== 'baseB') setNewSkuColor('');
              }}
              className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="topA">Top A</option>
              <option value="topB">Top B</option>
              <option value="baseA">Base A</option>
              <option value="baseB">Base B</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Variant</label>
            <input
              type="text"
              list="coating-variant-suggestions"
              value={newSkuVariant}
              onChange={(e) => setNewSkuVariant(e.target.value)}
              placeholder="e.g. Original"
              className="w-36 px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <datalist id="coating-variant-suggestions">
              <option value="Original" />
              <option value="Slow Cure" />
              <option value="Normal" />
              <option value="Extended" />
            </datalist>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Color</label>
            <select
              value={newSkuColor}
              onChange={(e) => setNewSkuColor(e.target.value)}
              disabled={newSkuPart !== 'baseB'}
              className="w-28 px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-100 disabled:text-slate-400"
            >
              <option value="">None</option>
              <option value="Grey">Grey</option>
              <option value="Tan">Tan</option>
              <option value="Clear">Clear</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Gallons</label>
            <input
              type="number"
              step="0.1"
              value={newSkuGallons}
              onChange={(e) => setNewSkuGallons(e.target.value)}
              placeholder="0"
              className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <button
            onClick={handleAddCoatingSku}
            disabled={!newSkuGallons}
            className="flex items-center gap-1 px-3 py-2 bg-gf-lime text-white rounded-lg text-sm font-medium hover:bg-gf-dark-green disabled:bg-slate-300"
          >
            <Plus size={16} />
            Add SKU
          </button>
        </div>
      </div>

      {/* Miscellaneous Inventory */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mt-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Miscellaneous Inventory</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-2 font-semibold">Product</th>
                <th className="text-right py-3 px-2 font-semibold">On Hand</th>
                <th className="text-right py-3 px-2 font-semibold">Committed</th>
                <th className="text-right py-3 px-2 font-semibold">Available</th>
                <th className="text-right py-3 px-2 font-semibold">Potential</th>
                <th className="text-right py-3 px-2 font-semibold">Avail (Potential)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-3 px-2 font-medium">Crack Repair</td>
                <td className="py-3 px-2 text-right">
                  <input
                    type="number"
                    step="0.1"
                    value={miscInventory.crackRepair}
                    onChange={(e) =>
                      setMiscInventory({ ...miscInventory, crackRepair: parseFloat(e.target.value) || 0 })
                    }
                    className="w-24 px-2 py-1 border border-slate-300 rounded text-right"
                  />
                  <span className="ml-2 text-slate-500">gal</span>
                </td>
                <td className="py-3 px-2 text-right text-slate-400">-</td>
                <td className="py-3 px-2 text-right text-slate-400">-</td>
                <td className="py-3 px-2 text-right text-slate-400">-</td>
                <td className="py-3 px-2 text-right text-slate-400">-</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 px-2 font-medium">Moisture Mitigation</td>
                <td className="py-3 px-2 text-right">
                  <input
                    type="number"
                    step="0.1"
                    value={miscInventory.moistureMitigation}
                    onChange={(e) =>
                      setMiscInventory({ ...miscInventory, moistureMitigation: parseFloat(e.target.value) || 0 })
                    }
                    className="w-24 px-2 py-1 border border-slate-300 rounded text-right"
                  />
                  <span className="ml-2 text-slate-500">gal</span>
                </td>
                <td className="py-3 px-2 text-right">{moistureMitigationCommitment.committed.toFixed(2)}</td>
                <td className={`py-3 px-2 text-right font-semibold ${getAvailable(miscInventory.moistureMitigation, moistureMitigationCommitment.committed) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {getAvailable(miscInventory.moistureMitigation, moistureMitigationCommitment.committed).toFixed(2)}
                </td>
                <td className="py-3 px-2 text-right text-slate-500">{moistureMitigationCommitment.potential.toFixed(2)}</td>
                <td className={`py-3 px-2 text-right ${getAvailablePotential(miscInventory.moistureMitigation, moistureMitigationCommitment.potential) < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                  {getAvailablePotential(miscInventory.moistureMitigation, moistureMitigationCommitment.potential).toFixed(2)}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 px-2 font-medium">Silica Sand</td>
                <td className="py-3 px-2 text-right">
                  <input
                    type="number"
                    step="0.1"
                    value={miscInventory.silicaSand}
                    onChange={(e) =>
                      setMiscInventory({ ...miscInventory, silicaSand: parseFloat(e.target.value) || 0 })
                    }
                    className="w-24 px-2 py-1 border border-slate-300 rounded text-right"
                  />
                  <span className="ml-2 text-slate-500">buckets</span>
                </td>
                <td className="py-3 px-2 text-right text-slate-400">-</td>
                <td className="py-3 px-2 text-right text-slate-400">-</td>
                <td className="py-3 px-2 text-right text-slate-400">-</td>
                <td className="py-3 px-2 text-right text-slate-400">-</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 px-2 font-medium">Shot</td>
                <td className="py-3 px-2 text-right">
                  <input
                    type="number"
                    step="0.1"
                    value={miscInventory.shot}
                    onChange={(e) =>
                      setMiscInventory({ ...miscInventory, shot: parseFloat(e.target.value) || 0 })
                    }
                    className="w-24 px-2 py-1 border border-slate-300 rounded text-right"
                  />
                  <span className="ml-2 text-slate-500">buckets</span>
                </td>
                <td className="py-3 px-2 text-right text-slate-400">-</td>
                <td className="py-3 px-2 text-right text-slate-400">-</td>
                <td className="py-3 px-2 text-right text-slate-400">-</td>
                <td className="py-3 px-2 text-right text-slate-400">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <JobSummaryModal
        isOpen={showJobSummary}
        onClose={() => setShowJobSummary(false)}
        jobs={allJobs}
        coatingInventory={coatingInventory}
        miscInventory={miscInventory}
        chipInventory={chipInventory}
        tintInventory={tintInventory}
        currentCosts={summaryCurrentCosts}
        currentPricing={summaryCurrentPricing}
        onEditJob={onEditJob}
      />
    </div>
  );
}
