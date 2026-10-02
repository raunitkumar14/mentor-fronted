import { useEffect, useRef, useState } from "react";

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISODate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d, delta) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function addDays(d, delta) {
  const next = new Date(d);
  next.setDate(d.getDate() + delta);
  return next;
}

// Same Monday-start 42-cell grid as CalendarRangePicker, kept as a separate
// copy rather than a shared import — the two pickers commit on a different
// number of clicks (one day here vs. an anchor + endpoint there), so their
// grids evolved independently rather than forcing a shared abstraction.
function buildGrid(viewMonth) {
  const first = startOfMonth(viewMonth);
  const firstWeekday = first.getDay(); // 0=Sun..6=Sat
  const leadingDays = firstWeekday === 0 ? 6 : firstWeekday - 1;
  const gridStart = addDays(first, -leadingDays);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// Single-day companion to CalendarRangePicker, for the Day Navigator's "jump
// to any date" control — one click both selects and commits, since there's
// no second endpoint to wait for.
export default function SingleDatePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(parseISODate(value)));
  const rootRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function openPanel() {
    setViewMonth(startOfMonth(parseISODate(value)));
    setOpen(true);
  }

  function handleDayClick(iso) {
    onChange(iso);
    setOpen(false);
  }

  const grid = buildGrid(viewMonth);
  const selectedDate = parseISODate(value);

  return (
    <div className="cal-picker" ref={rootRef}>
      <button
        type="button"
        className="owner-select-trigger cal-picker-trigger"
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {selectedDate.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </button>

      {open && (
        <div className="cal-picker-panel" role="dialog" aria-label="Choose a date">
          <div className="cal-picker-nav">
            <button
              type="button"
              className="range-nav-arrow"
              onClick={() => setViewMonth((m) => addMonths(m, -1))}
              aria-label="Previous month"
            >
              ‹
            </button>
            <span className="cal-picker-month">
              {viewMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              className="range-nav-arrow"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="cal-picker-weekdays">
            {WEEKDAY_LABELS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>

          <div className="cal-picker-grid">
            {grid.map((d) => {
              const iso = toISODate(d);
              const inMonth = d.getMonth() === viewMonth.getMonth();
              const isSelected = iso === value;
              const isToday = iso === toISODate(new Date());
              return (
                <button
                  type="button"
                  key={iso}
                  className={[
                    "cal-picker-day",
                    !inMonth && "cal-picker-day-out",
                    isSelected && "cal-picker-day-endpoint",
                    isToday && "cal-picker-day-today",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => handleDayClick(iso)}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
