import { useState } from "react";

const SIZE = 168;
const STROKE = 28;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// A visible gap between touching slices (the "surface gap" spacer) instead
// of a stroke — trimmed off the end of each slice's drawn arc so slices
// read as distinct without adding non-data ink.
const GAP = 2;

// A count/percentage donut for a small (<=3 typical) set of categories —
// OTP status, exam mode, registration. The legend row for every slice is
// always visible (not just on hover), which both satisfies "identity is
// never color alone" and, per the dataviz skill, is the relief channel
// required for the palette's light-mode contrast-vs-surface WARN on a
// couple of slots.
export default function DonutChart({ items, ariaLabel, emptyMessage, totalLabel = "Total" }) {
  const [hoverKey, setHoverKey] = useState(null);

  const total = (items ?? []).reduce((sum, it) => sum + it.value, 0);
  if (!items || items.length === 0 || total === 0) {
    return <p className="empty">{emptyMessage}</p>;
  }

  let cumulative = 0;
  const slices = items
    .filter((it) => it.value > 0)
    .map((it) => {
      const fraction = it.value / total;
      const rawLength = fraction * CIRCUMFERENCE;
      const offset = cumulative;
      cumulative += rawLength;
      return { ...it, length: Math.max(rawLength - GAP, 0), offset, pct: fraction * 100 };
    });

  return (
    <div className="donut-chart">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={ariaLabel}>
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          {slices.map((s) => (
            <circle
              key={s.key}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={s.color}
              strokeWidth={STROKE}
              strokeDasharray={`${s.length} ${CIRCUMFERENCE - s.length}`}
              strokeDashoffset={-s.offset}
              opacity={hoverKey && hoverKey !== s.key ? 0.4 : 1}
              onMouseEnter={() => setHoverKey(s.key)}
              onMouseLeave={() => setHoverKey((k) => (k === s.key ? null : k))}
              onFocus={() => setHoverKey(s.key)}
              onBlur={() => setHoverKey((k) => (k === s.key ? null : k))}
              tabIndex={0}
            >
              <title>{`${s.label}: ${s.value} (${s.pct.toFixed(1)}%)`}</title>
            </circle>
          ))}
        </g>
        <text x={SIZE / 2} y={SIZE / 2 - 4} textAnchor="middle" className="donut-center-value num">
          {total.toLocaleString()}
        </text>
        <text x={SIZE / 2} y={SIZE / 2 + 16} textAnchor="middle" className="donut-center-label">
          {totalLabel}
        </text>
      </svg>

      <ul className="donut-legend">
        {slices.map((s) => (
          <li
            key={s.key}
            className={`donut-legend-item${hoverKey === s.key ? " active" : ""}`}
            onMouseEnter={() => setHoverKey(s.key)}
            onMouseLeave={() => setHoverKey((k) => (k === s.key ? null : k))}
          >
            <span className="legend-swatch" style={{ background: s.color }} />
            <span className="donut-legend-label">{s.label}</span>
            <span className="donut-legend-value num">
              {s.value.toLocaleString()} ({s.pct.toFixed(1)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
