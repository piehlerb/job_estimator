import { X } from 'lucide-react';
import type { JobFormModel } from './useJobForm';

export default function InventoryUpdateModal({ form }: { form: JobFormModel }) {
  const {
    inventoryReviewRows,
    inventoryUpdateError,
    applyingInventoryUpdate,
    updateInventoryReviewNewValue,
    handleCancelInventoryUpdate,
    handleApplyInventoryUpdate,
    formatInventoryValue,
  } = form;

  return (
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
  );
}
