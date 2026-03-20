import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function formatDate(date) {
  const d = SHORT_DAY[date.getDay()];
  const m = SHORT_MONTH[date.getMonth()];
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${d} ${m} ${day} ${year}`;
}

export default function DatePicker({
  value,
  onChange,
  error,
  label = 'Select Date',
  id = 'date-picker',
  minYear = 1920,
  maxYear,
}) {
  const currentYear = new Date().getFullYear();
  const effectiveMaxYear = maxYear || currentYear;

  const parseInitial = () => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        return { month: d.getMonth(), year: d.getFullYear() };
      }
    }
    return { month: 7, year: 2000 };
  };

  const initial = parseInitial();
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(initial.month);
  const [viewYear, setViewYear] = useState(initial.year);
  const [selectedDate, setSelectedDate] = useState(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  });

  const containerRef = useRef(null);
  const calendarRef = useRef(null);
  const triggerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const goToPrevMonth = useCallback(() => {
    setViewMonth((prev) => {
      if (prev === 0) {
        setViewYear((y) => Math.max(minYear, y - 1));
        return 11;
      }
      return prev - 1;
    });
  }, [minYear]);

  const goToNextMonth = useCallback(() => {
    setViewMonth((prev) => {
      if (prev === 11) {
        setViewYear((y) => Math.min(effectiveMaxYear, y + 1));
        return 0;
      }
      return prev + 1;
    });
  }, [effectiveMaxYear]);

  const selectDay = useCallback(
    (day) => {
      const newDate = new Date(viewYear, viewMonth, day);
      setSelectedDate(newDate);
      setOpen(false);
      triggerRef.current?.focus();
      if (onChange) {
        const y = newDate.getFullYear();
        const m = String(newDate.getMonth() + 1).padStart(2, '0');
        const d = String(newDate.getDate()).padStart(2, '0');
        onChange(`${y}-${m}-${d}`);
      }
    },
    [viewYear, viewMonth, onChange]
  );

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const isSelected = (day) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === viewMonth &&
      selectedDate.getFullYear() === viewYear
    );
  };

  const isToday = (day) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === viewMonth &&
      today.getFullYear() === viewYear
    );
  };

  const displayValue = selectedDate ? formatDate(selectedDate) : '';

  // Build calendar grid
  const blanks = [];
  for (let i = 0; i < firstDay; i++) {
    blanks.push(<div key={`blank-${i}`} aria-hidden="true" />);
  }

  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const sel = isSelected(d);
    const tod = isToday(d);
    days.push(
      <button
        key={d}
        type="button"
        onClick={() => selectDay(d)}
        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 ${
          sel
            ? 'bg-primary-600 text-white font-semibold'
            : tod
            ? 'bg-primary-100 text-primary-700 font-medium'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        aria-label={`${MONTH_NAMES[viewMonth]} ${d}, ${viewYear}${sel ? ' (selected)' : ''}`}
        aria-pressed={sel}
        tabIndex={open ? 0 : -1}
      >
        {d}
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={`w-full px-3 py-2.5 border rounded-lg text-left text-sm bg-white flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
            error ? 'border-red-400 ring-1 ring-red-300' : 'border-gray-300'
          } ${!selectedDate ? 'text-gray-400' : 'text-gray-900'}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`Date of birth${selectedDate ? `: ${formatDate(selectedDate)}` : '. Click to open calendar'}`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        >
          <span>{displayValue || 'Select date of birth'}</span>
          <Calendar className="w-4.5 h-4.5 text-gray-400 flex-shrink-0" aria-hidden="true" />
        </button>

        {open && (
          <div
            ref={calendarRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Calendar. Showing ${MONTH_NAMES[viewMonth]} ${viewYear}`}
            className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-72 left-0"
          >
            {/* Month/Year navigation header */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800" aria-live="polite">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={goToPrevMonth}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  aria-label={`Previous month, ${MONTH_NAMES[viewMonth === 0 ? 11 : viewMonth - 1]} ${viewMonth === 0 ? viewYear - 1 : viewYear}`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={goToNextMonth}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  aria-label={`Next month, ${MONTH_NAMES[viewMonth === 11 ? 0 : viewMonth + 1]} ${viewMonth === 11 ? viewYear + 1 : viewYear}`}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-1" role="row">
              {DAY_NAMES.map((day) => (
                <div
                  key={day}
                  className="w-9 h-8 flex items-center justify-center text-xs font-medium text-gray-400"
                  role="columnheader"
                  aria-label={day}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7" role="grid" aria-label={`${MONTH_NAMES[viewMonth]} ${viewYear}`}>
              {blanks}
              {days}
            </div>
          </div>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="text-xs text-red-600 mt-1.5 flex items-center" role="alert" aria-live="assertive">
          <svg className="w-3.5 h-3.5 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
            <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" />
            <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
