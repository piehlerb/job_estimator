import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { SnapshotChanges, getFieldLabel } from '../lib/snapshotComparison';

interface SnapshotChangeBannerProps {
  changes: SnapshotChanges;
  onUpdate: () => void;
  onDismiss: () => void;
}

export default function SnapshotChangeBanner({ changes, onUpdate, onDismiss }: SnapshotChangeBannerProps) {
  if (!changes.hasChanges) {
    return null;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatValue = (field: string, value: number): string => {
    // Currency fields
    if (field.includes('Cost') || field === 'boxCost') {
      return formatCurrency(value);
    }
    // Spread and other numeric fields
    return value.toFixed(2);
  };

  const totalChanges = changes.systemChanges.length + changes.costChanges.length;

  return (
    <div className="mb-4 sm:mb-6 bg-amber-50 border-2 border-amber-400 rounded-lg p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={24} />

        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-lg font-bold text-amber-900 mb-2">
            System or Cost Values Have Changed
          </h3>

          <p className="text-sm text-amber-800 mb-3">
            This job was created with different system spreads or cost assumptions.
            {totalChanges} value{totalChanges !== 1 ? 's have' : ' has'} changed since this job was created.
          </p>

          {/* System Changes */}
          {changes.systemChanges.length > 0 && (
            <div className="mb-3">
              <h4 className="text-sm font-semibold text-amber-900 mb-2">System Changes:</h4>
              <div className="space-y-1">
                {changes.systemChanges.map((change) => (
                  <div key={change.field} className="text-sm text-amber-800 flex flex-wrap items-center gap-1">
                    <span className="font-medium">{getFieldLabel(change.field)}:</span>
                    <span className="line-through text-amber-700">{formatValue(change.field, change.oldValue)}</span>
                    <span>→</span>
                    <span className="font-semibold text-amber-900">{formatValue(change.field, change.newValue)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cost Changes */}
          {changes.costChanges.length > 0 && (
            <div className="mb-3">
              <h4 className="text-sm font-semibold text-amber-900 mb-2">Cost Changes:</h4>
              <div className="space-y-1">
                {changes.costChanges.map((change) => (
                  <div key={change.field} className="text-sm text-amber-800 flex flex-wrap items-center gap-1">
                    <span className="font-medium">{getFieldLabel(change.field)}:</span>
                    <span className="line-through text-amber-700">{formatValue(change.field, change.oldValue)}</span>
                    <span>→</span>
                    <span className="font-semibold text-amber-900">{formatValue(change.field, change.newValue)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <button
              type="button"
              onClick={onUpdate}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 transition-colors text-sm"
            >
              <RefreshCw size={16} />
              Update to New Values
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-amber-400 text-amber-900 rounded-lg font-semibold hover:bg-amber-100 transition-colors text-sm"
            >
              <X size={16} />
              Keep Original Values
            </button>
          </div>

          <p className="text-xs text-amber-700 mt-3">
            <strong>Note:</strong> Updating will recalculate all costs and material quantities based on current pricing.
          </p>
        </div>
      </div>
    </div>
  );
}
