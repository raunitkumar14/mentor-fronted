// Row of headline totals shown at the top of an analysis. Reuses the Lead
// Dashboard's summary-card styling. `value` may be a number (formatted with
// thousands separators) or a ready-made string (e.g. a duration).
// `singleRow` keeps every card on one line, sharing the width equally.
export default function ScoreCards({ items, singleRow = false }) {
  return (
    <div className={`lead-summary-row${singleRow ? " lead-summary-row-single" : ""}`}>
      {items.map((it) => (
        <div className="lead-summary-card" key={it.label}>
          <span className="stat-label">{it.label}</span>
          <span className="stat-value num lead-summary-value">
            {typeof it.value === "number" ? it.value.toLocaleString() : it.value}
          </span>
        </div>
      ))}
    </div>
  );
}
