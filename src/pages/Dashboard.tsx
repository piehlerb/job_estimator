import { Plus, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getAllJobs, deleteJob } from '../lib/db';
import { Job, JobCalculation } from '../types';
import { calculateJobOutputs } from '../lib/calculations';

interface DashboardProps {
  onNewJob: () => void;
  onEditJob: (id: string) => void;
}

interface JobWithCalc {
  job: Job;
  calc: JobCalculation;
}

export default function Dashboard({ onNewJob, onEditJob }: DashboardProps) {
  const [jobsWithCalc, setJobsWithCalc] = useState<JobWithCalc[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'date' | 'price' | 'margin'>('date');

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const allJobs = await getAllJobs();
      // Calculate values for each job using their snapshots
      const withCalc = allJobs.map((job) => {
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
          },
          job.systemSnapshot,
          job.costsSnapshot,
          job.laborersSnapshot
        );
        return { job, calc };
      });
      setJobsWithCalc(withCalc);
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

  const sortedJobs = [...jobsWithCalc].sort((a, b) => {
    switch (sortBy) {
      case 'price':
        return b.job.totalPrice - a.job.totalPrice;
      case 'margin':
        const marginA = a.job.totalPrice > 0 ? ((a.job.totalPrice - a.calc.totalCosts) / a.job.totalPrice) * 100 : 0;
        const marginB = b.job.totalPrice > 0 ? ((b.job.totalPrice - b.calc.totalCosts) / b.job.totalPrice) * 100 : 0;
        return marginB - marginA;
      case 'date':
      default:
        return new Date(b.job.createdAt).getTime() - new Date(a.job.createdAt).getTime();
    }
  });

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 md:mb-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Dashboard</h2>
          <p className="text-sm sm:text-base text-slate-600 mt-1">{jobsWithCalc.length} jobs tracked</p>
        </div>
        <button
          onClick={onNewJob}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm sm:text-base"
        >
          <Plus size={18} className="sm:w-5 sm:h-5" />
          New Job
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-3 sm:p-4 md:p-6 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-2">
            <h3 className="text-base sm:text-lg font-semibold text-slate-900">Jobs</h3>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-xs sm:text-sm text-slate-600 font-medium">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'price' | 'margin')}
                className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="date">Recent</option>
                <option value="price">Price (High to Low)</option>
                <option value="margin">Margin (High to Low)</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-6 sm:p-8 text-center">
            <p className="text-sm sm:text-base text-slate-600">Loading jobs...</p>
          </div>
        ) : sortedJobs.length === 0 ? (
          <div className="p-6 sm:p-8 text-center">
            <p className="text-sm sm:text-base text-slate-600 mb-4">No jobs yet. Create your first job to get started!</p>
            <button
              onClick={onNewJob}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm"
            >
              <Plus size={18} />
              Create Job
            </button>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-slate-200">
              {sortedJobs.map(({ job, calc }) => {
                const marginPct = job.totalPrice > 0 ? ((job.totalPrice - calc.totalCosts) / job.totalPrice) * 100 : 0;
                return (
                  <div
                    key={job.id}
                    className="p-3 sm:p-4 hover:bg-slate-50 transition-colors"
                    onClick={() => onEditJob(job.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-slate-900 truncate">{job.name || 'Untitled Job'}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">{new Date(job.createdAt).toLocaleDateString()}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteJob(job.id);
                        }}
                        className="ml-2 p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-slate-500">Cost</p>
                        <p className="font-medium text-slate-900">${calc.totalCosts.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Price</p>
                        <p className="font-semibold text-slate-900">${job.totalPrice.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Margin</p>
                        <p className={`font-semibold ${marginPct >= 30 ? 'text-green-600' : 'text-orange-600'}`}>
                          {marginPct.toFixed(0)}%
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 lg:px-6 py-3 text-left text-sm font-semibold text-slate-700">Job Name</th>
                    <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Total Cost</th>
                    <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Total Price</th>
                    <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Margin</th>
                    <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Date</th>
                    <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedJobs.map(({ job, calc }) => {
                    const marginPct = job.totalPrice > 0 ? ((job.totalPrice - calc.totalCosts) / job.totalPrice) * 100 : 0;
                    return (
                      <tr
                        key={job.id}
                        className="border-b border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => onEditJob(job.id)}
                      >
                        <td className="px-4 lg:px-6 py-4 text-sm font-medium text-slate-900">{job.name || 'Untitled Job'}</td>
                        <td className="px-4 lg:px-6 py-4 text-sm text-slate-600 text-right">${calc.totalCosts.toFixed(0)}</td>
                        <td className="px-4 lg:px-6 py-4 text-sm font-semibold text-slate-900 text-right">
                          ${job.totalPrice.toFixed(0)}
                        </td>
                        <td className={`px-4 lg:px-6 py-4 text-sm font-semibold text-right ${marginPct >= 30 ? 'text-green-600' : 'text-orange-600'}`}>
                          {marginPct.toFixed(0)}%
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-sm text-slate-600 text-right">
                          {new Date(job.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-sm text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button className="text-blue-600 hover:text-blue-800 font-medium text-xs lg:text-sm">Edit</button>
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
          </>
        )}
      </div>
    </div>
  );
}
