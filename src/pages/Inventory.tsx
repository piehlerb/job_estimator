import { useState, useEffect } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import {
  getAllJobs,
  getAllChipBlends,
  addChipBlend,
  getAllChipInventory,
  saveChipInventory,
  deleteChipInventory,
  getTopCoatInventory,
  saveTopCoatInventory,
  getBaseCoatInventory,
  saveBaseCoatInventory,
  ChipBlend,
} from '../lib/db';
import { Job, ChipInventory, TopCoatInventory, BaseCoatInventory } from '../types';
import { calculateJobOutputs } from '../lib/calculations';

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

export default function Inventory() {
  const [loading, setLoading] = useState(true);
  const [chipBlends, setChipBlends] = useState<ChipBlend[]>([]);
  const [chipInventory, setChipInventory] = useState<ChipInventory[]>([]);
  const [topCoatInventory, setTopCoatInventory] = useState<TopCoatInventory>({
    id: 'current',
    topA: 0,
    topB: 0,
    updatedAt: new Date().toISOString(),
  });
  const [baseCoatInventory, setBaseCoatInventory] = useState<BaseCoatInventory>({
    id: 'current',
    baseA: 0,
    baseBGrey: 0,
    baseBTan: 0,
    updatedAt: new Date().toISOString(),
  });

  // Commitments calculated from jobs
  const [chipCommitments, setChipCommitments] = useState<ChipCommitment[]>([]);
  const [topACommitment, setTopACommitment] = useState<CoatCommitment>({ committed: 0, potential: 0 });
  const [topBCommitment, setTopBCommitment] = useState<CoatCommitment>({ committed: 0, potential: 0 });
  const [baseACommitment, setBaseACommitment] = useState<CoatCommitment>({ committed: 0, potential: 0 });
  const [baseBGreyCommitment, setBaseBGreyCommitment] = useState<CoatCommitment>({ committed: 0, potential: 0 });
  const [baseBTanCommitment, setBaseBTanCommitment] = useState<CoatCommitment>({ committed: 0, potential: 0 });

  const [newChipBlend, setNewChipBlend] = useState('');
  const [newChipPounds, setNewChipPounds] = useState('');
  const [showBlendDropdown, setShowBlendDropdown] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [blends, chips, topCoat, baseCoat, jobs] = await Promise.all([
        getAllChipBlends(),
        getAllChipInventory(),
        getTopCoatInventory(),
        getBaseCoatInventory(),
        getAllJobs(),
      ]);

      setChipBlends(blends);
      setChipInventory(chips);
      if (topCoat) setTopCoatInventory(topCoat);
      if (baseCoat) setBaseCoatInventory(baseCoat);

      // Calculate commitments from jobs that are today or in the future
      calculateCommitments(jobs);
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateCommitments = (jobs: Job[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filter jobs that are today or in the future
    const relevantJobs = jobs.filter((job) => {
      if (!job.installDate) return false;
      const jobDate = new Date(job.installDate);
      jobDate.setHours(0, 0, 0, 0);
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
          },
          job.systemSnapshot,
          job.costsSnapshot,
          job.laborersSnapshot
        );

        const poundsNeeded = calc.chipNeeded * 40; // Convert boxes to pounds

        if (!chipByBlend[job.chipBlend]) {
          chipByBlend[job.chipBlend] = { committed: 0, potential: 0 };
        }
        chipByBlend[job.chipBlend][type] += poundsNeeded;
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

    // Calculate top coat commitments
    let topCommitted = 0;
    let topPotential = 0;

    const calculateTopForJobs = (jobList: Job[]) => {
      return jobList.reduce((sum, job) => {
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
          },
          job.systemSnapshot,
          job.costsSnapshot,
          job.laborersSnapshot
        );
        return sum + calc.topGallons;
      }, 0);
    };

    topCommitted = calculateTopForJobs(wonJobs);
    topPotential = calculateTopForJobs(wonAndPendingJobs);

    // Top A and Top B are each 50% of top coat
    setTopACommitment({ committed: topCommitted * 0.5, potential: topPotential * 0.5 });
    setTopBCommitment({ committed: topCommitted * 0.5, potential: topPotential * 0.5 });

    // Calculate base coat commitments by color
    let baseGreyCommitted = 0;
    let baseGreyPotential = 0;
    let baseTanCommitted = 0;
    let baseTanPotential = 0;

    const calculateBaseForJobs = (jobList: Job[], color: 'Grey' | 'Tan' | 'Clear' | undefined) => {
      return jobList
        .filter((job) => job.baseColor === color)
        .reduce((sum, job) => {
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
            },
            job.systemSnapshot,
            job.costsSnapshot,
            job.laborersSnapshot
          );
          return sum + calc.baseGallons;
        }, 0);
    };

    baseGreyCommitted = calculateBaseForJobs(wonJobs, 'Grey');
    baseGreyPotential = calculateBaseForJobs(wonAndPendingJobs, 'Grey');
    baseTanCommitted = calculateBaseForJobs(wonJobs, 'Tan');
    baseTanPotential = calculateBaseForJobs(wonAndPendingJobs, 'Tan');

    // Also include Clear jobs - they need Base A only (1/3 of base)
    const clearCommitted = calculateBaseForJobs(wonJobs, 'Clear');
    const clearPotential = calculateBaseForJobs(wonAndPendingJobs, 'Clear');

    // Base A is 1/3 of base needed for all jobs
    const totalBaseCommitted = baseGreyCommitted + baseTanCommitted + clearCommitted;
    const totalBasePotential = baseGreyPotential + baseTanPotential + clearPotential;

    setBaseACommitment({
      committed: totalBaseCommitted / 3,
      potential: totalBasePotential / 3,
    });

    // Base B Grey is 2/3 of grey jobs
    setBaseBGreyCommitment({
      committed: (baseGreyCommitted * 2) / 3,
      potential: (baseGreyPotential * 2) / 3,
    });

    // Base B Tan is 2/3 of tan jobs
    setBaseBTanCommitment({
      committed: (baseTanCommitted * 2) / 3,
      potential: (baseTanPotential * 2) / 3,
    });
  };

  const handleAddChipInventory = async () => {
    if (!newChipBlend || !newChipPounds) return;

    // If blend doesn't exist in the list, add it
    if (!chipBlends.some((b) => b.name.toLowerCase() === newChipBlend.toLowerCase())) {
      const newBlend: ChipBlend = {
        id: generateId(),
        name: newChipBlend,
      };
      await addChipBlend(newBlend);
      setChipBlends([...chipBlends, newBlend]);
    }

    const inventory: ChipInventory = {
      id: generateId(),
      blend: newChipBlend,
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

  const handleSaveTopCoat = async () => {
    await saveTopCoatInventory(topCoatInventory);
  };

  const handleSaveBaseCoat = async () => {
    await saveBaseCoatInventory(baseCoatInventory);
  };

  const getAvailable = (onHand: number, committed: number) => onHand - committed;
  const getAvailablePotential = (onHand: number, potential: number) => onHand - potential;

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Inventory</h1>

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
              {chipInventory.map((inv) => {
                const commitment = chipCommitments.find((c) => c.blend === inv.blend);
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
            className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-slate-300"
          >
            <Plus size={16} />
            Add
          </button>
        </div>
      </div>

      {/* Top Coat Inventory */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-slate-900">Top Coat Inventory</h2>
          <button
            onClick={handleSaveTopCoat}
            className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Save size={16} />
            Save
          </button>
        </div>

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
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-3 px-2 font-medium">Top A</td>
                <td className="py-3 px-2 text-right">
                  <input
                    type="number"
                    step="0.1"
                    value={topCoatInventory.topA}
                    onChange={(e) =>
                      setTopCoatInventory({ ...topCoatInventory, topA: parseFloat(e.target.value) || 0 })
                    }
                    className="w-24 px-2 py-1 border border-slate-300 rounded text-right"
                  />
                </td>
                <td className="py-3 px-2 text-right">{topACommitment.committed.toFixed(2)}</td>
                <td className={`py-3 px-2 text-right font-semibold ${getAvailable(topCoatInventory.topA, topACommitment.committed) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {getAvailable(topCoatInventory.topA, topACommitment.committed).toFixed(2)}
                </td>
                <td className="py-3 px-2 text-right text-slate-500">{topACommitment.potential.toFixed(2)}</td>
                <td className={`py-3 px-2 text-right ${getAvailablePotential(topCoatInventory.topA, topACommitment.potential) < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                  {getAvailablePotential(topCoatInventory.topA, topACommitment.potential).toFixed(2)}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 px-2 font-medium">Top B</td>
                <td className="py-3 px-2 text-right">
                  <input
                    type="number"
                    step="0.1"
                    value={topCoatInventory.topB}
                    onChange={(e) =>
                      setTopCoatInventory({ ...topCoatInventory, topB: parseFloat(e.target.value) || 0 })
                    }
                    className="w-24 px-2 py-1 border border-slate-300 rounded text-right"
                  />
                </td>
                <td className="py-3 px-2 text-right">{topBCommitment.committed.toFixed(2)}</td>
                <td className={`py-3 px-2 text-right font-semibold ${getAvailable(topCoatInventory.topB, topBCommitment.committed) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {getAvailable(topCoatInventory.topB, topBCommitment.committed).toFixed(2)}
                </td>
                <td className="py-3 px-2 text-right text-slate-500">{topBCommitment.potential.toFixed(2)}</td>
                <td className={`py-3 px-2 text-right ${getAvailablePotential(topCoatInventory.topB, topBCommitment.potential) < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                  {getAvailablePotential(topCoatInventory.topB, topBCommitment.potential).toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Base Coat Inventory */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-slate-900">Base Coat Inventory</h2>
          <button
            onClick={handleSaveBaseCoat}
            className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Save size={16} />
            Save
          </button>
        </div>

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
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-3 px-2 font-medium">Base A</td>
                <td className="py-3 px-2 text-right">
                  <input
                    type="number"
                    step="0.1"
                    value={baseCoatInventory.baseA}
                    onChange={(e) =>
                      setBaseCoatInventory({ ...baseCoatInventory, baseA: parseFloat(e.target.value) || 0 })
                    }
                    className="w-24 px-2 py-1 border border-slate-300 rounded text-right"
                  />
                </td>
                <td className="py-3 px-2 text-right">{baseACommitment.committed.toFixed(2)}</td>
                <td className={`py-3 px-2 text-right font-semibold ${getAvailable(baseCoatInventory.baseA, baseACommitment.committed) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {getAvailable(baseCoatInventory.baseA, baseACommitment.committed).toFixed(2)}
                </td>
                <td className="py-3 px-2 text-right text-slate-500">{baseACommitment.potential.toFixed(2)}</td>
                <td className={`py-3 px-2 text-right ${getAvailablePotential(baseCoatInventory.baseA, baseACommitment.potential) < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                  {getAvailablePotential(baseCoatInventory.baseA, baseACommitment.potential).toFixed(2)}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 px-2 font-medium">Base B - Grey</td>
                <td className="py-3 px-2 text-right">
                  <input
                    type="number"
                    step="0.1"
                    value={baseCoatInventory.baseBGrey}
                    onChange={(e) =>
                      setBaseCoatInventory({ ...baseCoatInventory, baseBGrey: parseFloat(e.target.value) || 0 })
                    }
                    className="w-24 px-2 py-1 border border-slate-300 rounded text-right"
                  />
                </td>
                <td className="py-3 px-2 text-right">{baseBGreyCommitment.committed.toFixed(2)}</td>
                <td className={`py-3 px-2 text-right font-semibold ${getAvailable(baseCoatInventory.baseBGrey, baseBGreyCommitment.committed) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {getAvailable(baseCoatInventory.baseBGrey, baseBGreyCommitment.committed).toFixed(2)}
                </td>
                <td className="py-3 px-2 text-right text-slate-500">{baseBGreyCommitment.potential.toFixed(2)}</td>
                <td className={`py-3 px-2 text-right ${getAvailablePotential(baseCoatInventory.baseBGrey, baseBGreyCommitment.potential) < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                  {getAvailablePotential(baseCoatInventory.baseBGrey, baseBGreyCommitment.potential).toFixed(2)}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 px-2 font-medium">Base B - Tan</td>
                <td className="py-3 px-2 text-right">
                  <input
                    type="number"
                    step="0.1"
                    value={baseCoatInventory.baseBTan}
                    onChange={(e) =>
                      setBaseCoatInventory({ ...baseCoatInventory, baseBTan: parseFloat(e.target.value) || 0 })
                    }
                    className="w-24 px-2 py-1 border border-slate-300 rounded text-right"
                  />
                </td>
                <td className="py-3 px-2 text-right">{baseBTanCommitment.committed.toFixed(2)}</td>
                <td className={`py-3 px-2 text-right font-semibold ${getAvailable(baseCoatInventory.baseBTan, baseBTanCommitment.committed) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {getAvailable(baseCoatInventory.baseBTan, baseBTanCommitment.committed).toFixed(2)}
                </td>
                <td className="py-3 px-2 text-right text-slate-500">{baseBTanCommitment.potential.toFixed(2)}</td>
                <td className={`py-3 px-2 text-right ${getAvailablePotential(baseCoatInventory.baseBTan, baseBTanCommitment.potential) < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                  {getAvailablePotential(baseCoatInventory.baseBTan, baseBTanCommitment.potential).toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
