import { Plus, TrendingUp, DollarSign, Zap, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getAllJobs, deleteJob } from '../lib/db';
import { Job } from '../types';
import { calculateJobCosts } from '../lib/calculations';

interface DashboardProps {
  onNewJob: () => void;
  onEditJob: (id: string) => void;
}

interface JobWithCalculations extends Job {
  calculatedTotalCost: number;
  calculatedSuggestedPrice: number;
  calculatedMargin: number;
}

export default function Dashboard({ onNewJob, onEditJob }: DashboardProps) {
  const [jobs, setJobs] = useState<JobWithCalculations[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'date' | 'price' | 'margin'>('date');

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const allJobs = await getAllJobs();

      // Calculate costs for each job using the snapshot data
      const jobsWithCalc: JobWithCalculations[] = allJobs.map((job) => {
        const calc = calculateJobCosts(
          {
            floorFootage: job.floorFootage,
            verticalFootage: job.verticalFootage,
            crackFillFactor: job.crackFillFactor,
            installDays: job.installDays,
            installDate: job.installDate,
            travelDistance: job.travelDistance,
            laborers: job.laborers || 2, // Default to 2 for old jobs
            totalPrice: job.totalPrice,
          },
          job.systemSnapshot,
          {
            baseCostPerGal: job.baseCostPerGal,
            topCostPerGal: job.topCostPerGal,
            crackFillCostPerGal: job.crackFillCostPerGal,
            gasCost: job.gasCost,
            fullyLoadedEE: job.fullyLoadedEE,
            consumablesCost: job.consumablesCost,
          }
        );

        return {
          ...job,
          calculatedTotalCost: calc.totalCosts,
          calculatedSuggestedPrice: calc.suggestedTotal,
          calculatedMargin: calc.suggestedMargin,
        };
      });

      setJobs(jobsWithCalc);
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteJob = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this job?')) {
      try {
        await deleteJob(id);
        await loadJobs();
      } catch (error) {
        console.error('Error deleting job:', error);
        alert('Error deleting job');
      }
    }
  };

  const sortedJobs = [...jobs].sort((a, b) => {
    switch (sortBy) {
      case 'price':
        return (b.totalPrice || 0) - (a.totalPrice || 0);
      case 'margin':
        const marginA = a.calculatedMargin / (a.calculatedSuggestedPrice || 1);
        const marginB = b.calculatedMargin / (b.calculatedSuggestedPrice || 1);
        return marginB - marginA;
      case 'date':
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  const totalRevenue = jobs.reduce((sum, job) => sum + (job.totalPrice || 0), 0);
  const totalCost = jobs.reduce((sum, job) => sum + job.calculatedTotalCost, 0);
  const potentialProfit = totalRevenue - totalCost;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Dashboard</h2>
          <p className="text-slate-600 mt-1">{jobs.length} jobs tracked</p>
        </div>
        <button
          onClick={onNewJob}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          New Job
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-sm font-medium">Total Revenue</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">${totalRevenue.toFixed(0)}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <DollarSign size={24} className="text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-sm font-medium">Total Cost</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">${totalCost.toFixed(0)}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <Zap size={24} className="text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-sm font-medium">Potential Profit</p>
              <p className={`text-2xl font-bold mt-2 ${potentialProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${potentialProfit.toFixed(0)}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${potentialProfit >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              <TrendingUp size={24} className={potentialProfit >= 0 ? 'text-green-600' : 'text-red-600'} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Jobs</h3>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600 font-medium">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'price' | 'margin')}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="date">Recent</option>
                <option value="price">Price (High to Low)</option>
                <option value="margin">Margin (High to Low)</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <p className="text-slate-600">Loading jobs...</p>
          </div>
        ) : sortedJobs.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-600 mb-4">No jobs yet. Create your first job to get started!</p>
            <button
              onClick={onNewJob}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              Create Job
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Job Name</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-slate-700">Total Cost</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-slate-700">Your Price</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-slate-700">Margin</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-slate-700">Date</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-slate-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedJobs.map((job) => {
                  const margin = job.totalPrice > 0 ? (job.totalPrice - job.calculatedTotalCost) / job.totalPrice : 0;
                  return (
                    <tr
                      key={job.id}
                      className="border-b border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => onEditJob(job.id)}
                    >
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{job.name || 'Untitled Job'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 text-right">${job.calculatedTotalCost.toFixed(0)}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900 text-right">
                        ${(job.totalPrice || 0).toFixed(0)}
                      </td>
                      <td className={`px-6 py-4 text-sm font-semibold text-right ${margin >= 0.3 ? 'text-green-600' : margin >= 0 ? 'text-orange-600' : 'text-red-600'}`}>
                        {(margin * 100).toFixed(0)}%
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 text-right">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button className="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteJob(job.id);
                            }}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
