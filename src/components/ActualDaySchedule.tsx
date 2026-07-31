import { Clock, Plus, Trash2, RotateCcw } from 'lucide-react';
import type { ActualDaySchedule, Laborer } from '../types';
import {
  getActualLaborerHours,
  getActualDayDurationHours,
  getActualCrewHours,
  getActualHourOverrides,
} from '../lib/calculations';

interface ActualDayScheduleProps {
  schedule: ActualDaySchedule[];
  availableLaborers: Laborer[];
  onChange: (schedule: ActualDaySchedule[]) => void;
  defaultDayHours?: number;
  /** Planned install days, shown as a reference against the actual day count. */
  plannedDays?: number;
}

// Days are always numbered 1..n so removals in the middle stay contiguous.
function renumber(schedule: ActualDaySchedule[]): ActualDaySchedule[] {
  return schedule.map((s, i) => ({ ...s, day: i + 1 }));
}

// Drops one laborer's override, collapsing an emptied list back to undefined.
function withoutOverride(day: ActualDaySchedule, laborerId: string): ActualDaySchedule['laborerHours'] {
  const rest = getActualHourOverrides(day).filter(o => o.laborerId !== laborerId);
  return rest.length > 0 ? rest : undefined;
}

export default function ActualDayScheduleComponent({
  schedule,
  availableLaborers,
  onChange,
  defaultDayHours = 8,
  plannedDays,
}: ActualDayScheduleProps) {
  const updateDay = (day: number, changes: Partial<ActualDaySchedule>) => {
    onChange(schedule.map(s => (s.day === day ? { ...s, ...changes } : s)));
  };

  const addDay = () => {
    const last = schedule[schedule.length - 1];
    onChange([
      ...schedule,
      {
        day: schedule.length + 1,
        // Carry the previous day's crew and length forward as the starting point.
        hours: last?.hours ?? defaultDayHours,
        laborerIds: last ? [...last.laborerIds] : [],
      },
    ]);
  };

  const removeDay = (day: number) => {
    onChange(renumber(schedule.filter(s => s.day !== day)));
  };

  const toggleLaborer = (day: number, laborerId: string) => {
    const daySchedule = schedule.find(s => s.day === day);
    if (!daySchedule) return;

    if (daySchedule.laborerIds.includes(laborerId)) {
      // Dropping a laborer also drops any hour override they had for the day.
      updateDay(day, {
        laborerIds: daySchedule.laborerIds.filter(id => id !== laborerId),
        laborerHours: withoutOverride(daySchedule, laborerId),
      });
    } else {
      updateDay(day, { laborerIds: [...daySchedule.laborerIds, laborerId] });
    }
  };

  const setLaborerHours = (day: number, laborerId: string, hours: number) => {
    const daySchedule = schedule.find(s => s.day === day);
    if (!daySchedule) return;
    const others = getActualHourOverrides(daySchedule).filter(o => o.laborerId !== laborerId);
    updateDay(day, { laborerHours: [...others, { laborerId, hours }] });
  };

  const clearLaborerHours = (day: number, laborerId: string) => {
    const daySchedule = schedule.find(s => s.day === day);
    if (!daySchedule) return;
    updateDay(day, { laborerHours: withoutOverride(daySchedule, laborerId) });
  };

  const laborersForDay = (daySchedule: ActualDaySchedule): Laborer[] =>
    availableLaborers.filter(l => daySchedule.laborerIds.includes(l.id));

  const dayLaborCost = (daySchedule: ActualDaySchedule): number =>
    laborersForDay(daySchedule).reduce(
      (sum, l) => sum + l.fullyLoadedRate * getActualLaborerHours(daySchedule, l.id),
      0
    );

  const totalCrewHours = getActualCrewHours(schedule);
  const totalLaborCost = schedule.reduce((sum, s) => sum + dayLaborCost(s), 0);
  const daysDelta = plannedDays != null ? schedule.length - plannedDays : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-slate-700" />
          <h4 className="text-sm font-semibold text-slate-900">Actual Daily Schedule</h4>
        </div>
        <div className="flex items-center gap-3">
          {plannedDays != null && (
            <span className="text-xs text-slate-500">
              {schedule.length} {schedule.length === 1 ? 'day' : 'days'} · planned {plannedDays}
              {daysDelta !== 0 && (
                <span className={daysDelta > 0 ? 'text-red-600 font-medium' : 'text-green-700 font-medium'}>
                  {' '}({daysDelta > 0 ? '+' : ''}{daysDelta})
                </span>
              )}
            </span>
          )}
          <button
            type="button"
            onClick={addDay}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium bg-gf-lime text-white hover:bg-gf-dark-green transition-colors"
          >
            <Plus size={14} /> Add Day
          </button>
        </div>
      </div>

      {schedule.length === 0 ? (
        <p className="text-xs text-slate-500">No install days recorded yet. Add a day to log actual hours.</p>
      ) : (
        <div className="space-y-3">
          {schedule.map((daySchedule) => {
            const selectedLaborers = laborersForDay(daySchedule);

            return (
              <div
                key={daySchedule.day}
                className="border border-slate-200 rounded-lg p-3 sm:p-4 bg-white"
              >
                {/* Day header with default hours */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-900">
                      Day {daySchedule.day}
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-600">Hours:</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={daySchedule.hours}
                        onChange={(e) => updateDay(daySchedule.day, { hours: parseFloat(e.target.value) || 0 })}
                        className="w-20 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-gf-lime"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {selectedLaborers.length > 0 && (
                      <span className="text-xs text-slate-600">
                        {daySchedule.laborerIds.reduce((s, id) => s + getActualLaborerHours(daySchedule, id), 0).toFixed(1)} crew hrs
                        {' = '}${dayLaborCost(daySchedule).toFixed(2)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeDay(daySchedule.day)}
                      title="Remove this day"
                      className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Laborer selection */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-2">
                    Laborers for Day {daySchedule.day}
                  </label>
                  {availableLaborers.length === 0 ? (
                    <p className="text-xs text-slate-500">No laborers available. Add laborers in Settings.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {availableLaborers.map((laborer) => {
                        const isSelected = daySchedule.laborerIds.includes(laborer.id);
                        return (
                          <button
                            key={laborer.id}
                            type="button"
                            onClick={() => toggleLaborer(daySchedule.day, laborer.id)}
                            className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                              isSelected
                                ? 'bg-gf-lime text-white'
                                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
                            }`}
                          >
                            {laborer.name} (${laborer.fullyLoadedRate}/hr)
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Per-laborer hours — defaults to the day's hours until edited */}
                {selectedLaborers.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-500 mb-2">
                      Hours per person (defaults to {daySchedule.hours}h — change only if someone worked a different shift)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedLaborers.map((laborer) => {
                        const isOverridden = getActualHourOverrides(daySchedule).some(o => o.laborerId === laborer.id);
                        const hours = getActualLaborerHours(daySchedule, laborer.id);
                        return (
                          <div key={laborer.id} className="flex items-center gap-2">
                            <span className="flex-1 text-xs text-slate-700 truncate">{laborer.name}</span>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={hours}
                              onChange={(e) => setLaborerHours(daySchedule.day, laborer.id, parseFloat(e.target.value) || 0)}
                              className={`w-20 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-gf-lime ${
                                isOverridden ? 'border-gf-lime bg-green-50 font-medium' : 'border-slate-300'
                              }`}
                            />
                            <span className="text-xs text-slate-400 w-3">h</span>
                            <button
                              type="button"
                              onClick={() => clearLaborerHours(daySchedule.day, laborer.id)}
                              title="Reset to day hours"
                              disabled={!isOverridden}
                              className={`p-1 rounded transition-colors ${
                                isOverridden
                                  ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                                  : 'text-transparent cursor-default'
                              }`}
                            >
                              <RotateCcw size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      <div className="bg-green-50 rounded-lg p-3 border border-green-200">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-gf-dark-green mb-1">Total Days</p>
            <p className="font-semibold text-gf-dark-green">{schedule.length}</p>
          </div>
          <div>
            <p className="text-gf-dark-green mb-1">On-Site Hours</p>
            <p className="font-semibold text-gf-dark-green">
              {schedule.reduce((sum, s) => sum + getActualDayDurationHours(s), 0).toFixed(1)}h
            </p>
          </div>
          <div>
            <p className="text-gf-dark-green mb-1">Crew Hours</p>
            <p className="font-semibold text-gf-dark-green">{totalCrewHours.toFixed(1)}h</p>
          </div>
          <div>
            <p className="text-gf-dark-green mb-1">Total Labor Cost</p>
            <p className="font-semibold text-gf-dark-green">${totalLaborCost.toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
