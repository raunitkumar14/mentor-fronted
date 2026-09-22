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

// Monday-start grid, matching the week convention used elsewhere in the app.
// Always 42 cells (6 full weeks) so the panel's height never jumps between
// months.
function buildGrid(viewMonth) {
  const first = startOfMonth(viewMonth);
  const firstWeekday = first.getDay(); // 0=Sun..6=Sat
  const leadingDays = firstWeekday === 0 ? 6 : firstWeekday - 1;
  const gridStart = addDays(first, -leadingDays);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// Both ends always carry a month name (never collapsed to a bare day
// number, which reads ambiguously) — only the start's year is dropped
// when it matches the end's.
function formatRangeLabel(start, end) {
  const sameYear = start.getFullYear() === end.getFullYear();
  const startFmt = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
  const endFmt = end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startFmt} – ${endFmt}`;
}

export default function CalendarRangePicker({ start, end, onChange }) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(parseISODate(start)));
  // Set once the first date of a new range is clicked; cleared once the
  // second click commits the range. Null means "show the committed range."
  const [anchor, setAnchor] = useState(null);
  const [hoverIso, setHoverIso] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setAnchor(null);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const startDate = parseISODate(start);
  const endDate = parseISODate(end);

  // Mid-selection, preview the span between the anchor and whichever day
  // the pointer is currently over; otherwise show the already-committed range.
  const [previewStartIso, previewEndIso] = anchor
    ? [anchor, hoverIso ?? anchor].sort()
    : [start, end];

  function openPanel() {
    setViewMonth(startOfMonth(startDate));
    setAnchor(null);
    setOpen(true);
  }

  function handleDayClick(iso) {
    if (!anchor) {
      setAnchor(iso);
      return;
    }
    const [newStart, newEnd] = [anchor, iso].sort();
    onChange({ start: newStart, end: newEnd });
    setAnchor(null);
    setOpen(false);
  }

  const grid = buildGrid(viewMonth);

  return (
    <div className="cal-picker" ref={rootRef}>
      <button
        type="button"
        className="owner-select-trigger cal-picker-trigger"
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {formatRangeLabel(startDate, endDate)}
      </button>

      {open && (
        <div className="cal-picker-panel" role="dialog" aria-label="Choose date range">
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

          <div className="cal-picker-grid" onMouseLeave={() => setHoverIso(null)}>
            {grid.map((d) => {
              const iso = toISODate(d);
              const inMonth = d.getMonth() === viewMonth.getMonth();
              const inRange = iso >= previewStartIso && iso <= previewEndIso;
              const isEndpoint = iso === previewStartIso || iso === previewEndIso;
              const isToday = iso === toISODate(new Date());
              return (
                <button
                  type="button"
                  key={iso}
                  className={[
                    "cal-picker-day",
                    !inMonth && "cal-picker-day-out",
                    inRange && "cal-picker-day-in-range",
                    isEndpoint && "cal-picker-day-endpoint",
                    isToday && "cal-picker-day-today",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => handleDayClick(iso)}
                  onMouseEnter={() => setHoverIso(iso)}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div className="cal-picker-hint">
            {anchor ? "Pick an end date" : "Pick a start date"}
          </div>
        </div>
      )}
    </div>
  );
}
