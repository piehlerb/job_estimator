import { useState } from 'react';
import { AlertCircle, RefreshCw, X, Check } from 'lucide-react';
import { SnapshotChanges, getFieldLabel } from '../lib/snapshotComparison';

export interface SelectedChanges {
  systemFields: string[];
  costFields: string[];
}

interface SnapshotChangeBannerProps {
  changes: SnapshotChanges;
  onUpdate: (selected: SelectedChanges) => void;
  onDismiss: () => void;
}

export default function SnapshotChangeBanner({ changes, onUpdate, onDismiss }: SnapshotChangeBannerProps) {
  const [selectedSystem, setSelectedSystem] = useState<Set<string>>(
    () => new Set(changes.systemChanges.map(c => c.field))
  );
  const [selectedCosts, setSelectedCosts] = useState<Set<string>>(
    () => new Set(changes.costChanges.map(c => c.field))
  );

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
    if (field.includes('Cost') || field === 'boxCost') {
      return formatCurrency(value);
    }
    return value.toFixed(2);
  };

  const totalChanges = changes.systemChanges.length + changes.costChanges.length;
  const totalSelected = selectedSystem.size + selectedCosts.size;
  const showCheckboxes = totalChanges > 1;

  const toggleSystem = (field: string) => {
    setSelectedSystem(prev => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const toggleCost = (field: string) => {
    setSelectedCosts(prev => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const handleUpdate = () => {
    onUpdate({
      systemFields: Array.from(selectedSystem),
      costFields: Array.from(selectedCosts),
    });
  };

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
            {showCheckboxes && ' Select which updates to apply.'}
          </p>

          {/* System Changes */}
          {changes.systemChanges.length > 0 && (
            <div className="mb-3">
              <h4 className="text-sm font-semibold text-amber-900 mb-2">System Changes:</h4>
              <div className="space-y-1">
                {changes.systemChanges.map((change) => (
                  <label
                    key={change.field}
                    className={`text-sm text-amber-800 flex items-center gap-2 ${showCheckboxes ? 'cursor-pointer hover:bg-amber-100 rounded px-1 py-0.5 -mx-1' : ''}`}
                  >
                    {showCheckboxes && (
                      <input
                        type="checkbox"
                        checked={selectedSystem.has(change.field)}
                        onChange={() => toggleSystem(change.field)}
                        className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                      />
                    )}
                    <span className="flex flex-wrap items-center gap-1">
                      <span className="font-medium">{getFieldLabel(change.field)}:</span>
                      <span className="line-through text-amber-700">{formatValue(change.field, change.oldValue)}</span>
                      <span>→</span>
                      <span className="font-semibold text-amber-900">{formatValue(change.field, change.newValue)}</span>
                    </span>
                  </label>
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
                  <label
                    key={change.field}
                    className={`text-sm text-amber-800 flex items-center gap-2 ${showCheckboxes ? 'cursor-pointer hover:bg-amber-100 rounded px-1 py-0.5 -mx-1' : ''}`}
                  >
                    {showCheckboxes && (
                      <input
                        type="checkbox"
                        checked={selectedCosts.has(change.field)}
                        onChange={() => toggleCost(change.field)}
                        className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                      />
                    )}
                    <span className="flex flex-wrap items-center gap-1">
                      <span className="font-medium">{getFieldLabel(change.field)}:</span>
                      <span className="line-through text-amber-700">{formatValue(change.field, change.oldValue)}</span>
                      <span>→</span>
                      <span className="font-semibold text-amber-900">{formatValue(change.field, change.newValue)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <button
              type="button"
              onClick={handleUpdate}
              disabled={totalSelected === 0}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {totalSelected === totalChanges ? (
                <>
                  <RefreshCw size={16} />
                  Update All Values
                </>
              ) : (
                <>
                  <Check size={16} />
                  Update {totalSelected} Selected
                </>
              )}
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
            <strong>Note:</strong> Updating will recalculate costs based on the selected new values.
          </p>
        </div>
      </div>
    </div>
  );
}
