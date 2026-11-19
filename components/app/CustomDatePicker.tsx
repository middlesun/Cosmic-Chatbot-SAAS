import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD or ''
  onChange: (nextDate: string) => void;
  placeholder?: string;
  required?: boolean;
  ariaLabel?: string;
  minYear?: number;
  maxYear?: number;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function parseIsoDate(iso: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function toIsoDate(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function formatDisplayDate(iso: string): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) return '';
  return `${String(parsed.day).padStart(2, '0')} ${SHORT_MONTHS[parsed.month]} ${parsed.year}`;
}

const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select date of birth',
  required = false,
  ariaLabel = 'Select date',
  minYear = 1920,
  maxYear = new Date().getFullYear(),
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const parsed = useMemo(() => parseIsoDate(value), [value]);

  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'days' | 'months' | 'years'>('days');
  const [viewYear, setViewYear] = useState<number>(() => parsed?.year || 1995);
  const [viewMonth, setViewMonth] = useState<number>(() => parsed?.month ?? 0);

  useEffect(() => {
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
  }, [parsed]);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setViewMode('days');
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setViewMode('days');
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const calendarDays = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
    // Monday-first grid: Mon=0 .. Sun=6
    const startOffset = (firstOfMonth.getDay() + 6) % 7;

    const cells: Array<{ day: number | null; iso: string | null }> = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push({ day: null, iso: null });
    }
    for (let d = 1; d <= totalDays; d++) {
      cells.push({ day: d, iso: toIsoDate(viewYear, viewMonth, d) });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const yearsList = useMemo(() => {
    const arr: number[] = [];
    for (let y = maxYear; y >= minYear; y--) {
      arr.push(y);
    }
    return arr;
  }, [minYear, maxYear]);

  const todayIso = useMemo(() => {
    const now = new Date();
    return toIsoDate(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const stepMonth = (delta: number) => {
    let nextMonth = viewMonth + delta;
    let nextYear = viewYear;
    if (nextMonth < 0) {
      nextMonth = 11;
      nextYear = Math.max(minYear, viewYear - 1);
    } else if (nextMonth > 11) {
      nextMonth = 0;
      nextYear = Math.min(maxYear, viewYear + 1);
    }
    setViewMonth(nextMonth);
    setViewYear(nextYear);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Hidden native input keeps browser form required validation working cleanly */}
      {required && (
        <input
          type="text"
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value}
          onChange={() => {}}
          className="sr-only pointer-events-none"
        />
      )}

      <div
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen((prev) => !prev);
          setViewMode('days');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen((prev) => !prev);
            setViewMode('days');
          }
        }}
        className="w-full flex items-center justify-between gap-2 rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#3D3830] hover:border-[#3D3830]/35 focus:border-[#4A453D] focus:outline-none cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Calendar className="h-4 w-4 text-[#8B8275] shrink-0" />
          <span
            className={`truncate ${
              value
                ? "font-['DM_Sans',sans-serif] tabular-nums text-[#3D3830]"
                : 'text-[#8B8275]'
            }`}
          >
            {value ? formatDisplayDate(value) : placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              aria-label="Clear birth date"
              className="p-0.5 rounded text-[#8B8275] hover:text-[#3D3830]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 text-[#8B8275] transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </div>

      {isOpen && (
        <div className="animate-cc-dropdown-down absolute left-0 top-full mt-2 z-50 w-[308px] max-w-[calc(100vw-2rem)] rounded-2xl border border-[#3D3830]/15 bg-[#FDFBF7] shadow-[0_22px_50px_-14px_rgba(61,56,48,0.22)] p-4">
          {/* Calendar Header: Quick Month & Year Jump */}
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#3D3830]/10">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setViewMode((m) => (m === 'months' ? 'days' : 'months'))}
                className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                  viewMode === 'months'
                    ? 'bg-[#4A453D] text-[#FAF7F2]'
                    : 'bg-[#F1ECE3] text-[#3D3830] hover:bg-[#EAE3D7]'
                }`}
              >
                {MONTH_NAMES[viewMonth]}
              </button>
              <button
                type="button"
                onClick={() => setViewMode((m) => (m === 'years' ? 'days' : 'years'))}
                className={`rounded-lg px-2 py-1 text-xs font-['DM_Sans',sans-serif] tabular-nums font-medium transition-colors ${
                  viewMode === 'years'
                    ? 'bg-[#4A453D] text-[#FAF7F2]'
                    : 'bg-[#F1ECE3] text-[#3D3830] hover:bg-[#EAE3D7]'
                }`}
              >
                {viewYear}
              </button>
            </div>

            {viewMode === 'days' && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => stepMonth(-1)}
                  aria-label="Previous month"
                  className="p-1.5 rounded-lg text-[#5C5449] hover:bg-[#F1ECE3] hover:text-[#3D3830] transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => stepMonth(1)}
                  aria-label="Next month"
                  className="p-1.5 rounded-lg text-[#5C5449] hover:bg-[#F1ECE3] hover:text-[#3D3830] transition-colors"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* View 1: Fast Month Selector */}
          {viewMode === 'months' && (
            <div className="grid grid-cols-3 gap-1.5 pt-3">
              {SHORT_MONTHS.map((mLabel, mIdx) => {
                const active = mIdx === viewMonth;
                return (
                  <button
                    key={mLabel}
                    type="button"
                    onClick={() => {
                      setViewMonth(mIdx);
                      setViewMode('days');
                    }}
                    className={`rounded-xl py-2 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-[#4A453D] text-[#FAF7F2]'
                        : 'text-[#3D3830] hover:bg-[#F1ECE3]'
                    }`}
                  >
                    {mLabel}
                  </button>
                );
              })}
            </div>
          )}

          {/* View 2: Fast Scrollable Year Selector */}
          {viewMode === 'years' && (
            <div className="grid grid-cols-4 gap-1.5 pt-3 max-h-56 overflow-y-auto pr-1">
              {yearsList.map((yr) => {
                const active = yr === viewYear;
                return (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => {
                      setViewYear(yr);
                      setViewMode('months');
                    }}
                    className={`rounded-xl py-1.5 text-xs font-['DM_Sans',sans-serif] tabular-nums transition-colors ${
                      active
                        ? 'bg-[#4A453D] text-[#FAF7F2] font-medium'
                        : 'text-[#3D3830] hover:bg-[#F1ECE3]'
                    }`}
                  >
                    {yr}
                  </button>
                );
              })}
            </div>
          )}

          {/* View 3: Day Grid */}
          {viewMode === 'days' && (
            <div className="pt-3 space-y-1.5">
              <div className="grid grid-cols-7 text-center">
                {WEEKDAYS.map((wd) => (
                  <span
                    key={wd}
                    className="py-1 text-[10px] font-medium text-[#8B8275] uppercase tracking-wider"
                  >
                    {wd}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((cell, idx) => {
                  if (!cell.day || !cell.iso) {
                    return <div key={`empty-${idx}`} className="h-8" />;
                  }
                  const isSelected = cell.iso === value;
                  const isToday = cell.iso === todayIso;
                  return (
                    <button
                      key={cell.iso}
                      type="button"
                      onClick={() => {
                        onChange(cell.iso!);
                        setIsOpen(false);
                        setViewMode('days');
                      }}
                      className={`h-8 w-full rounded-xl text-xs font-['DM_Sans',sans-serif] tabular-nums transition-colors ${
                        isSelected
                          ? 'bg-[#4A453D] text-[#FAF7F2] font-medium'
                          : isToday
                          ? 'border border-[#B8965A] text-[#3D3830] hover:bg-[#F1ECE3]'
                          : 'text-[#3D3830] hover:bg-[#F1ECE3]'
                      }`}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Quick Actions */}
          <div className="mt-3 pt-2.5 border-t border-[#3D3830]/10 flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className="text-[#8B8275] hover:text-[#3D3830] transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(todayIso);
                setIsOpen(false);
              }}
              className="font-medium text-[#4A453D] hover:text-[#38342E] transition-colors"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomDatePicker;
