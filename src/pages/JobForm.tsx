import { ArrowLeft, Save, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, X, Plus, Trash2, Link, Shuffle, Check, Copy, FileText, Package } from 'lucide-react';
import { BaseColor, JobStatus, CoatingRemovalType } from '../types';
import InstallDayScheduleComponent from '../components/InstallDaySchedule';
import ActualDayScheduleComponent from '../components/ActualDaySchedule';
import AddressFieldsEditor from '../components/AddressFieldsEditor';
import SaveButton from '../components/SaveButton';
import SnapshotChangeBanner from '../components/SnapshotChangeBanner';
import { localToday } from '../lib/dateUtils';
import { useJobForm, type JobFormProps } from './jobForm/useJobForm';

export default function JobForm(props: JobFormProps) {
  const form = useJobForm(props);
  const {
    systems,
    pricing,
    activeLaborers,
    installSchedule,
    setInstallSchedule,
    loading,
    saving,
    jobFlash,
    reminderFlash,
    calculation,
    usedPricing,
    existingJob,
    chipBlendInput,
    showBlendDropdown,
    setShowBlendDropdown,
    tintInventory,
    showTintColorDropdown,
    setShowTintColorDropdown,
    showTagDropdown,
    setShowTagDropdown,
    addressFields,
    setAddressFields,
    addressCopied,
    showCustomerDropdown,
    setShowCustomerDropdown,
    linkedLead,
    jobProducts,
    setJobProducts,
    allProducts,
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
    showInventoryUpdateModal,
    inventoryReviewRows,
    inventoryUpdateError,
    applyingInventoryUpdate,
    reminders,
    showReminderModal,
    editingReminderId,
    savingReminder,
    reminderForm,
    setReminderForm,
    showNextReminderPrompt,
    setShowNextReminderPrompt,
    nextReminderForm,
    setNextReminderForm,
    followUps,
    showFollowUpForm,
    setShowFollowUpForm,
    commTemplates,
    copiedReminderId,
    setCopiedReminderId,
    followUpForm,
    setFollowUpForm,
    evaluation,
    setEvaluation,
    evalInputs,
    setEvalInputs,
    snapshotChanges,
    showSnapshotBanner,
    groupJobs,
    ungroupedJobs,
    showGroupModal,
    setShowGroupModal,
    groupModalType,
    creatingGroupJob,
    bundleAggregate,
    modalView,
    setModalView,
    existingJobSearch,
    setExistingJobSearch,
    formData,
    setFormData,
    productsTotalPrice,
    productsTotalCost,
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
    getSelectedLaborers,
    recalcActualTotal,
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
    matchedCustomerAddress,
    addressMatchesCustomer,
    handleSameAsCustomer,
    addressNote,
    handleTagSelect,
    openAddReminder,
    openEditReminder,
    closeReminderModal,
    handleSaveReminder,
    handleDeleteReminder,
    handleCompleteReminder,
    handleCreateNextReminder,
    handleLogFollowUp,
    handleDeleteFollowUp,
    handleOpenGroupModal,
    handleCreateGroupEstimate,
    handleAddExistingJobToGroup,
    handleRemoveFromGroup,
    handleUpdateToCurrentValues,
    handleKeepOriginalValues,
    updateInventoryReviewNewValue,
    handleCancelInventoryUpdate,
    handleApplyInventoryUpdate,
    handleSubmit,
    formatCurrency,
    formatInventoryValue,
    getInventoryStatus,
    noLaborersSelected,
    relevantActuals,
    jobId,
    onBack,
    onEditJob,
    onViewJobSheet,
  } = form;

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  const selectedLaborers = getSelectedLaborers();

  const marginPct = calculation && parseFloat(formData.totalPrice) > 0
    ? ((parseFloat(formData.totalPrice) - calculation.totalCosts) / parseFloat(formData.totalPrice)) * 100
    : 0;
  const perSqft = calculation && parseFloat(formData.floorFootage) > 0
    ? parseFloat(formData.totalPrice) / parseFloat(formData.floorFootage)
    : 0;

  return (
    <div className="md:p-4 lg:p-8 max-w-6xl mx-auto">
      {/* Mobile form header */}
      <div className="md:hidden sticky top-0 z-20 bg-[#0a0a0a] text-white px-3.5 py-3 flex items-center gap-2.5">
        <button onClick={onBack}
          className="w-[38px] h-[38px] rounded-[10px] bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center">
          <ChevronLeft size={20} />
        </button>
        <span className="flex-1 font-heading font-extrabold text-[17px]">{jobId ? 'Edit Estimate' : 'New Estimate'}</span>
        {jobId && !existingJob?.groupId && (
          <>
            <button type="button" onClick={() => handleOpenGroupModal('alternative')}
              className="p-2 rounded-[10px] bg-[#1c1c1c] border border-[#2a2a2a]" title="Add Alternative">
              <Shuffle size={16} />
            </button>
            <button type="button" onClick={() => handleOpenGroupModal('bundled')}
              className="p-2 rounded-[10px] bg-[#1c1c1c] border border-[#2a2a2a]" title="Add Bundle">
              <Link size={16} />
            </button>
          </>
        )}
        {jobId && onViewJobSheet && (
          <button type="button" onClick={() => onViewJobSheet(jobId)}
            className="p-2 rounded-[10px] bg-[#1c1c1c] border border-[#2a2a2a]">
            <FileText size={16} />
          </button>
        )}
      </div>

      {/* Mobile live total bar */}
      <div className="md:hidden sticky top-[62px] z-[18] bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white px-[18px] py-[13px] flex items-center justify-between shadow-lg">
        <div>
          <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
            {calculation && formData.totalPrice === calculation.suggestedTotal.toFixed(2) && (
              <span className="text-gf-lime">Suggested ·</span>
            )}
            Total Price
          </div>
          <div className="num text-[30px] font-black tracking-tight leading-none mt-0.5">
            ${parseFloat(formData.totalPrice || '0').toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="flex items-center gap-[18px]">
          <div className="text-right">
            <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wide">Margin</div>
            <div className={`num text-[20px] font-extrabold ${marginPct >= 35 ? 'text-[#4ade80]' : marginPct >= 22 ? 'text-amber-400' : 'text-red-400'}`}>
              {marginPct.toFixed(0)}%
            </div>
          </div>
          {perSqft > 0 && (
            <div className="text-right">
              <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wide">$/ft²</div>
              <div className="num text-[20px] font-extrabold">${perSqft.toFixed(2)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile stepper (Details tab only) */}
      {activeTab === 'details' && (
        <div className="md:hidden sticky top-[130px] z-[15] bg-white border-b border-slate-200 py-3 px-2.5 flex justify-between overflow-x-auto scrollbar-hide gap-0.5">
          {STEP_LABELS.map((label, i) => (
            <button key={i} type="button" onClick={() => setCurrentStep(i)}
              className="flex flex-col items-center gap-[5px] flex-1 min-w-[60px] bg-transparent border-none cursor-pointer">
              <span className={`num w-7 h-7 rounded-full border-[1.5px] flex items-center justify-center text-[12.5px] font-extrabold ${
                currentStep === i
                  ? 'bg-gf-lime border-gf-lime text-white'
                  : i < currentStep
                    ? 'border-gf-lime text-gf-lime'
                    : 'border-slate-300 text-slate-400'
              }`}>
                {i < currentStep ? '✓' : i + 1}
              </span>
              <span className={`text-[11px] font-semibold ${
                currentStep === i ? 'text-slate-900' : 'text-slate-400'
              }`}>{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Desktop back button row */}
      <div className="hidden md:flex items-center justify-between mb-4 sm:mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
          <span className="font-medium text-sm sm:text-base">Back</span>
        </button>
        {jobId && onViewJobSheet && (
          <button
            type="button"
            onClick={() => onViewJobSheet(jobId)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gf-lime text-white rounded-lg font-medium hover:bg-gf-dark-green transition-colors text-sm"
          >
            <FileText size={16} />
            <span>Job Summary</span>
          </button>
        )}
      </div>

      <div className="bg-white md:rounded-lg md:shadow-sm md:border md:border-slate-200 p-4 sm:p-6 md:p-8">
        <div className="hidden md:flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{jobId ? 'Edit Job' : 'Create New Job'}</h2>
          <div className="flex items-center gap-2">
            {jobId && !existingJob?.groupId && (
              <>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-100 text-slate-800 rounded-lg font-semibold hover:bg-slate-200 active:bg-slate-300 transition-colors text-sm sm:text-base"
                  onClick={() => handleOpenGroupModal('alternative')}
                >
                  <Shuffle size={14} />
                  <span className="hidden sm:inline">Alternatives</span>
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-100 text-slate-800 rounded-lg font-semibold hover:bg-slate-200 active:bg-slate-300 transition-colors text-sm sm:text-base"
                  onClick={() => handleOpenGroupModal('bundled')}
                >
                  <Link size={14} />
                  <span className="hidden sm:inline">Bundle</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={openAddReminder}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-100 text-slate-800 rounded-lg font-semibold hover:bg-slate-200 active:bg-slate-300 transition-colors text-sm sm:text-base"
            >
              <Plus size={16} className="sm:w-[18px] sm:h-[18px]" />
              Add Reminder
            </button>
            <SaveButton
              type="submit"
              form="job-form"
              saving={saving}
              saved={jobFlash.saved}
              label={jobId ? 'Update Job' : 'Create Job'}
              icon={<Save size={16} className="sm:w-[18px] sm:h-[18px]" />}
              className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg font-semibold disabled:bg-slate-400 text-sm sm:text-base"
            />
          </div>
        </div>

        {/* Group navigation bar */}
        {existingJob?.groupId && groupJobs.length > 0 && (
          <div className={`mb-4 rounded-lg border p-3 ${existingJob.groupType === 'bundled' ? 'bg-blue-50 border-blue-200' : 'bg-purple-50 border-purple-200'}`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                {existingJob.groupType === 'bundled' ? (
                  <Link size={14} className="text-blue-600 flex-shrink-0" />
                ) : (
                  <Shuffle size={14} className="text-purple-600 flex-shrink-0" />
                )}
                <span className={`text-xs font-bold uppercase tracking-wide ${existingJob.groupType === 'bundled' ? 'text-blue-700' : 'text-purple-700'}`}>
                  {existingJob.groupType === 'bundled' ? 'Bundle' : 'Alternatives'}
                </span>
                <span className="text-xs text-slate-500">{existingJob.customerName || 'Unnamed Customer'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleOpenGroupModal(existingJob.groupType || 'alternative')}
                  className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${existingJob.groupType === 'bundled' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
                >
                  <Plus size={11} />
                  {existingJob.groupType === 'bundled' ? 'Add Part' : 'Add Alternative'}
                </button>
                <button
                  type="button"
                  onClick={handleRemoveFromGroup}
                  title="Remove this estimate from the group"
                  className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md transition-colors bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600"
                >
                  <X size={11} />
                  Remove
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {groupJobs.map((gj) => (
                <button
                  key={gj.id}
                  type="button"
                  onClick={() => gj.id !== jobId && onEditJob && onEditJob(gj.id)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    gj.id === jobId
                      ? existingJob.groupType === 'bundled'
                        ? 'bg-blue-600 text-white'
                        : 'bg-purple-600 text-white'
                      : 'bg-white border border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-800 cursor-pointer'
                  }`}
                >
                  {gj.name}
                </button>
              ))}
            </div>
            {existingJob.groupType === 'bundled' && bundleAggregate && (
              <div className="mt-2 pt-2 border-t border-blue-200 flex items-center gap-4 text-xs text-blue-800 flex-wrap">
                <span>Combined Total: <strong>{formatCurrency(bundleAggregate.totalPrice)}</strong></span>
                <span>Total Cost: <strong>{formatCurrency(bundleAggregate.totalCosts)}</strong></span>
                <span>Combined Margin: <strong className={bundleAggregate.totalPrice > 0 ? ((bundleAggregate.totalPrice - bundleAggregate.totalCosts) / bundleAggregate.totalPrice * 100) >= 30 ? 'text-green-700' : 'text-orange-600' : ''}>
                  {bundleAggregate.totalPrice > 0 ? (((bundleAggregate.totalPrice - bundleAggregate.totalCosts) / bundleAggregate.totalPrice) * 100).toFixed(0) : 0}%
                </strong></span>
              </div>
            )}
          </div>
        )}

        {/* Snapshot Change Banner */}
        {showSnapshotBanner && snapshotChanges && (
          <SnapshotChangeBanner
            changes={snapshotChanges}
            onUpdate={handleUpdateToCurrentValues}
            onDismiss={handleKeepOriginalValues}
          />
        )}

        <form id="job-form" onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 pb-20 md:pb-0">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'details'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Details
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reminders')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'reminders'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Reminders
              {reminders.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-5 h-5 px-1 text-xs font-semibold rounded-full bg-gf-lime text-white">
                  {reminders.length}
                </span>
              )}
            </button>
            {formData.status === 'Won' && jobId && (
              <button
                type="button"
                onClick={() => setActiveTab('actuals')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'actuals'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Actuals
              </button>
            )}
          </div>

          {activeTab === 'details' && (
            <>
          {/* Step 0: Customer */}
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

          {/* Step 2: System (part 1) */}
          <div className={`${currentStep === 2 ? 'block' : 'hidden'} md:block`}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Chip System *</label>
              <select
                value={formData.system}
                onChange={(e) => handleSystemChange(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent bg-white"
              >
                <option value="">Select a system...</option>
                {systems.map((sys) => (
                  <option key={sys.id} value={sys.id}>
                    {sys.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          </div>

          {/* Step 1: Measure (part 1) */}
          <div className={`${currentStep === 1 ? 'block' : 'hidden'} md:block`}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Floor Sq Footage</label>
              <input
                type="number"
                placeholder="0"
                value={formData.floorFootage}
                onChange={(e) => handleFloorFootageChange(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Vertical Sq Footage</label>
              <input
                type="number"
                placeholder="0"
                value={formData.verticalFootage}
                onChange={(e) => handleVerticalFootageChange(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
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
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Install Date</label>
              <input
                type="date"
                value={formData.installDate}
                onChange={(e) => setFormData({ ...formData, installDate: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
              />
            </div>
          </div>
          </div>

          {/* Step 2: System (part 2) */}
          <div className={`${currentStep === 2 ? 'block' : 'hidden'} md:block`}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="relative">
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Chip Blend</label>
              <input
                type="text"
                placeholder="Type or select a blend..."
                value={chipBlendInput}
                onChange={(e) => handleChipBlendInputChange(e.target.value)}
                onFocus={() => setShowBlendDropdown(true)}
                onBlur={() => setTimeout(() => setShowBlendDropdown(false), 200)}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
              />
              {showBlendDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {applicableChipBlends
                    .filter((b) => b.name.toLowerCase().includes(chipBlendInput.toLowerCase()))
                    .map((blend) => (
                      <button
                        key={blend.id}
                        type="button"
                        onClick={() => handleChipBlendSelect(blend)}
                        className="w-full px-3 sm:px-4 py-2 text-left hover:bg-slate-100 text-xs sm:text-sm"
                      >
                        {blend.name}
                      </button>
                    ))}
                  {applicableChipBlends.filter((b) => b.name.toLowerCase().includes(chipBlendInput.toLowerCase())).length === 0 && (
                    <p className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-500 italic">
                      No applicable chip blends for this system.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Base Coat Color</label>
              <select
                value={formData.baseColor}
                onChange={(e) => setFormData({ ...formData, baseColor: e.target.value as BaseColor })}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
              >
                <option value="">Select a base coat color...</option>
                {availableBaseCoatColors.map((color) => (
                  <option key={color.id} value={color.name}>
                    {color.name}
                  </option>
                ))}
              </select>
              {selectedBlend && selectedBlend.baseCoatColorIds && selectedBlend.baseCoatColorIds.length > 0 && availableBaseCoatColors.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">This blend has no active base coat colors assigned.</p>
              )}
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
                    className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">No</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="includeBasecoatTint"
                    checked={formData.includeBasecoatTint}
                    onChange={() => setFormData({ ...formData, includeBasecoatTint: true })}
                    className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
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
                    className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">No</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="includeTopcoatTint"
                    checked={formData.includeTopcoatTint}
                    onChange={() => setFormData({ ...formData, includeTopcoatTint: true })}
                    className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">Yes</span>
                </label>
              </div>
            </div>

            {(formData.includeBasecoatTint || formData.includeTopcoatTint) && (
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Tint Color</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.tintColor}
                    onChange={(e) => {
                      setFormData({ ...formData, tintColor: e.target.value });
                      setShowTintColorDropdown(true);
                    }}
                    onFocus={() => setShowTintColorDropdown(true)}
                    onBlur={() => setTimeout(() => setShowTintColorDropdown(false), 200)}
                    placeholder="Select or type a new color..."
                    className="w-full px-3 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
                  />
                  {showTintColorDropdown && tintInventory.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {tintInventory
                        .filter((t) => t.color.toLowerCase().includes(formData.tintColor.toLowerCase()))
                        .map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, tintColor: t.color });
                              setShowTintColorDropdown(false);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-slate-100 text-sm"
                          >
                            {t.color}
                            <span className="ml-2 text-slate-400 text-xs">{t.ounces} oz on hand</span>
                          </button>
                        ))}
                      {formData.tintColor && !tintInventory.some((t) => t.color.toLowerCase() === formData.tintColor.toLowerCase()) && (
                        <div className="px-3 py-2 text-sm text-slate-500 border-t border-slate-200">
                          New color — add to inventory to track usage
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Material Allocation (collapsible) */}
          {resolvedMaterials && (
            <div className="rounded-lg border border-slate-200 mt-4">
              <button
                type="button"
                onClick={() => setShowAllocationSection(!showAllocationSection)}
                className={`w-full flex items-center justify-between px-3 sm:px-4 py-3 text-left bg-gf-lime/15 hover:bg-gf-lime/25 transition-colors ${showAllocationSection ? 'rounded-t-lg' : 'rounded-lg'}`}
              >
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-semibold text-gf-dark-green uppercase tracking-wide">Material Allocation</h4>
                  {allocationOverrideEnabled && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                      Override
                    </span>
                  )}
                </div>
                {showAllocationSection ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
              </button>

              {showAllocationSection && (
                <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer mt-3 mb-3">
                    <input
                      type="checkbox"
                      checked={allocationOverrideEnabled}
                      onChange={(e) => {
                        if (e.target.checked) {
                          enableAllocationOverride();
                        } else {
                          setAllocationOverrideEnabled(false);
                          setAllocationError('');
                        }
                      }}
                      className="w-4 h-4 text-gf-dark-green border-slate-300 rounded focus:ring-gf-lime"
                    />
                    <span className="text-xs sm:text-sm font-semibold text-slate-900">Override default allocation</span>
                  </label>

                  {allocationOverrideEnabled && (
                    <div className="space-y-4 mb-4">
                      {/* Topcoat flavors editor */}
                      {calculation && calculation.topGallons > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Topcoat Flavors</p>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${Math.abs(topAllocationTotalPct - 100) <= 0.1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {topAllocationTotalPct.toFixed(1).replace(/\.0$/, '')}%
                            </span>
                          </div>
                          {topAllocation.map((row, idx) => (
                            <div key={idx} className="flex items-center gap-2 mb-2">
                              <select
                                value={row.variant}
                                onChange={(e) => setTopAllocation(topAllocation.map((r, i) => (i === idx ? { ...r, variant: e.target.value } : r)))}
                                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                              >
                                <option value="">Variant...</option>
                                {allocationVariantOptions(['Original', 'Slow Cure'], row.variant).map((v) => (
                                  <option key={v} value={v}>{v}</option>
                                ))}
                              </select>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  value={row.sharePct}
                                  onChange={(e) => setTopAllocation(topAllocation.map((r, i) => (i === idx ? { ...r, sharePct: parseFloat(e.target.value) || 0 } : r)))}
                                  className="w-20 px-2 py-2 text-sm text-right border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                                />
                                <span className="text-xs text-slate-500">%</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setTopAllocation(topAllocation.filter((_, i) => i !== idx))}
                                className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => setTopAllocation([...topAllocation, { variant: '', sharePct: 0 }])}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-gf-dark-green hover:bg-slate-50 rounded transition-colors"
                          >
                            <Plus size={12} />
                            Add flavor
                          </button>
                        </div>
                      )}

                      {/* Base B components editor */}
                      {calculation && calculation.baseGallons > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Base B Components</p>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${Math.abs(baseAllocationTotalPct - 100) <= 0.1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {baseAllocationTotalPct.toFixed(1).replace(/\.0$/, '')}%
                            </span>
                          </div>

                          {formData.baseColor === 'Mocha' && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              <button
                                type="button"
                                onClick={() => applyMochaPreset([
                                  { variant: 'Normal', color: 'Grey', sharePct: 50, tintColor: '' },
                                  { variant: 'Normal', color: 'Tan', sharePct: 50, tintColor: '' },
                                ])}
                                className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 text-slate-700 transition-colors"
                              >
                                Grey B + Tan B
                              </button>
                              <button
                                type="button"
                                onClick={() => applyMochaPreset([
                                  { variant: 'Normal', color: 'Grey', sharePct: 50, tintColor: '' },
                                  { variant: 'Normal', color: 'Clear', sharePct: 50, tintColor: 'Tan' },
                                ])}
                                className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 text-slate-700 transition-colors"
                              >
                                Grey B + Clear B (Tan tint)
                              </button>
                              <button
                                type="button"
                                onClick={() => applyMochaPreset([
                                  { variant: 'Normal', color: 'Tan', sharePct: 50, tintColor: '' },
                                  { variant: 'Normal', color: 'Clear', sharePct: 50, tintColor: 'Grey' },
                                ])}
                                className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 text-slate-700 transition-colors"
                              >
                                Tan B + Clear B (Grey tint)
                              </button>
                              <button
                                type="button"
                                onClick={() => applyMochaPreset([
                                  { variant: 'Normal', color: 'Clear', sharePct: 50, tintColor: 'Grey' },
                                  { variant: 'Normal', color: 'Clear', sharePct: 50, tintColor: 'Tan' },
                                ])}
                                className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 text-slate-700 transition-colors"
                              >
                                All Clear (Grey + Tan tint)
                              </button>
                            </div>
                          )}

                          {baseAllocation.map((row, idx) => (
                            <div key={idx} className="flex items-center gap-2 mb-2">
                              <select
                                value={row.variant}
                                onChange={(e) => setBaseAllocation(baseAllocation.map((r, i) => (i === idx ? { ...r, variant: e.target.value } : r)))}
                                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                              >
                                <option value="">Variant...</option>
                                {allocationVariantOptions(['Normal', 'Extended'], row.variant).map((v) => (
                                  <option key={v} value={v}>{v}</option>
                                ))}
                              </select>
                              <select
                                value={row.color}
                                onChange={(e) => setBaseAllocation(baseAllocation.map((r, i) => (i === idx ? { ...r, color: e.target.value, tintColor: e.target.value === 'Clear' ? r.tintColor : '' } : r)))}
                                className="w-24 px-2 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                              >
                                <option value="">Color...</option>
                                <option value="Grey">Grey</option>
                                <option value="Tan">Tan</option>
                                <option value="Clear">Clear</option>
                              </select>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  value={row.sharePct}
                                  onChange={(e) => setBaseAllocation(baseAllocation.map((r, i) => (i === idx ? { ...r, sharePct: parseFloat(e.target.value) || 0 } : r)))}
                                  className="w-20 px-2 py-2 text-sm text-right border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                                />
                                <span className="text-xs text-slate-500">%</span>
                              </div>
                              <select
                                value={row.tintColor}
                                disabled={row.color !== 'Clear'}
                                onChange={(e) => setBaseAllocation(baseAllocation.map((r, i) => (i === idx ? { ...r, tintColor: e.target.value } : r)))}
                                className="w-28 px-2 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent disabled:bg-slate-100 disabled:text-slate-400"
                              >
                                <option value="">No tint</option>
                                {allocationTintColorOptions(row.tintColor).map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => setBaseAllocation(baseAllocation.filter((_, i) => i !== idx))}
                                className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => setBaseAllocation([...baseAllocation, { variant: 'Normal', color: '', sharePct: 0, tintColor: '' }])}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-gf-dark-green hover:bg-slate-50 rounded transition-colors"
                          >
                            <Plus size={12} />
                            Add component
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={resetAllocationToDefaults}
                        className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 text-slate-600 transition-colors"
                      >
                        Reset to defaults
                      </button>
                    </div>
                  )}

                  {allocationError && (
                    <p className="text-xs text-red-600 mb-2">{allocationError}</p>
                  )}

                  {/* Resolved allocation (read-only) */}
                  <div>
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Resolved Materials</p>
                    <table className="w-full text-sm">
                      <tbody>
                        {resolvedMaterials.coating.map((line) => (
                          <tr key={line.key} className="border-b border-slate-100">
                            <td className="py-1.5 text-slate-900">{line.label}</td>
                            <td className="py-1.5 text-right text-slate-900 font-medium">{line.gallons.toFixed(2)} gal</td>
                          </tr>
                        ))}
                        {resolvedMaterials.tint.map((line) => (
                          <tr key={line.key} className="border-b border-slate-100">
                            <td className="py-1.5 text-slate-900">{line.label}</td>
                            <td className="py-1.5 text-right text-slate-900 font-medium">{line.oz.toFixed(1)} oz</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {resolvedMaterials.warnings.map((warning, idx) => (
                      <p key={idx} className="text-xs text-amber-600 mt-1">{warning}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <h3 className="text-sm sm:text-base font-semibold text-slate-900 mt-4 mb-3 border-b border-slate-200 pb-1">Add-ons</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Anti-Slip</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="antiSlip"
                    checked={!formData.antiSlip}
                    onChange={() => setFormData({ ...formData, antiSlip: false })}
                    className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">No</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="antiSlip"
                    checked={formData.antiSlip}
                    onChange={() => setFormData({ ...formData, antiSlip: true })}
                    className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
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
                    className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">No</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="abrasionResistance"
                    checked={formData.abrasionResistance}
                    onChange={() => setFormData({ ...formData, abrasionResistance: true })}
                    className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
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
                    className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">No</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="cyclo1Topcoat"
                    checked={formData.cyclo1Topcoat}
                    onChange={() => setFormData({ ...formData, cyclo1Topcoat: true })}
                    className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">Yes</span>
                </label>
              </div>
            </div>

            {formData.cyclo1Topcoat && (
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Additional Cyclo1 Coats (Job)</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="cyclo1Coats"
                      checked={formData.cyclo1Coats === '0'}
                      onChange={() => setFormData({ ...formData, cyclo1Coats: '0' })}
                      className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
                    />
                    <span className="text-xs sm:text-sm text-slate-700">0</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="cyclo1Coats"
                      checked={formData.cyclo1Coats === '1'}
                      onChange={() => setFormData({ ...formData, cyclo1Coats: '1' })}
                      className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
                    />
                    <span className="text-xs sm:text-sm text-slate-700">1</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="cyclo1Coats"
                      checked={formData.cyclo1Coats === '2'}
                      onChange={() => setFormData({ ...formData, cyclo1Coats: '2' })}
                      className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
                    />
                    <span className="text-xs sm:text-sm text-slate-700">2</span>
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
                      className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
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
                    className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">No</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="moistureMitigation"
                    checked={formData.moistureMitigation}
                    onChange={() => setFormData({ ...formData, moistureMitigation: true })}
                    className="w-4 h-4 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">Yes</span>
                </label>
              </div>
            </div>

          </div>
          </div>

          {/* Step 1: Measure (part 2 - Evaluation + Install Days + Schedule) */}
          <div className={`${currentStep === 1 ? 'block' : 'hidden'} md:block`}>

          {/* Evaluation Section */}
          <div className="mt-4">
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-3 border-b border-slate-200 pb-1">Evaluation</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(['moisture', 'ph', 'hardness', 'cacl'] as const).map((field) => {
                const labels: Record<string, string> = { moisture: 'Moisture', ph: 'pH', hardness: 'Hardness', cacl: 'CaCl' };
                return (
                  <div key={field}>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">{labels[field]}</label>
                    <div className="flex gap-1.5 mb-1.5">
                      <input
                        type="number"
                        step="any"
                        placeholder="Value"
                        value={evalInputs[field]}
                        onChange={(e) => setEvalInputs({ ...evalInputs, [field]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = parseFloat(evalInputs[field]);
                            if (!isNaN(val)) {
                              setEvaluation({ ...evaluation, [field]: [...evaluation[field], val] });
                              setEvalInputs({ ...evalInputs, [field]: '' });
                            }
                          }
                        }}
                        className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const val = parseFloat(evalInputs[field]);
                          if (!isNaN(val)) {
                            setEvaluation({ ...evaluation, [field]: [...evaluation[field], val] });
                            setEvalInputs({ ...evalInputs, [field]: '' });
                          }
                        }}
                        className="px-2 py-1.5 bg-gf-lime text-white rounded-lg hover:bg-gf-dark-green text-sm font-medium"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    {evaluation[field].length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {evaluation[field].map((val, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs">
                            {val}
                            <button
                              type="button"
                              onClick={() => setEvaluation({ ...evaluation, [field]: evaluation[field].filter((_, i) => i !== idx) })}
                              className="text-slate-400 hover:text-red-500"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Install Days - below evaluation */}
          <div className="mt-4">
            <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Install Days</label>
            <input
              type="number"
              placeholder="1"
              min="1"
              value={formData.installDays}
              onChange={(e) => setFormData({ ...formData, installDays: e.target.value })}
              className="w-full sm:w-48 px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
            />
          </div>

          {/* Daily Schedule Section */}
          <div className="border border-slate-200 rounded-lg p-3 sm:p-4 bg-slate-50">
            <InstallDayScheduleComponent
              installDays={parseInt(formData.installDays) || 1}
              schedule={installSchedule}
              availableLaborers={(() => {
                return existingJob
                  ? [...activeLaborers, ...existingJob.laborersSnapshot.filter(
                      (sl) => !activeLaborers.some((al) => al.id === sl.id)
                    )]
                  : activeLaborers;
              })()}
              onChange={setInstallSchedule}
              defaultDayHours={pricing.defaultDayHours ?? 8}
            />
          </div>
          </div>

          {/* Step 3: Price */}
          <div className={`${currentStep === 3 ? 'block' : 'hidden'} md:block`}>

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
                  {formData.moistureMitigation && (
                    <div className="bg-white p-2 sm:p-3 rounded border border-slate-200">
                      <p className="text-xs text-slate-500">Moisture Mitigation ({calculation.moistureMitigationGallons} gal)</p>
                      <p className="text-sm sm:text-base md:text-lg font-semibold">{formatCurrency(calculation.moistureMitigationMaterialCost)}</p>
                    </div>
                  )}
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
                    <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={formData.disableGasHeater}
                        onChange={(e) => setFormData({ ...formData, disableGasHeater: e.target.checked })}
                        className="w-3.5 h-3.5 text-gf-dark-green border-slate-300 focus:ring-gf-lime"
                      />
                      Disable (force $0)
                    </label>
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
                {noLaborersSelected && (
                  <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-300 rounded-lg text-xs text-yellow-800">
                    <span className="font-semibold">⚠ No laborers assigned.</span>
                    <span>Labor costs will be $0. Assign laborers in the Daily Schedule above.</span>
                  </div>
                )}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4">
                  <div>
                    <label className="text-xs text-green-600">Discount</label>
                    <input type="number" step="0.01" value={formData.actualDiscount}
                      onChange={(e) => recalcActualTotal('actualDiscount', e.target.value)}
                      className="w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b border-green-300 focus:outline-none focus:border-green-600 p-0" />
                  </div>
                  <div className={relevantActuals?.crackPrice ? 'rounded px-1 -mx-1 bg-orange-50' : ''}>
                    <label className="text-xs text-green-600">Crack Price</label>
                    <input type="number" step="0.01" value={formData.actualCrackPrice}
                      onChange={(e) => recalcActualTotal('actualCrackPrice', e.target.value)}
                      className={`w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b focus:outline-none p-0 ${relevantActuals?.crackPrice ? 'border-orange-400 focus:border-orange-500' : 'border-green-300 focus:border-green-600'}`} />
                  </div>
                  <div className={relevantActuals?.floorPrice ? 'rounded px-1 -mx-1 bg-orange-50' : ''}>
                    <label className="text-xs text-green-600">Floor $/sqft</label>
                    <input type="number" step="0.01" value={formData.actualFloorPricePerSqft}
                      onChange={(e) => recalcActualTotal('actualFloorPricePerSqft', e.target.value)}
                      className={`w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b focus:outline-none p-0 ${relevantActuals?.floorPrice ? 'border-orange-400 focus:border-orange-500' : 'border-green-300 focus:border-green-600'}`} />
                  </div>
                  <div className={relevantActuals?.floorPrice ? 'rounded px-1 -mx-1 bg-orange-50' : ''}>
                    <label className="text-xs text-green-600">Floor Price</label>
                    <input type="number" step="0.01" value={formData.actualFloorPrice}
                      onChange={(e) => recalcActualTotal('actualFloorPrice', e.target.value)}
                      className={`w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b focus:outline-none p-0 ${relevantActuals?.floorPrice ? 'border-orange-400 focus:border-orange-500' : 'border-green-300 focus:border-green-600'}`} />
                  </div>
                  <div className={relevantActuals?.verticalPrice ? 'rounded px-1 -mx-1 bg-orange-50' : ''}>
                    <label className="text-xs text-green-600">Vertical $/sqft</label>
                    <input type="number" step="0.01" value={formData.actualVerticalPricePerSqft}
                      onChange={(e) => recalcActualTotal('actualVerticalPricePerSqft', e.target.value)}
                      className={`w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b focus:outline-none p-0 ${relevantActuals?.verticalPrice ? 'border-orange-400 focus:border-orange-500' : 'border-green-300 focus:border-green-600'}`} />
                  </div>
                  <div className={relevantActuals?.verticalPrice ? 'rounded px-1 -mx-1 bg-orange-50' : ''}>
                    <label className="text-xs text-green-600">Vertical Price</label>
                    <input type="number" step="0.01" value={formData.actualVerticalPrice}
                      onChange={(e) => recalcActualTotal('actualVerticalPrice', e.target.value)}
                      className={`w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b focus:outline-none p-0 ${relevantActuals?.verticalPrice ? 'border-orange-400 focus:border-orange-500' : 'border-green-300 focus:border-green-600'}`} />
                  </div>
                  <div className={relevantActuals?.antiSlipPrice ? 'rounded px-1 -mx-1 bg-orange-50' : ''}>
                    <label className="text-xs text-green-600">Anti-Slip Price</label>
                    <input type="number" step="0.01" value={formData.actualAntiSlipPrice}
                      onChange={(e) => recalcActualTotal('actualAntiSlipPrice', e.target.value)}
                      className={`w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b focus:outline-none p-0 ${relevantActuals?.antiSlipPrice ? 'border-orange-400 focus:border-orange-500' : 'border-green-300 focus:border-green-600'}`} />
                  </div>
                  <div className={relevantActuals?.abrasionResistancePrice ? 'rounded px-1 -mx-1 bg-orange-50' : ''}>
                    <label className="text-xs text-green-600">Abrasion Resistance</label>
                    <input type="number" step="0.01" value={formData.actualAbrasionResistancePrice}
                      onChange={(e) => recalcActualTotal('actualAbrasionResistancePrice', e.target.value)}
                      className={`w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b focus:outline-none p-0 ${relevantActuals?.abrasionResistancePrice ? 'border-orange-400 focus:border-orange-500' : 'border-green-300 focus:border-green-600'}`} />
                  </div>
                  <div className={relevantActuals?.coatingRemovalPrice ? 'rounded px-1 -mx-1 bg-orange-50' : ''}>
                    <label className="text-xs text-green-600">Coating Removal</label>
                    <input type="number" step="0.01" value={formData.actualCoatingRemovalPrice}
                      onChange={(e) => recalcActualTotal('actualCoatingRemovalPrice', e.target.value)}
                      className={`w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b focus:outline-none p-0 ${relevantActuals?.coatingRemovalPrice ? 'border-orange-400 focus:border-orange-500' : 'border-green-300 focus:border-green-600'}`} />
                  </div>
                  <div className={relevantActuals?.moistureMitigationPrice ? 'rounded px-1 -mx-1 bg-orange-50' : ''}>
                    <label className="text-xs text-green-600">Moisture Mitigation</label>
                    <input type="number" step="0.01" value={formData.actualMoistureMitigationPrice}
                      onChange={(e) => recalcActualTotal('actualMoistureMitigationPrice', e.target.value)}
                      className={`w-full text-sm sm:text-base font-semibold text-green-900 bg-transparent border-b focus:outline-none p-0 ${relevantActuals?.moistureMitigationPrice ? 'border-orange-400 focus:border-orange-500' : 'border-green-300 focus:border-green-600'}`} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-green-200">
                  {(() => {
                    const totalPrice = parseFloat(formData.totalPrice) || 0;
                    const floorFootage = parseFloat(formData.floorFootage) || 0;
                    const effectivePricePerSqft = floorFootage > 0 ? totalPrice / floorFootage : 0;
                    const actualMargin = totalPrice - calculation.totalCosts;
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
              <div className="rounded-xl border-2 border-green-300 bg-green-50 mb-4 sm:mb-6 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowProductsSection(open => !open)}
                  aria-expanded={showProductsSection}
                  aria-controls="job-products-panel"
                  className="w-full flex items-center justify-between gap-3 px-3 sm:px-4 py-4 text-left hover:bg-green-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-700"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Package size={24} className="shrink-0 text-green-700" aria-hidden="true" />
                    <div>
                      <span className="text-base font-bold text-green-900">Products</span>
                      <span className="block text-xs sm:text-sm text-green-800 mt-1">
                        {jobProducts.length > 0
                          ? `${formatCurrency(productsTotalPrice)} in products · ${formatCurrency(productsTotalPrice - productsTotalCost)} product profit`
                          : 'Add products to this job and include their profit in your margin.'}
                      </span>
                    </div>
                    {jobProducts.length > 0 && (
                      <span className="px-2 py-0.5 text-xs font-bold bg-green-200 text-green-900 rounded-full">
                        {jobProducts.length}
                      </span>
                    )}
                  </div>
                  <span className="flex shrink-0 items-center gap-2 text-sm font-semibold text-green-800">
                    <span className="hidden sm:inline">{showProductsSection ? 'Collapse' : 'Add / edit products'}</span>
                    {showProductsSection ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </span>
                </button>

                {showProductsSection && (
                  <div id="job-products-panel" className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-green-200 bg-white">
                    {/* Product selector */}
                    <div className="flex items-center gap-2 mt-3 mb-3">
                      <select
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
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
                        className="flex items-center gap-1 px-3 py-2 bg-gf-lime text-white text-sm rounded-lg hover:bg-gf-dark-green transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                                    className="w-16 text-right text-sm bg-transparent border-b border-slate-300 focus:outline-none focus:border-gf-lime p-0"
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
                                    className="w-24 text-right text-sm bg-transparent border-b border-slate-300 focus:outline-none focus:border-gf-lime p-0"
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
              <div className="bg-green-50 rounded-lg p-3 sm:p-4 border border-green-200">
                <h4 className="text-xs sm:text-sm font-semibold text-gf-dark-green mb-2 sm:mb-3 uppercase tracking-wide">Suggested Pricing</h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4">
                  <div>
                    <p className="text-xs text-gf-dark-green">Discount</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold text-gf-dark-green">{formatCurrency(calculation.suggestedDiscount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gf-dark-green">Crack Price</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold text-gf-dark-green">{formatCurrency(calculation.suggestedCrackPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gf-dark-green">Floor $/sqft</p>
                    <p className={`text-sm sm:text-base md:text-lg font-semibold ${(() => {
                      const selectedSystem = systems.find(s => s.id === formData.system);
                      const min = selectedSystem?.floorPriceMin ?? 6;
                      const max = selectedSystem?.floorPriceMax ?? 8;
                      return (calculation.suggestedFloorPricePerSqft < min || calculation.suggestedFloorPricePerSqft > max) ? 'text-red-600' : 'text-gf-dark-green';
                    })()}`}>
                      {formatCurrency(calculation.suggestedFloorPricePerSqft)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gf-dark-green">Floor Price</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold text-gf-dark-green">{formatCurrency(calculation.suggestedFloorPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gf-dark-green">Vertical Price - {formatCurrency(usedPricing.verticalPricePerSqft)}/sqft</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold text-gf-dark-green">{formatCurrency(calculation.suggestedVerticalPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gf-dark-green">Anti-Slip Price - {formatCurrency(usedPricing.antiSlipPricePerSqft)}/sqft</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold text-gf-dark-green">{formatCurrency(calculation.suggestedAntiSlipPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gf-dark-green">Abrasion Resistance - {formatCurrency(usedPricing.abrasionResistancePricePerSqft)}/sqft</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold text-gf-dark-green">{formatCurrency(calculation.suggestedAbrasionResistancePrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gf-dark-green">
                      Coating Removal - {formData.coatingRemoval}
                      {formData.coatingRemoval === 'Paint' && ` - ${formatCurrency(usedPricing.coatingRemovalPaintPerSqft)}/sqft`}
                      {formData.coatingRemoval === 'Epoxy' && ` - ${formatCurrency(usedPricing.coatingRemovalEpoxyPerSqft)}/sqft`}
                    </p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold text-gf-dark-green">{formatCurrency(calculation.suggestedCoatingRemovalPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gf-dark-green">Moisture Mitigation - {formatCurrency(usedPricing.moistureMitigationPerSqft)}/sqft</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold text-gf-dark-green">{formatCurrency(calculation.suggestedMoistureMitigationPrice)}</p>
                    {calculation.moistureMitigationGallons > 0 && (
                      <p className="text-xs text-gf-grey mt-0.5">{calculation.moistureMitigationGallons} gal · material {formatCurrency(calculation.moistureMitigationMaterialCost)}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-green-200">
                  <div>
                    <p className="text-xs sm:text-sm text-gf-dark-green">Effective $/Sqft</p>
                    <p className="text-xl sm:text-2xl font-bold text-gf-dark-green">{formatCurrency(calculation.suggestedEffectivePricePerSqft)}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gf-dark-green">Suggested Total</p>
                    <p className="text-xl sm:text-2xl font-bold text-gf-dark-green">{formatCurrency(calculation.suggestedTotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gf-dark-green">Suggested Margin</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-600">{formatCurrency(calculation.suggestedMargin)}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gf-dark-green">Margin %</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-600">{calculation.suggestedMarginPct.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>

            </>
          )}

          {activeTab === 'actuals' && (
            <div className="space-y-6">
              {/* Section A: Actual Labor */}
              <div className="rounded-lg border border-slate-200 p-4 sm:p-5 bg-slate-50">
                <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-1">Actual Labor</h3>
                <p className="text-xs text-slate-500 mb-4">Record actual hours and crew for each install day. Add or remove days if the job ran long or finished early.</p>
                <ActualDayScheduleComponent
                  schedule={actualInstallSchedule}
                  availableLaborers={existingJob
                    ? [...activeLaborers, ...existingJob.laborersSnapshot.filter(sl => !activeLaborers.some(al => al.id === sl.id))]
                    : activeLaborers
                  }
                  onChange={setActualInstallSchedule}
                  defaultDayHours={pricing.defaultDayHours ?? 8}
                  plannedDays={parseFloat(formData.installDays) || 1}
                />
              </div>

              {/* Section B: Actual Materials */}
              <div className="rounded-lg border border-slate-200 p-4 sm:p-5 bg-slate-50">
                <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-1">Actual Materials Used</h3>
                <p className="text-xs text-slate-500 mb-4">Enter quantities actually consumed. Estimated amounts shown as reference.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Base Coat (gal)
                      {calculation && <span className="ml-1 text-slate-400 font-normal">est. {calculation.baseGallons.toFixed(1)}</span>}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder={calculation ? calculation.baseGallons.toFixed(1) : '0'}
                      value={actualMaterials.actualBaseCoatGallons}
                      onChange={(e) => setActualMaterials(prev => ({ ...prev, actualBaseCoatGallons: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Top Coat (gal)
                      {calculation && <span className="ml-1 text-slate-400 font-normal">est. {calculation.topGallons.toFixed(1)}</span>}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder={calculation ? calculation.topGallons.toFixed(1) : '0'}
                      value={actualMaterials.actualTopCoatGallons}
                      onChange={(e) => setActualMaterials(prev => ({ ...prev, actualTopCoatGallons: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Cyclo1 (gal)
                      {calculation && <span className="ml-1 text-slate-400 font-normal">est. {calculation.cyclo1Needed.toFixed(1)}</span>}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder={calculation ? calculation.cyclo1Needed.toFixed(1) : '0'}
                      value={actualMaterials.actualCyclo1Gallons}
                      onChange={(e) => setActualMaterials(prev => ({ ...prev, actualCyclo1Gallons: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tint (oz)
                      {calculation && <span className="ml-1 text-slate-400 font-normal">est. {calculation.tintNeeded.toFixed(1)}</span>}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder={calculation ? calculation.tintNeeded.toFixed(1) : '0'}
                      value={actualMaterials.actualTintOz}
                      onChange={(e) => setActualMaterials(prev => ({ ...prev, actualTintOz: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Chip Boxes
                      {calculation && <span className="ml-1 text-slate-400 font-normal">est. {calculation.chipNeeded}</span>}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder={calculation ? calculation.chipNeeded.toString() : '0'}
                      value={actualMaterials.actualChipBoxes}
                      onChange={(e) => setActualMaterials(prev => ({ ...prev, actualChipBoxes: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Crack Repair (oz)
                      {calculation && <span className="ml-1 text-slate-400 font-normal">est. {(calculation.crackFillGallons * 128).toFixed(0)}</span>}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder={calculation ? (calculation.crackFillGallons * 128).toFixed(0) : '0'}
                      value={actualMaterials.actualCrackRepairOz}
                      onChange={(e) => setActualMaterials(prev => ({ ...prev, actualCrackRepairOz: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      MVB (gal)
                      {calculation && <span className="ml-1 text-slate-400 font-normal">est. {calculation.moistureMitigationGallons.toFixed(1)}</span>}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder={calculation ? calculation.moistureMitigationGallons.toFixed(1) : '0'}
                      value={actualMaterials.actualMoistureMitigationGallons}
                      onChange={(e) => setActualMaterials(prev => ({ ...prev, actualMoistureMitigationGallons: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Slab Temp (deg F)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0"
                      value={actualMaterials.actualSlabTemp}
                      onChange={(e) => setActualMaterials(prev => ({ ...prev, actualSlabTemp: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
                    />
                  </div>
                </div>
              </div>

              {/* Section C: Expense Adjustments */}
              <div className="rounded-lg border border-slate-200 p-4 sm:p-5 bg-slate-50">
                <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-1">Expense Adjustment</h3>
                <p className="text-xs text-slate-500 mb-4">Add or subtract an adjustment to actual costs (e.g., equipment rental, subcontractor fees, credits).</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Amount ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={actualMaterials.actualExpenseAdjustment}
                      onChange={(e) => setActualMaterials(prev => ({ ...prev, actualExpenseAdjustment: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime"
                    />
                    <p className="mt-1 text-xs text-slate-400">Positive = additional expense, negative = credit/savings.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                    <textarea
                      placeholder="Justification for this adjustment..."
                      value={actualMaterials.actualExpenseAdjustmentNotes}
                      onChange={(e) => setActualMaterials(prev => ({ ...prev, actualExpenseAdjustmentNotes: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime resize-y"
                    />
                  </div>
                </div>
              </div>

              {/* Section D: Actual vs Estimated Cost Comparison */}
              {actualCalculation && calculation && (
                <div className="rounded-lg border border-slate-200 p-4 sm:p-5 bg-white">
                  <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-4">Estimated vs. Actual Costs</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 pr-4 text-xs font-semibold text-slate-600 w-32">Category</th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-slate-600">Estimated</th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-slate-600">Actual</th>
                          <th className="text-right py-2 pl-3 text-xs font-semibold text-slate-600">Difference</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[
                          { label: 'Chip', est: calculation.chipCost, act: actualCalculation.actualChipCost },
                          { label: 'Base Coat', est: calculation.baseCost, act: actualCalculation.actualBaseCost },
                          { label: 'Top Coat', est: calculation.topCost, act: actualCalculation.actualTopCost },
                          { label: 'Cyclo1', est: calculation.cyclo1Cost, act: actualCalculation.actualCyclo1Cost },
                          { label: 'Tint', est: calculation.tintCost, act: actualCalculation.actualTintCost },
                          { label: 'Crack Repair', est: calculation.crackFillCost, act: actualCalculation.actualCrackRepairCost },
                          { label: 'MVB', est: calculation.moistureMitigationMaterialCost, act: actualCalculation.actualMoistureMitigationCost },
                          {
                            label: 'Gas',
                            est: calculation.gasGeneratorCost + calculation.gasHeaterCost + calculation.gasTravelCost,
                            act: actualCalculation.actualGasGeneratorCost + actualCalculation.actualGasHeaterCost + actualCalculation.actualGasTravelCost,
                          },
                          { label: 'Labor', est: calculation.laborCost, act: actualCalculation.actualLaborCost },
                          { label: 'Consumables', est: calculation.consumablesCost, act: actualCalculation.actualConsumablesCost },
                          { label: 'Royalty', est: calculation.royaltyCost, act: actualCalculation.actualRoyaltyCost },
                          ...(actualCalculation.actualExpenseAdjustment !== 0 ? [{ label: 'Expense Adj.', est: 0, act: actualCalculation.actualExpenseAdjustment }] : []),
                        ].map(({ label, est, act }) => {
                          const diff = act - est;
                          return (
                            <tr key={label}>
                              <td className="py-2 pr-4 text-xs text-slate-700">{label}</td>
                              <td className="py-2 px-3 text-right text-xs text-slate-600">{formatCurrency(est)}</td>
                              <td className="py-2 px-3 text-right text-xs text-slate-800 font-medium">{formatCurrency(act)}</td>
                              <td className={`py-2 pl-3 text-right text-xs font-medium ${diff > 0.01 ? 'text-red-600' : diff < -0.01 ? 'text-green-700' : 'text-slate-500'}`}>
                                {diff > 0.01 ? '+' : ''}{formatCurrency(diff)}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="border-t-2 border-slate-300 font-semibold">
                          <td className="py-2.5 pr-4 text-sm text-slate-900">Total</td>
                          <td className="py-2.5 px-3 text-right text-sm text-slate-700">{formatCurrency(calculation.totalCosts)}</td>
                          <td className="py-2.5 px-3 text-right text-sm text-slate-900">{formatCurrency(actualCalculation.actualTotalCosts)}</td>
                          <td className={`py-2.5 pl-3 text-right text-sm font-semibold ${(actualCalculation.actualTotalCosts - calculation.totalCosts) > 0.01 ? 'text-red-600' : 'text-green-700'}`}>
                            {(actualCalculation.actualTotalCosts - calculation.totalCosts) > 0.01 ? '+' : ''}{formatCurrency(actualCalculation.actualTotalCosts - calculation.totalCosts)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Margin summary cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-4 border-t border-slate-200">
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <p className="text-xs text-slate-500 mb-1">Estimated Margin</p>
                      <p className="text-lg font-bold text-slate-800">{formatCurrency(calculation.jobMargin)}</p>
                      <p className="text-xs text-slate-500">{calculation.totalCosts > 0 ? ((calculation.jobMargin / (parseFloat(formData.totalPrice) || 1)) * 100).toFixed(1) : '0.0'}%</p>
                    </div>
                    <div className={`rounded-lg p-3 border ${actualCalculation.actualMargin >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <p className="text-xs text-slate-500 mb-1">Actual Margin</p>
                      <p className={`text-lg font-bold ${actualCalculation.actualMargin >= 0 ? 'text-green-800' : 'text-red-700'}`}>
                        {formatCurrency(actualCalculation.actualMargin)}
                      </p>
                      <p className="text-xs text-slate-500">{actualCalculation.actualMarginPct.toFixed(1)}%</p>
                    </div>
                    <div className={`rounded-lg p-3 border ${(actualCalculation.actualMargin - calculation.jobMargin) >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <p className="text-xs text-slate-500 mb-1">Margin Difference</p>
                      <p className={`text-lg font-bold ${(actualCalculation.actualMargin - calculation.jobMargin) >= 0 ? 'text-green-800' : 'text-red-700'}`}>
                        {(actualCalculation.actualMargin - calculation.jobMargin) >= 0 ? '+' : ''}{formatCurrency(actualCalculation.actualMargin - calculation.jobMargin)}
                      </p>
                      <p className="text-xs text-slate-500">vs. estimated</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'reminders' && (
            <div className="rounded-lg border border-slate-200 p-4 sm:p-5 bg-slate-50">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-slate-900">Reminders</h3>
                  <p className="text-xs text-slate-500 mt-1">Task reminders related to this job.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={openAddReminder}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium bg-gf-lime text-white rounded-lg hover:bg-gf-dark-green transition-colors"
                  >
                    <Plus size={14} />
                    Add Reminder
                  </button>
                </div>
              </div>

              {reminders.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No reminders added.</p>
              ) : (
                <div className="space-y-2">
                  {[...reminders]
                    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
                    .map((reminder) => (
                      <div key={reminder.id} className={`flex items-start justify-between gap-3 p-3 bg-white border rounded-lg ${reminder.completed ? 'border-slate-100 opacity-60' : 'border-slate-200'}`}>
                        <button
                          type="button"
                          onClick={() => !reminder.completed && openEditReminder(reminder)}
                          className="text-left flex-1"
                          disabled={reminder.completed}
                        >
                          <p className={`text-sm font-semibold ${reminder.completed ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                            {reminder.subject}
                            {reminder.autoRuleId && (
                              <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-600 rounded align-middle">Auto</span>
                            )}
                          </p>
                          <p className="text-xs text-slate-600">Due {new Date(reminder.dueAt).toLocaleString()}</p>
                          {reminder.details && (
                            <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">{reminder.details}</p>
                          )}
                          {reminder.completed && <p className="text-xs text-green-600 mt-0.5">Completed</p>}
                        </button>
                        <div className="flex items-center gap-1">
                          {reminder.details && (
                            <button
                              type="button"
                              onClick={async () => {
                                await navigator.clipboard.writeText(reminder.details!);
                                setCopiedReminderId(reminder.id);
                                setTimeout(() => setCopiedReminderId(null), 2000);
                              }}
                              className="p-1.5 text-slate-400 hover:text-gf-dark-green hover:bg-green-50 rounded-lg transition-colors"
                              title="Copy message"
                            >
                              {copiedReminderId === reminder.id ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                            </button>
                          )}
                          {!reminder.completed && (
                            <button
                              type="button"
                              onClick={() => handleCompleteReminder(reminder.id)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Mark complete"
                            >
                              <Check size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteReminder(reminder.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete reminder"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Follow-ups section */}
              <div className="mt-5 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-slate-900">Follow-ups</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Log contacts and interactions with this customer.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFollowUpForm({ date: localToday(), notes: '' });
                      setShowFollowUpForm(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium bg-gf-lime text-white rounded-lg hover:bg-gf-dark-green transition-colors"
                  >
                    <Plus size={14} />
                    Log Follow-up
                  </button>
                </div>

                {showFollowUpForm && (
                  <div className="mb-3 p-3 bg-white border border-gf-lime rounded-lg space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-700 mb-1">Date *</label>
                        <input
                          type="date"
                          value={followUpForm.date}
                          onChange={(e) => setFollowUpForm({ ...followUpForm, date: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                      <textarea
                        value={followUpForm.notes}
                        onChange={(e) => setFollowUpForm({ ...followUpForm, notes: e.target.value })}
                        placeholder="What happened? (optional)"
                        rows={3}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent resize-none"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setShowFollowUpForm(false)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleLogFollowUp}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-gf-lime rounded-lg hover:bg-gf-dark-green transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}

                {followUps.length === 0 && !showFollowUpForm ? (
                  <p className="text-sm text-slate-500 italic">No follow-ups logged.</p>
                ) : (
                  <div className="space-y-2">
                    {[...followUps]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((fu) => (
                        <div key={fu.id} className="flex items-start justify-between gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-900">{new Date(fu.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                            {fu.notes && <p className="text-xs text-slate-500 mt-0.5 whitespace-pre-wrap">{fu.notes}</p>}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteFollowUp(fu.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete follow-up"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 sm:mb-2">Estimate Date</label>
            <input
              type="date"
              value={formData.estimateDate}
              onChange={(e) => setFormData({ ...formData, estimateDate: e.target.value })}
              className="w-full sm:w-48 px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
            />
          </div>

          {linkedLead && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">Linked Lead</p>
                  <p className="text-blue-800">
                    {linkedLead.name || linkedLead.phone || linkedLead.email || 'Unknown Lead'}
                    {linkedLead.source ? ` from ${linkedLead.source}` : ''}
                  </p>
                </div>
                <span className="inline-flex w-fit items-center rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-blue-700">
                  {linkedLead.stage}
                </span>
              </div>
            </div>
          )}

          {/* Desktop save/cancel */}
          <div className="hidden md:flex flex-col sm:flex-row gap-2 sm:gap-3">
            <SaveButton
              type="submit"
              saving={saving}
              saved={jobFlash.saved}
              label={jobId ? 'Update Job' : 'Create Job'}
              icon={<Save size={18} className="sm:w-5 sm:h-5" />}
              iconSize={18}
              className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold disabled:bg-slate-400 text-sm sm:text-base"
            />
            <button
              type="button"
              onClick={onBack}
              disabled={saving}
              className="px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-200 text-slate-900 rounded-lg font-semibold hover:bg-slate-300 active:bg-slate-400 transition-colors disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              Cancel
            </button>
          </div>

          {/* Mobile bottom nav */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 flex items-center gap-3 z-40">
            {activeTab === 'details' && currentStep > 0 && (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep - 1)}
                className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm"
              >
                <ChevronLeft size={16} />
                Back
              </button>
            )}
            {activeTab === 'details' && currentStep < 3 ? (
              <>
                <SaveButton
                  type="submit"
                  tone="subtle"
                  saving={saving}
                  saved={jobFlash.saved}
                  label="Save"
                  iconSize={14}
                  className="gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-sm disabled:bg-slate-200 disabled:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="flex-1 py-2.5 rounded-xl bg-gf-lime text-white font-bold text-sm text-center"
                >
                  Continue
                  <ChevronRight size={16} className="inline ml-1" />
                </button>
              </>
            ) : (
              <SaveButton
                type="submit"
                saving={saving}
                saved={jobFlash.saved}
                label={jobId ? 'Update' : 'Save Estimate'}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm disabled:bg-slate-400"
              />
            )}
          </div>
        </form>
      </div>

      {showReminderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingReminderId ? 'Edit Reminder' : 'Add Reminder'}
              </h2>
              <button
                type="button"
                onClick={closeReminderModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Subject *</label>
                <input
                  type="text"
                  value={reminderForm.subject}
                  onChange={(e) => setReminderForm({ ...reminderForm, subject: e.target.value })}
                  placeholder="Reminder subject"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                />
              </div>
              {commTemplates.length > 0 && !editingReminderId && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Template (optional)</label>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const tpl = commTemplates.find(t => t.id === e.target.value);
                      if (tpl) {
                        const firstName = (formData.customerName || '').trim().split(' ')[0] || '[Name]';
                        const resolved = tpl.body.replace(/\[Name\]/gi, firstName);
                        setReminderForm(f => ({ ...f, details: resolved }));
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  >
                    <option value="">— Select a template —</option>
                    {commTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Message / Details</label>
                <textarea
                  value={reminderForm.details}
                  onChange={(e) => setReminderForm({ ...reminderForm, details: e.target.value })}
                  placeholder="Optional details"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                  <input
                    type="date"
                    value={reminderForm.dueDate}
                    onChange={(e) => setReminderForm({ ...reminderForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Time *</label>
                  <input
                    type="time"
                    value={reminderForm.dueTime}
                    onChange={(e) => setReminderForm({ ...reminderForm, dueTime: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeReminderModal}
                  disabled={savingReminder}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <SaveButton
                  type="button"
                  onClick={handleSaveReminder}
                  saving={savingReminder}
                  saved={reminderFlash.saved}
                  label={editingReminderId ? 'Save Reminder' : 'Add Reminder'}
                  icon={null}
                  className="px-4 py-2 text-sm font-medium rounded-lg disabled:bg-slate-400"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {showNextReminderPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Create Next Reminder</h3>
              <button
                type="button"
                onClick={() => setShowNextReminderPrompt(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-slate-600">Reminder completed. Schedule a follow-up?</p>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
                <input
                  type="text"
                  value={nextReminderForm.subject}
                  onChange={(e) => setNextReminderForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="e.g. Follow up call"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={nextReminderForm.dueDate}
                    onChange={(e) => setNextReminderForm((f) => ({ ...f, dueDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Time</label>
                  <input
                    type="time"
                    value={nextReminderForm.dueTime}
                    onChange={(e) => setNextReminderForm((f) => ({ ...f, dueTime: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  />
                </div>
              </div>
              {commTemplates.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Template (optional)</label>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const tpl = commTemplates.find(t => t.id === e.target.value);
                      if (tpl) {
                        const firstName = (formData.customerName || '').trim().split(' ')[0] || '[Name]';
                        setNextReminderForm((f) => ({ ...f, details: tpl.body.replace(/\[Name\]/gi, firstName) }));
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  >
                    <option value="">— Select a template —</option>
                    {commTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Message / Details (optional)</label>
                <textarea
                  value={nextReminderForm.details}
                  onChange={(e) => setNextReminderForm((f) => ({ ...f, details: e.target.value }))}
                  rows={2}
                  placeholder="Additional notes..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent resize-none"
                />
              </div>
              <div className="pt-1 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCreateNextReminder}
                  className="px-3 py-2 text-sm font-medium text-white bg-gf-lime rounded-lg hover:bg-gf-dark-green transition-colors"
                >
                  Create Reminder
                </button>
                <button
                  type="button"
                  onClick={() => setShowNextReminderPrompt(false)}
                  className="px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  No Thanks
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showInventoryUpdateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="inventory-update-modal-title"
            className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 id="inventory-update-modal-title" className="text-lg font-semibold text-slate-900">Review Inventory Updates</h2>
              <button
                type="button"
                onClick={handleCancelInventoryUpdate}
                disabled={applyingInventoryUpdate}
                aria-label="Close inventory review"
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[calc(90vh-9rem)] overflow-auto px-6 py-5">
              {inventoryUpdateError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {inventoryUpdateError}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">Product</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600">Current</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600">Used From Actuals</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600">New Inventory</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {inventoryReviewRows.map((row) => (
                      <tr key={row.key} className="align-top">
                        <td className="px-3 py-3">
                          <div className="font-medium text-slate-900">{row.productName}</div>
                          <div className="text-xs text-slate-500">{row.unit}</div>
                          {row.isMissingInventory && (
                            <div className="mt-1 text-xs text-amber-600">will be created</div>
                          )}
                          {row.warning && (
                            <div className="mt-1 text-xs text-amber-700">{row.warning}</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-medium text-slate-700">
                          {formatInventoryValue(row.currentValue, row.unit)}
                        </td>
                        <td className={`px-3 py-3 text-right font-medium ${row.usedDelta < 0 ? 'text-green-600' : 'text-slate-700'}`}>
                          {row.usedDelta > 0 ? '' : row.usedDelta < 0 ? '-' : ''}
                          {formatInventoryValue(Math.abs(row.usedDelta), row.unit)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end">
                            <input
                              type="number"
                              value={Number.isFinite(row.newValue) ? row.newValue : 0}
                              onChange={(e) => updateInventoryReviewNewValue(row.key, e.target.value)}
                              step={row.unit === 'lbs' ? '1' : '0.01'}
                              disabled={applyingInventoryUpdate}
                              className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-right text-sm text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gf-lime disabled:cursor-not-allowed disabled:bg-slate-100"
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={handleCancelInventoryUpdate}
                disabled={applyingInventoryUpdate}
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyInventoryUpdate}
                disabled={applyingInventoryUpdate}
                className="rounded-lg bg-gf-lime px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gf-dark-green disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {applyingInventoryUpdate ? 'Applying...' : 'Apply Updates'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group creation modal */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                {modalView === 'existing-search' && (
                  <button
                    type="button"
                    onClick={() => { setModalView('options'); setExistingJobSearch(''); }}
                    className="p-1 text-slate-400 hover:text-slate-600 mr-1"
                  >
                    <ArrowLeft size={16} />
                  </button>
                )}
                {groupModalType === 'bundled' ? <Link size={18} className="text-blue-600" /> : <Shuffle size={18} className="text-purple-600" />}
                <h2 className="text-lg font-semibold text-slate-900">
                  {modalView === 'existing-search'
                    ? 'Select an Existing Estimate'
                    : groupModalType === 'bundled' ? 'Add Bundle Part' : 'Add Alternative Estimate'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => { setShowGroupModal(false); setModalView('options'); setExistingJobSearch(''); }}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5">
              {modalView === 'options' ? (
                <>
                  <p className="text-sm text-slate-600 mb-4">
                    {groupModalType === 'bundled'
                      ? 'Add another estimate to this bundle. Each part has a separate system, footage, and pricing. Aggregate totals are shown together.'
                      : 'Add an alternative estimate for the same customer. Each option has its own system, pricing, and specs for the customer to choose from.'}
                  </p>
                  <p className="text-sm font-semibold text-slate-700 mb-3">How should the new estimate start?</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      disabled={creatingGroupJob}
                      onClick={() => handleCreateGroupEstimate(true)}
                      className="flex flex-col items-center gap-1.5 p-4 border-2 border-slate-200 rounded-xl hover:border-gf-lime hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="text-2xl">📋</span>
                      <span className="font-semibold text-slate-800 text-sm">Copy This Job</span>
                      <span className="text-xs text-slate-500 text-center">Same settings, edit what's different</span>
                    </button>
                    <button
                      type="button"
                      disabled={creatingGroupJob}
                      onClick={() => handleCreateGroupEstimate(false)}
                      className="flex flex-col items-center gap-1.5 p-4 border-2 border-slate-200 rounded-xl hover:border-gf-lime hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="text-2xl">✨</span>
                      <span className="font-semibold text-slate-800 text-sm">Start Blank</span>
                      <span className="text-xs text-slate-500 text-center">Customer info carried over only</span>
                    </button>
                    <button
                      type="button"
                      disabled={creatingGroupJob || ungroupedJobs.length === 0}
                      onClick={() => setModalView('existing-search')}
                      className="flex flex-col items-center gap-1.5 p-4 border-2 border-slate-200 rounded-xl hover:border-gf-lime hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={ungroupedJobs.length === 0 ? 'No other ungrouped estimates available' : undefined}
                    >
                      <span className="text-2xl">🔍</span>
                      <span className="font-semibold text-slate-800 text-sm">Use Existing</span>
                      <span className="text-xs text-slate-500 text-center">
                        {ungroupedJobs.length === 0 ? 'No ungrouped estimates' : 'Add an estimate you already made'}
                      </span>
                    </button>
                  </div>
                  {creatingGroupJob && (
                    <p className="text-xs text-center text-slate-500 mt-3">Creating estimate...</p>
                  )}
                </>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Search by job name or customer..."
                    value={existingJobSearch}
                    onChange={(e) => setExistingJobSearch(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent mb-3"
                    autoFocus
                  />
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {ungroupedJobs
                      .filter(j => {
                        const q = existingJobSearch.trim().toLowerCase();
                        if (!q) return true;
                        return (j.name || '').toLowerCase().includes(q) || (j.customerName || '').toLowerCase().includes(q);
                      })
                      .slice(0, 8)
                      .map(j => (
                        <button
                          key={j.id}
                          type="button"
                          disabled={creatingGroupJob}
                          onClick={() => handleAddExistingJobToGroup(j)}
                          className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-slate-200 hover:border-gf-lime hover:bg-green-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{j.name || 'Untitled Job'}</p>
                            {j.customerName && <p className="text-xs text-slate-500 truncate">{j.customerName}</p>}
                          </div>
                          <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                            j.status === 'Won' ? 'bg-green-100 text-green-800' :
                            j.status === 'Lost' ? 'bg-red-100 text-red-800' :
                            j.status === 'Verbal' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {j.status}
                          </span>
                        </button>
                      ))}
                    {ungroupedJobs.filter(j => {
                      const q = existingJobSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (j.name || '').toLowerCase().includes(q) || (j.customerName || '').toLowerCase().includes(q);
                    }).length === 0 && (
                      <p className="text-sm text-slate-500 italic text-center py-4">No matching estimates found.</p>
                    )}
                  </div>
                  {creatingGroupJob && (
                    <p className="text-xs text-center text-slate-500 mt-3">Adding estimate...</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
