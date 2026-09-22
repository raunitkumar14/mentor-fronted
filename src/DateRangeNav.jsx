import { useMemo } from "react";

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

// Monday-start week, matching a work-week review cadence rather than a
// calendar-start (Sunday) week.
function startOfWeek(d) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + diff);
  return start;
}

function endOfWeek(d) {
  const start = startOfWeek(d);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function shiftWeek(d, delta) {
  const shifted = new Date(d);
  shifted.setDate(d.getDate() + delta * 7);
  return shifted;
}

function shiftMonth(d, delta) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function shiftDay(d, delta) {
  const shifted = new Date(d);
  shifted.setDate(d.getDate() + delta);
  return shifted;
}

// Single date, not a dash-joined span — Week/Month always cover more than
// one day, but Day mode's start and end are the same date by definition.
function formatDayLabel(d) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Used for both Week and Month mode — a month is just a range whose
// boundaries happen to be the 1st and last day, so it gets the same
// explicit-dates treatment. Both ends always carry a month name (never
// collapsed to a bare day number, which reads ambiguously) — only the
// start's year is dropped when it matches the end's.
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

const MODES = [
  { key: "custom", label: "Custom" },
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

export default function DateRangeNav({ mode, start, end, onChange }) {
  function setMode(nextMode) {
    if (nextMode === mode) return;
    if (nextMode === "custom") {
      onChange({ mode: nextMode, start, end });
      return;
    }
    if (nextMode === "day") {
      // Anchors on the current range's start date — end collapses to match
      // it, since a Day selection is always start === end.
      onChange({ mode: nextMode, start, end: start });
      return;
    }
    const anchor = parseISODate(start);
    const range =
      nextMode === "week"
        ? { start: startOfWeek(anchor), end: endOfWeek(anchor) }
        : { start: startOfMonth(anchor), end: endOfMonth(anchor) };
    onChange({ mode: nextMode, start: toISODate(range.start), end: toISODate(range.end) });
  }

  function step(delta) {
    const anchor = parseISODate(start);
    let range;
    if (mode === "day") {
      const s = shiftDay(anchor, delta);
      range = { start: s, end: s };
    } else if (mode === "week") {
      const s = shiftWeek(anchor, delta);
      range = { start: s, end: endOfWeek(s) };
    } else {
      const s = shiftMonth(anchor, delta);
      range = { start: startOfMonth(s), end: endOfMonth(s) };
    }
    onChange({ mode, start: toISODate(range.start), end: toISODate(range.end) });
  }

  const label = useMemo(() => {
    if (mode === "custom") return null;
    if (mode === "day") return formatDayLabel(parseISODate(start));
    return formatRangeLabel(parseISODate(start), parseISODate(end));
  }, [mode, start, end]);

  return (
    <div className="range-nav-group">
      <div className="view-toggle" role="tablist" aria-label="Date range mode">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={mode === m.key}
            className={`view-toggle-btn${mode === m.key ? " active" : ""}`}
            onClick={() => setMode(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode !== "custom" && (
        <div className="range-nav-controls">
          <button
            type="button"
            className="range-nav-arrow"
            onClick={() => step(-1)}
            aria-label={`Previous ${mode}`}
          >
            ‹
          </button>
          <span className="range-nav-label num">{label}</span>
          <button
            type="button"
            className="range-nav-arrow"
            onClick={() => step(1)}
            aria-label={`Next ${mode}`}
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}

export { toISODate };
