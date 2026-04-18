import { Plus, Edit2, Trash2, X, Tag } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getAllReferralAssociates,
  addReferralAssociate,
  updateReferralAssociate,
  deleteReferralAssociate,
  getAllReferralServices,
  addReferralService,
} from '../lib/db';
import { ReferralAssociate, ReferralService } from '../types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function normalizeServiceName(name: string): string {
  return name.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

interface FormState {
  name: string;
  company: string;
  address: string;
  phone: string;
  email: string;
  notes: string;
  serviceIds: string[];
}

const EMPTY_FORM: FormState = {
  name: '',
  company: '',
  address: '',
  phone: '',
  email: '',
  notes: '',
  serviceIds: [],
};

export default function ReferralAssociates() {
  const [associates, setAssociates] = useState<ReferralAssociate[]>([]);
  const [services, setServices] = useState<ReferralService[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeServiceFilters, setActiveServiceFilters] = useState<Set<string>>(new Set());

  const [showForm, setShowForm] = useState(false);
  const [editingAssociate, setEditingAssociate] = useState<ReferralAssociate | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [serviceInput, setServiceInput] = useState('');
  const [saving, setSaving] = useState(false);
  const serviceInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allAssociates, allServices] = await Promise.all([
        getAllReferralAssociates(),
        getAllReferralServices(),
      ]);
      setAssociates(allAssociates);
      setServices(allServices);
    } catch (error) {
      console.error('Error loading referral associates:', error);
    } finally {
      setLoading(false);
    }
  };

  const servicesById = useMemo(() => {
    const map = new Map<string, ReferralService>();
    for (const s of services) map.set(s.id, s);
    return map;
  }, [services]);

  const filteredAssociates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return associates
      .filter((a) => {
        if (activeServiceFilters.size > 0) {
          const ids = new Set(a.serviceIds || []);
          for (const filterId of activeServiceFilters) {
            if (!ids.has(filterId)) return false;
          }
        }
        if (!q) return true;
        const serviceNames = (a.serviceIds || [])
          .map((id) => servicesById.get(id)?.name || '')
          .join(' ')
          .toLowerCase();
        return (
          a.name.toLowerCase().includes(q) ||
          (a.company || '').toLowerCase().includes(q) ||
          (a.address || '').toLowerCase().includes(q) ||
          (a.phone || '').toLowerCase().includes(q) ||
          (a.email || '').toLowerCase().includes(q) ||
          (a.notes || '').toLowerCase().includes(q) ||
          serviceNames.includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [associates, query, activeServiceFilters, servicesById]);

  const openAddForm = () => {
    setEditingAssociate(null);
    setFormData(EMPTY_FORM);
    setServiceInput('');
    setShowForm(true);
  };

  const openEditForm = (associate: ReferralAssociate) => {
    setEditingAssociate(associate);
    setFormData({
      name: associate.name,
      company: associate.company || '',
      address: associate.address || '',
      phone: associate.phone || '',
      email: associate.email || '',
      notes: associate.notes || '',
      serviceIds: [...(associate.serviceIds || [])],
    });
    setServiceInput('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingAssociate(null);
    setFormData(EMPTY_FORM);
    setServiceInput('');
  };

  const toggleServiceFilter = (id: string) => {
    setActiveServiceFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeServiceFromForm = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      serviceIds: prev.serviceIds.filter((s) => s !== id),
    }));
  };

  const addServiceToForm = async (service: ReferralService) => {
    setFormData((prev) =>
      prev.serviceIds.includes(service.id)
        ? prev
        : { ...prev, serviceIds: [...prev.serviceIds, service.id] }
    );
  };

  const createOrPickService = async (rawName: string) => {
    const name = normalizeServiceName(rawName);
    if (!name) return;

    const existing = services.find(
      (s) => s.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      await addServiceToForm(existing);
      setServiceInput('');
      return;
    }

    const now = new Date().toISOString();
    const newService: ReferralService = {
      id: generateId(),
      name,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await addReferralService(newService);
      setServices((prev) => [...prev, newService]);
      setFormData((prev) => ({
        ...prev,
        serviceIds: [...prev.serviceIds, newService.id],
      }));
      setServiceInput('');
    } catch (error) {
      console.error('Error creating referral service:', error);
    }
  };

  const handleServiceInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (serviceInput.trim()) {
        void createOrPickService(serviceInput);
      }
    } else if (e.key === 'Backspace' && !serviceInput && formData.serviceIds.length > 0) {
      e.preventDefault();
      const last = formData.serviceIds[formData.serviceIds.length - 1];
      removeServiceFromForm(last);
    }
  };

  const serviceSuggestions = useMemo(() => {
    const q = serviceInput.trim().toLowerCase();
    const selected = new Set(formData.serviceIds);
    return services
      .filter((s) => !selected.has(s.id))
      .filter((s) => (q ? s.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [services, serviceInput, formData.serviceIds]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    // If there's unsubmitted text in the service input, treat it as a new tag.
    if (serviceInput.trim()) {
      await createOrPickService(serviceInput);
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const record: ReferralAssociate = {
        id: editingAssociate?.id || generateId(),
        name: formData.name.trim(),
        company: formData.company.trim() || undefined,
        address: formData.address.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        email: formData.email.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        serviceIds: formData.serviceIds,
        createdAt: editingAssociate?.createdAt || now,
        updatedAt: now,
      };

      if (editingAssociate) {
        await updateReferralAssociate(record);
      } else {
        await addReferralAssociate(record);
      }

      await loadData();
      closeForm();
    } catch (error) {
      console.error('Error saving referral associate:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (associate: ReferralAssociate) => {
    if (!confirm(`Delete referral associate "${associate.name}"? This cannot be undone.`)) return;
    try {
      await deleteReferralAssociate(associate.id);
      await loadData();
    } catch (error) {
      console.error('Error deleting referral associate:', error);
    }
  };

  const servicesWithCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of associates) {
      for (const id of a.serviceIds || []) {
        counts.set(id, (counts.get(id) || 0) + 1);
      }
    }
    return services
      .map((s) => ({ ...s, count: counts.get(s.id) || 0 }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [services, associates]);

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-4 sm:mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Referral Associates</h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1">
            Contacts who refer work — tagged by services they provide.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddForm}
          className="flex items-center gap-2 px-4 py-2 bg-gf-lime text-white rounded-lg font-medium hover:bg-gf-dark-green transition-colors text-sm"
        >
          <Plus size={16} />
          Add Associate
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
          <p className="text-xs text-slate-500">Associates</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{filteredAssociates.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
          <p className="text-xs text-slate-500">Services</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{services.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 col-span-2 lg:col-span-1">
          <p className="text-xs text-slate-500">Total Contacts</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{associates.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 md:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, company, address, or service..."
            className="w-full sm:max-w-md px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
          />
          {servicesWithCounts.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs sm:text-sm text-slate-600 font-medium">Filter by service:</label>
              {servicesWithCounts.map((s) => {
                const active = activeServiceFilters.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleServiceFilter(s.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      active
                        ? 'bg-gf-dark-green text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {s.name}
                    <span className={`ml-1 ${active ? 'text-white/80' : 'text-slate-400'}`}>
                      ({s.count})
                    </span>
                  </button>
                );
              })}
              {activeServiceFilters.size > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveServiceFilters(new Set())}
                  className="text-xs text-slate-500 hover:text-slate-700 underline"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Associate list */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mb-4 sm:mb-6">
        {loading ? (
          <div className="p-8 text-center text-slate-600">Loading referral associates...</div>
        ) : filteredAssociates.length === 0 ? (
          <div className="p-8 text-center text-slate-600">
            {associates.length === 0
              ? 'No referral associates yet. Click "Add Associate" to create one.'
              : 'No associates match the current filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 lg:px-6 py-3 text-left text-sm font-semibold text-slate-700">
                    Associate
                  </th>
                  <th className="px-4 lg:px-6 py-3 text-left text-sm font-semibold text-slate-700">
                    Company
                  </th>
                  <th className="px-4 lg:px-6 py-3 text-left text-sm font-semibold text-slate-700">
                    Services
                  </th>
                  <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAssociates.map((associate) => (
                  <tr
                    key={associate.id}
                    className="border-b border-slate-200 hover:bg-slate-50"
                  >
                    <td className="px-4 lg:px-6 py-4 text-sm">
                      <div className="font-medium text-slate-900">{associate.name}</div>
                      {associate.address && (
                        <div className="text-xs text-slate-500">{associate.address}</div>
                      )}
                      {(associate.phone || associate.email) && (
                        <div className="text-xs text-slate-400">
                          {[associate.phone, associate.email].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 lg:px-6 py-4 text-sm text-slate-700">
                      {associate.company || '-'}
                    </td>
                    <td className="px-4 lg:px-6 py-4 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {(associate.serviceIds || []).length === 0 && (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                        {(associate.serviceIds || []).map((id) => {
                          const svc = servicesById.get(id);
                          if (!svc) return null;
                          return (
                            <span
                              key={id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-gf-dark-green text-xs font-medium border border-green-100"
                            >
                              <Tag size={10} />
                              {svc.name}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 lg:px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEditForm(associate)}
                          className="p-1.5 rounded text-slate-400 hover:text-gf-dark-green hover:bg-green-50 transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(associate)}
                          className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingAssociate ? 'Edit Referral Associate' : 'Add Referral Associate'}
              </h2>
              <button
                type="button"
                onClick={closeForm}
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
                  placeholder="e.g., Jane Doe"
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="e.g., Acme Realty"
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
                    placeholder="(555) 123-4567"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="jane@example.com"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  />
                </div>
              </div>

              {/* Services tags */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Services
                </label>
                <div className="min-h-[42px] w-full px-2 py-1.5 border border-slate-300 rounded-lg flex flex-wrap gap-1.5 items-center focus-within:ring-2 focus-within:ring-gf-lime focus-within:border-transparent">
                  {formData.serviceIds.map((id) => {
                    const svc = servicesById.get(id);
                    if (!svc) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-gf-dark-green text-xs font-medium border border-green-100"
                      >
                        <Tag size={10} />
                        {svc.name}
                        <button
                          type="button"
                          onClick={() => removeServiceFromForm(id)}
                          className="ml-0.5 text-gf-dark-green hover:text-red-600"
                          aria-label={`Remove ${svc.name}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    );
                  })}
                  <input
                    ref={serviceInputRef}
                    type="text"
                    value={serviceInput}
                    onChange={(e) => setServiceInput(e.target.value)}
                    onKeyDown={handleServiceInputKeyDown}
                    placeholder={
                      formData.serviceIds.length === 0
                        ? 'Type a service and press Enter...'
                        : 'Add another...'
                    }
                    className="flex-1 min-w-[140px] px-1 py-1 text-sm outline-none bg-transparent"
                  />
                </div>
                {serviceSuggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {serviceSuggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => addServiceToForm(s)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 transition-colors"
                      >
                        <Plus size={10} />
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  Press Enter or comma to add. Existing services are suggested; new ones are created automatically.
                </p>
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
                  onClick={closeForm}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !formData.name.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-gf-lime rounded-lg hover:bg-gf-dark-green transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : editingAssociate ? 'Save Changes' : 'Add Associate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
