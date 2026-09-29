import { Check, Copy } from 'lucide-react';
import { JobStatus } from '../../types';
import AddressFieldsEditor from '../../components/AddressFieldsEditor';
import type { JobFormModel } from './useJobForm';

export default function CustomerStep({ form }: { form: JobFormModel }) {
  const {
    showTagDropdown,
    setShowTagDropdown,
    addressFields,
    setAddressFields,
    addressCopied,
    showCustomerDropdown,
    setShowCustomerDropdown,
    currentStep,
    formData,
    setFormData,
    tagSuggestions,
    customerSuggestions,
    handleStatusChange,
    handleTagInputChange,
    handleCustomerNameInputChange,
    handleCustomerSelect,
    handleAddressBlur,
    handleCopyAddress,
    matchedCustomerAddress,
    addressMatchesCustomer,
    handleSameAsCustomer,
    addressNote,
    handleTagSelect,
  } = form;

  return (
    <div className={`${currentStep === 0 ? 'block' : 'hidden'} md:block`}>
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
          <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Job Site Address</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g., 123 Main St, City, State 12345"
              value={formData.customerAddress}
              onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
              // Parsed on blur rather than per keystroke: the crew pastes whole
              // addresses, and half-typed text would only flicker.
              onBlur={() => handleAddressBlur(formData.customerAddress)}
              className="flex-1 min-w-0 px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
            />
            <button
              type="button"
              onClick={handleCopyAddress}
              disabled={!formData.customerAddress.trim()}
              className="shrink-0 px-3 py-2 border border-slate-300 rounded-lg text-slate-500 transition-colors hover:text-gf-dark-green hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-500"
              title={addressCopied ? 'Address copied' : 'Copy address'}
              aria-label="Copy address"
            >
              {addressCopied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
            </button>
          </div>
          <AddressFieldsEditor
            fields={addressFields}
            onChange={setAddressFields}
            note={addressNote}
          />
          {matchedCustomerAddress && (
            <label className="mt-1 flex cursor-pointer items-start gap-2 px-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={addressMatchesCustomer}
                onChange={(event) => handleSameAsCustomer(event.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-gf-lime focus:ring-gf-lime"
              />
              <span>
                Same as customer address
                {!addressMatchesCustomer && (
                  <span className="text-slate-400"> · customer is at {matchedCustomerAddress}</span>
                )}
              </span>
            </label>
          )}
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
    </div>
    </div>
  );
}
