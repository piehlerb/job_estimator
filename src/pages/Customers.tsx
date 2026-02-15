import { useEffect, useMemo, useState } from 'react';
import { getAllJobs } from '../lib/db';
import { Job, JobStatus } from '../types';

interface CustomerSummary {
  key: string;
  name: string;
  latestAddress?: string;
  addresses: string[];
  jobs: number;
  won: number;
  pending: number;
  lost: number;
  totalContractValue: number;
  lastInstallDate?: string;
  lastUpdatedAt?: string;
}

const ALL_STATUSES: JobStatus[] = ['Pending', 'Won', 'Lost'];

export default function Customers() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatus[]>(['Pending', 'Won', 'Lost']);
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const allJobs = await getAllJobs();
      setJobs(allJobs);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const customers = useMemo(() => {
    const map = new Map<string, CustomerSummary>();

    jobs
      .filter((job) => statusFilter.includes(job.status))
      .forEach((job) => {
        const customerName = job.customerName?.trim();
        if (!customerName) return;

        const key = customerName.toLowerCase();
        const address = job.customerAddress?.trim();
        const updatedAt = job.updatedAt || job.createdAt;

        if (!map.has(key)) {
          map.set(key, {
            key,
            name: customerName,
            latestAddress: address || undefined,
            addresses: address ? [address] : [],
            jobs: 0,
            won: 0,
            pending: 0,
            lost: 0,
            totalContractValue: 0,
            lastInstallDate: job.installDate || undefined,
            lastUpdatedAt: updatedAt,
          });
        }

        const entry = map.get(key)!;
        entry.jobs += 1;
        entry.totalContractValue += job.totalPrice;

        if (job.status === 'Won') entry.won += 1;
        if (job.status === 'Pending') entry.pending += 1;
        if (job.status === 'Lost') entry.lost += 1;

        if (address && !entry.addresses.includes(address)) {
          entry.addresses.push(address);
        }

        if (!entry.lastInstallDate || (job.installDate && job.installDate > entry.lastInstallDate)) {
          entry.lastInstallDate = job.installDate || entry.lastInstallDate;
        }

        if (!entry.lastUpdatedAt || updatedAt > entry.lastUpdatedAt) {
          entry.lastUpdatedAt = updatedAt;
          entry.name = customerName;
          if (address) {
            entry.latestAddress = address;
          }
        } else if (!entry.latestAddress && address) {
          entry.latestAddress = address;
        }
      });

    return Array.from(map.values())
      .filter((customer) => customer.name.toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => b.totalContractValue - a.totalContractValue);
  }, [jobs, query, statusFilter]);

  const totals = useMemo(() => {
    return customers.reduce((acc, customer) => {
      acc.customers += 1;
      acc.jobs += customer.jobs;
      acc.totalContractValue += customer.totalContractValue;
      return acc;
    }, { customers: 0, jobs: 0, totalContractValue: 0 });
  }, [customers]);

  const selectedCustomerJobs = useMemo(() => {
    if (!selectedCustomerKey) return [];

    return jobs
      .filter((job) => statusFilter.includes(job.status))
      .filter((job) => job.customerName?.trim().toLowerCase() === selectedCustomerKey)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [jobs, selectedCustomerKey, statusFilter]);

  const handleStatusToggle = (status: JobStatus) => {
    setStatusFilter((prev) => {
      if (prev.includes(status)) {
        if (prev.length === 1) return prev;
        return prev.filter((s) => s !== status);
      }
      return [...prev, status];
    });
  };

  const formatCurrency = (value: number) => (
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
  );

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-4 sm:mb-6 md:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Customers</h1>
        <p className="text-sm sm:text-base text-slate-600 mt-1">Customer list built from existing jobs</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
          <p className="text-xs text-slate-500">Customers</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{totals.customers}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
          <p className="text-xs text-slate-500">Jobs</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{totals.jobs}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 col-span-2 lg:col-span-1">
          <p className="text-xs text-slate-500">Total Contract Value</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{formatCurrency(totals.totalContractValue)}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 md:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customer name..."
            className="w-full sm:max-w-sm px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs sm:text-sm text-slate-600 font-medium">Status:</label>
            {ALL_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => handleStatusToggle(status)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter.includes(status) ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-600">Loading customers...</div>
        ) : customers.length === 0 ? (
          <div className="p-8 text-center text-slate-600">No customers found for the current filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 lg:px-6 py-3 text-left text-sm font-semibold text-slate-700">Customer</th>
                  <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Jobs</th>
                  <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Won</th>
                  <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Pending</th>
                  <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Lost</th>
                  <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Contract Value</th>
                  <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Last Install</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr
                    key={customer.key}
                    onClick={() => setSelectedCustomerKey(customer.key)}
                    className={`border-b border-slate-200 cursor-pointer hover:bg-slate-50 ${
                      selectedCustomerKey === customer.key ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-4 lg:px-6 py-4 text-sm">
                      <div className="font-medium text-slate-900">{customer.name}</div>
                      <div className="text-xs text-slate-500">
                        {customer.latestAddress || 'No address yet'}
                        {customer.addresses.length > 1 && ` (${customer.addresses.length} addresses)`}
                      </div>
                    </td>
                    <td className="px-4 lg:px-6 py-4 text-sm text-right text-slate-700">{customer.jobs}</td>
                    <td className="px-4 lg:px-6 py-4 text-sm text-right text-green-700">{customer.won}</td>
                    <td className="px-4 lg:px-6 py-4 text-sm text-right text-amber-700">{customer.pending}</td>
                    <td className="px-4 lg:px-6 py-4 text-sm text-right text-red-700">{customer.lost}</td>
                    <td className="px-4 lg:px-6 py-4 text-sm text-right text-slate-700">{formatCurrency(customer.totalContractValue)}</td>
                    <td className="px-4 lg:px-6 py-4 text-sm text-right text-slate-700">
                      {customer.lastInstallDate ? new Date(customer.lastInstallDate).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedCustomerKey && (
        <div className="mt-4 sm:mt-6 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-3 sm:p-4 md:p-6 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900">Customer Jobs</h2>
            <button
              type="button"
              onClick={() => setSelectedCustomerKey(null)}
              className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
            >
              Close
            </button>
          </div>
          {selectedCustomerJobs.length === 0 ? (
            <div className="p-6 text-sm text-slate-600">No jobs match the current status filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 lg:px-6 py-3 text-left text-sm font-semibold text-slate-700">Job</th>
                    <th className="px-4 lg:px-6 py-3 text-left text-sm font-semibold text-slate-700">Address</th>
                    <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Status</th>
                    <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Install</th>
                    <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">Contract</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedCustomerJobs.map((job) => (
                    <tr key={job.id} className="border-b border-slate-200">
                      <td className="px-4 lg:px-6 py-4 text-sm font-medium text-slate-900">{job.name || 'Untitled Job'}</td>
                      <td className="px-4 lg:px-6 py-4 text-sm text-slate-600">{job.customerAddress || '-'}</td>
                      <td className="px-4 lg:px-6 py-4 text-sm text-right text-slate-700">{job.status}</td>
                      <td className="px-4 lg:px-6 py-4 text-sm text-right text-slate-700">
                        {job.installDate ? new Date(job.installDate).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-sm text-right text-slate-900">{formatCurrency(job.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
