import { Plus, Edit2, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getAllCustomers, addCustomer, updateCustomer, deleteCustomer, getAllJobs } from '../lib/db';
import { Customer, Job, JobStatus } from '../types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

interface CustomerWithStats extends Customer {
  jobs: number;
  won: number;
  pending: number;
  lost: number;
  totalContractValue: number;
  lastInstallDate?: string;
}

const ALL_STATUSES: JobStatus[] = ['Pending', 'Won', 'Lost'];

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatus[]>(['Pending', 'Won', 'Lost']);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  // Detail panel
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allCustomers, allJobs] = await Promise.all([getAllCustomers(), getAllJobs()]);
      setCustomers(allCustomers);
      setJobs(allJobs);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Build stats for each customer
  const customersWithStats = useMemo((): CustomerWithStats[] => {
    return customers.map((customer) => {
      const customerJobs = jobs.filter(
        (job) =>
          statusFilter.includes(job.status) &&
          job.customerName?.trim().toLowerCase() === customer.name.trim().toLowerCase()
      );

      return {
        ...customer,
        jobs: customerJobs.length,
        won: customerJobs.filter((j) => j.status === 'Won').length,
        pending: customerJobs.filter((j) => j.status === 'Pending').length,
        lost: customerJobs.filter((j) => j.status === 'Lost').length,
        totalContractValue: customerJobs.reduce((sum, j) => sum + j.totalPrice, 0),
        lastInstallDate: customerJobs
          .filter((j) => j.installDate)
          .sort((a, b) => (b.installDate > a.installDate ? 1 : -1))[0]?.installDate,
      };
    });
  }, [customers, jobs, statusFilter]);

  const filteredCustomers = useMemo(() => {
    return customersWithStats
      .filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [customersWithStats, query]);

  const totals = useMemo(() => {
    return filteredCustomers.reduce(
      (acc, c) => {
        acc.jobs += c.jobs;
        acc.totalContractValue += c.totalContractValue;
        return acc;
      },
      { jobs: 0, totalContractValue: 0 }
    );
  }, [filteredCustomers]);

  const selectedCustomerJobs = useMemo(() => {
    if (!selectedCustomerId) return [];
    const customer = customers.find((c) => c.id === selectedCustomerId);
    if (!customer) return [];
    return jobs
      .filter(
        (job) =>
          statusFilter.includes(job.status) &&
          job.customerName?.trim().toLowerCase() === customer.name.trim().toLowerCase()
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [jobs, selectedCustomerId, customers, statusFilter]);

  const handleStatusToggle = (status: JobStatus) => {
    setStatusFilter((prev) => {
      if (prev.includes(status)) {
        if (prev.length === 1) return prev;
        return prev.filter((s) => s !== status);
      }
      return [...prev, status];
    });
  };

  const openAddForm = () => {
    setEditingCustomer(null);
    setFormData({ name: '', address: '', phone: '', email: '', notes: '' });
    setShowForm(true);
  };

  const openEditForm = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      address: customer.address || '',
      phone: customer.phone || '',
      email: customer.email || '',
      notes: customer.notes || '',
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const record: Customer = {
        id: editingCustomer?.id || generateId(),
        name: formData.name.trim(),
        address: formData.address.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        email: formData.email.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        createdAt: editingCustomer?.createdAt || now,
        updatedAt: now,
      };

      if (editingCustomer) {
        await updateCustomer(record);
      } else {
        await addCustomer(record);
      }

      await loadData();
      setShowForm(false);
      setEditingCustomer(null);
      setFormData({ name: '', address: '', phone: '', email: '', notes: '' });
    } catch (error) {
      console.error('Error saving customer:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (customer: Customer) => {
    if (!confirm(`Delete customer "${customer.name}"? This cannot be undone.`)) return;
    try {
      await deleteCustomer(customer.id);
      if (selectedCustomerId === customer.id) setSelectedCustomerId(null);
      await loadData();
    } catch (error) {
      console.error('Error deleting customer:', error);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-4 sm:mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Customers</h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1">Manage your customer list</p>
        </div>
        <button
          type="button"
          onClick={openAddForm}
          className="flex items-center gap-2 px-4 py-2 bg-gf-lime text-white rounded-lg font-medium hover:bg-gf-dark-green transition-colors text-sm"
        >
          <Plus size={16} />
          Add Customer
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
          <p className="text-xs text-slate-500">Customers</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{filteredCustomers.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
          <p className="text-xs text-slate-500">Jobs</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{totals.jobs}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 col-span-2 lg:col-span-1">
          <p className="text-xs text-slate-500">Total Contract Value</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">
            {formatCurrency(totals.totalContractValue)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 md:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customer name..."
            className="w-full sm:max-w-sm px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs sm:text-sm text-slate-600 font-medium">Job Status:</label>
            {ALL_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => handleStatusToggle(status)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter.includes(status)
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Customer table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mb-4 sm:mb-6">
        {loading ? (
          <div className="p-8 text-center text-slate-600">Loading customers...</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-8 text-center text-slate-600">
            {customers.length === 0
              ? 'No customers yet. Click "Add Customer" to create one.'
              : 'No customers match the current search.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 lg:px-6 py-3 text-left text-sm font-semibold text-slate-700">
                    Customer
                  </th>
                  <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">
                    Jobs
                  </th>
                  <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">
                    Won
                  </th>
                  <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">
                    Pending
                  </th>
                  <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">
                    Lost
                  </th>
                  <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">
                    Contract Value
                  </th>
                  <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">
                    Last Install
                  </th>
                  <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <>
                    <tr
                      key={customer.id}
                      className={`border-b border-slate-200 hover:bg-slate-50 ${
                        selectedCustomerId === customer.id ? 'bg-green-50' : ''
                      }`}
                    >
                      <td className="px-4 lg:px-6 py-4 text-sm">
                        <div className="font-medium text-slate-900">{customer.name}</div>
                        {customer.address && (
                          <div className="text-xs text-slate-500">{customer.address}</div>
                        )}
                        {(customer.phone || customer.email) && (
                          <div className="text-xs text-slate-400">
                            {[customer.phone, customer.email].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-sm text-right text-slate-700">
                        {customer.jobs}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-sm text-right text-green-700">
                        {customer.won}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-sm text-right text-amber-700">
                        {customer.pending}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-sm text-right text-red-700">
                        {customer.lost}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-sm text-right text-slate-700">
                        {formatCurrency(customer.totalContractValue)}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-sm text-right text-slate-700">
                        {customer.lastInstallDate
                          ? new Date(customer.lastInstallDate).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedCustomerId(
                                selectedCustomerId === customer.id ? null : customer.id
                              )
                            }
                            className="p-1.5 rounded text-slate-400 hover:text-gf-dark-green hover:bg-green-50 transition-colors"
                            title={selectedCustomerId === customer.id ? 'Collapse' : 'View jobs'}
                          >
                            {selectedCustomerId === customer.id ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditForm(customer)}
                            className="p-1.5 rounded text-slate-400 hover:text-gf-dark-green hover:bg-green-50 transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(customer)}
                            className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Inline job list */}
                    {selectedCustomerId === customer.id && (
                      <tr key={`${customer.id}-jobs`} className="bg-green-50">
                        <td colSpan={8} className="px-4 lg:px-6 py-0">
                          {selectedCustomerJobs.length === 0 ? (
                            <p className="py-4 text-sm text-slate-500">
                              No jobs match the current status filter.
                            </p>
                          ) : (
                            <table className="w-full my-3">
                              <thead>
                                <tr className="text-xs text-slate-500 border-b border-green-200">
                                  <th className="text-left pb-2 font-medium">Job</th>
                                  <th className="text-left pb-2 font-medium">Address</th>
                                  <th className="text-right pb-2 font-medium">Status</th>
                                  <th className="text-right pb-2 font-medium">Install</th>
                                  <th className="text-right pb-2 font-medium">Contract</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedCustomerJobs.map((job) => (
                                  <tr
                                    key={job.id}
                                    className="border-b border-green-100 last:border-0"
                                  >
                                    <td className="py-2 text-sm font-medium text-slate-900">
                                      {job.name || 'Untitled Job'}
                                    </td>
                                    <td className="py-2 text-sm text-slate-600">
                                      {job.customerAddress || '-'}
                                    </td>
                                    <td className="py-2 text-sm text-right text-slate-700">
                                      {job.status}
                                    </td>
                                    <td className="py-2 text-sm text-right text-slate-700">
                                      {job.installDate
                                        ? new Date(job.installDate).toLocaleDateString()
                                        : '-'}
                                    </td>
                                    <td className="py-2 text-sm text-right text-slate-900">
                                      {formatCurrency(job.totalPrice)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingCustomer ? 'Edit Customer' : 'Add Customer'}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., John Smith"
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g., 123 Main St, City, State 12345"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g., (555) 123-4567"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g., john@example.com"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional notes..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !formData.name.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-gf-lime rounded-lg hover:bg-gf-dark-green transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : editingCustomer ? 'Save Changes' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
