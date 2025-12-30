import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import type { InstallDaySchedule, Laborer } from '../types';

interface InstallDayScheduleProps {
  installDays: number;
  schedule: InstallDaySchedule[];
  availableLaborers: Laborer[];
  onChange: (schedule: InstallDaySchedule[]) => void;
}

export default function InstallDayScheduleComponent({
  installDays,
  schedule,
  availableLaborers,
  onChange,
}: InstallDayScheduleProps) {
  const [localSchedule, setLocalSchedule] = useState<InstallDaySchedule[]>(schedule);

  // Update local schedule when installDays changes
  useEffect(() => {
    const days = Math.max(1, installDays);
    const newSchedule: InstallDaySchedule[] = [];

    for (let i = 1; i <= days; i++) {
      const existing = localSchedule.find(s => s.day === i);
      newSchedule.push(
        existing || {
          day: i,
          hours: 8, // Default 8 hours
          laborerIds: [],
        }
      );
    }

    setLocalSchedule(newSchedule);
    onChange(newSchedule);
  }, [installDays]);

  const updateDayHours = (day: number, hours: number) => {
    const updated = localSchedule.map(s =>
      s.day === day ? { ...s, hours } : s
    );
    setLocalSchedule(updated);
    onChange(updated);
  };

  const toggleLaborer = (day: number, laborerId: string) => {
    const updated = localSchedule.map(s => {
      if (s.day === day) {
        const laborerIds = s.laborerIds.includes(laborerId)
          ? s.laborerIds.filter(id => id !== laborerId)
          : [...s.laborerIds, laborerId];
        return { ...s, laborerIds };
      }
      return s;
    });
    setLocalSchedule(updated);
    onChange(updated);
  };

  const getSelectedLaborersForDay = (day: number): Laborer[] => {
    const daySchedule = localSchedule.find(s => s.day === day);
    if (!daySchedule) return [];
    return availableLaborers.filter(l => daySchedule.laborerIds.includes(l.id));
  };

  const getDayLaborRate = (day: number): number => {
    const laborers = getSelectedLaborersForDay(day);
    return laborers.reduce((sum, l) => sum + l.fullyLoadedRate, 0);
  };

  if (installDays < 1) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock size={18} className="text-slate-700" />
        <h4 className="text-sm font-semibold text-slate-900">Daily Schedule</h4>
      </div>

      <div className="space-y-3">
        {localSchedule.map((daySchedule) => {
          const selectedLaborers = getSelectedLaborersForDay(daySchedule.day);
          const dayRate = getDayLaborRate(daySchedule.day);

          return (
            <div
              key={daySchedule.day}
              className="border border-slate-200 rounded-lg p-3 sm:p-4 bg-slate-50"
            >
              {/* Day header with hours */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-900">
                    Day {daySchedule.day}
                  </span>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-600">Hours:</label>
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={daySchedule.hours}
                      onChange={(e) => updateDayHours(daySchedule.day, parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                {selectedLaborers.length > 0 && (
                  <div className="text-xs text-slate-600">
                    Rate: ${dayRate.toFixed(2)}/hr × {daySchedule.hours}h = ${(dayRate * daySchedule.hours).toFixed(2)}
                  </div>
                )}
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
                              ? 'bg-blue-600 text-white'
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
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-blue-600 mb-1">Total Days</p>
            <p className="font-semibold text-blue-900">{localSchedule.length}</p>
          </div>
          <div>
            <p className="text-blue-600 mb-1">Total Hours</p>
            <p className="font-semibold text-blue-900">
              {localSchedule.reduce((sum, s) => sum + s.hours, 0).toFixed(1)}h
            </p>
          </div>
          <div>
            <p className="text-blue-600 mb-1">Avg Hours/Day</p>
            <p className="font-semibold text-blue-900">
              {(localSchedule.reduce((sum, s) => sum + s.hours, 0) / localSchedule.length).toFixed(1)}h
            </p>
          </div>
          <div>
            <p className="text-blue-600 mb-1">Total Labor Cost</p>
            <p className="font-semibold text-blue-900">
              $
              {localSchedule
                .reduce((sum, s) => {
                  const laborers = getSelectedLaborersForDay(s.day);
                  const dayRate = laborers.reduce((r, l) => r + l.fullyLoadedRate, 0);
                  return sum + dayRate * s.hours;
                }, 0)
                .toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
