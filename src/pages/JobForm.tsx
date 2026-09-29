import { ArrowLeft, Save, ChevronLeft, ChevronRight, X, Plus, Link, Shuffle, FileText } from 'lucide-react';
import SaveButton from '../components/SaveButton';
import SnapshotChangeBanner from '../components/SnapshotChangeBanner';
import { useJobForm, type JobFormProps } from './jobForm/useJobForm';
import ReminderModal from './jobForm/ReminderModal';
import NextReminderModal from './jobForm/NextReminderModal';
import InventoryUpdateModal from './jobForm/InventoryUpdateModal';
import GroupEstimateModal from './jobForm/GroupEstimateModal';
import ActualsTab from './jobForm/ActualsTab';
import RemindersTab from './jobForm/RemindersTab';
import CustomerStep from './jobForm/CustomerStep';
import SystemStepBasics from './jobForm/SystemStepBasics';
import MeasureStepBasics from './jobForm/MeasureStepBasics';
import SystemStepDetails from './jobForm/SystemStepDetails';
import MeasureStepDetails from './jobForm/MeasureStepDetails';
import PriceStep from './jobForm/PriceStep';

export default function JobForm(props: JobFormProps) {
  const form = useJobForm(props);
  const {
    marginPct,
    perSqft,
    loading,
    saving,
    jobFlash,
    calculation,
    existingJob,
    linkedLead,
    activeTab,
    setActiveTab,
    currentStep,
    setCurrentStep,
    STEP_LABELS,
    showInventoryUpdateModal,
    reminders,
    showReminderModal,
    showNextReminderPrompt,
    snapshotChanges,
    showSnapshotBanner,
    groupJobs,
    showGroupModal,
    bundleAggregate,
    formData,
    setFormData,
    openAddReminder,
    handleOpenGroupModal,
    handleRemoveFromGroup,
    handleUpdateToCurrentValues,
    handleKeepOriginalValues,
    handleSubmit,
    formatCurrency,
    jobId,
    onBack,
    onEditJob,
    onViewJobSheet,
  } = form;

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

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
          <CustomerStep form={form} />

          {/* Step 2: System (part 1) */}
          <SystemStepBasics form={form} />

          {/* Step 1: Measure (part 1) */}
          <MeasureStepBasics form={form} />

          {/* Step 2: System (part 2) */}
          <SystemStepDetails form={form} />

          {/* Step 1: Measure (part 2 - Evaluation + Install Days + Schedule) */}
          <MeasureStepDetails form={form} />

          {/* Step 3: Price */}
          <PriceStep form={form} />

            </>
          )}

          {activeTab === 'actuals' && (
            <ActualsTab form={form} />
          )}

          {activeTab === 'reminders' && (
            <RemindersTab form={form} />
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
        <ReminderModal form={form} />
      )}

      {showNextReminderPrompt && (
        <NextReminderModal form={form} />
      )}

      {showInventoryUpdateModal && (
        <InventoryUpdateModal form={form} />
      )}

      {/* Group creation modal */}
      {showGroupModal && (
        <GroupEstimateModal form={form} />
      )}
    </div>
  );
}
