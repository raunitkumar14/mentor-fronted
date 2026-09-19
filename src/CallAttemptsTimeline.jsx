import { useMemo, useState } from "react";
import { computeLabelIndices } from "./chartLabels.js";

function formatShortDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Bottom-to-top stacking order, fixed regardless of which values are zero —
// color always follows the category, never its rank for that day.
const OUTCOME_SEGMENTS = [
  { key: "connected", label: "Connected", className: "bar-connected", opacity: 1 },
  { key: "noAnswer", label: "No Answer", className: "bar-neutral", opacity: 0.35 },
  { key: "missedCall", label: "Missed Call", className: "bar-neutral", opacity: 0.65 },
  { key: "rejected", label: "Rejected", className: "bar-neutral", opacity: 1 },
];

// Same accent-at-variable-opacity language as the Calls-per-Lead histogram
// above: a lead's first call that day is "New Lead"; any call after that
// (2nd, 3rd, ...) on the same lead the same day is "Followup" — opacity
// marks the repeat-contact signal as the stronger one, not a new hue.
const FREQ_SEGMENTS = [
  { key: "new", label: "New Lead", className: "bar-connected", opacity: 0.45 },
  { key: "followup", label: "Followup", className: "bar-connected", opacity: 1 },
];

const ANALYSIS_MODES = [
  { key: "outcome", label: "Outcome" },
  { key: "callsPerLead", label: "Calls per Lead" },
];

const BAR_WIDTH = 16;
const GROUP_GAP = 16;
const SEGMENT_GAP = 2;
const CHART_HEIGHT = 220;
const AXIS_PAD_LEFT = 32;
const AXIS_PAD_TOP = 14;
const AXIS_PAD_BOTTOM = 28;
const Y_TICKS = 4;
const MIN_LABEL_SPACING = 42;
// See LeadTimeline.jsx: `.chart-scroll`'s overflow-x forces overflow-y to
// "auto" too, so a tooltip anchored above a near-max-height bar would get
// its top edge clipped unless kept below this floor. Taller than
// LeadTimeline's because this tooltip has more rows (date + 4 segments +
// total).
const MIN_TOOLTIP_TOP = 150;

function OutcomeByOwnerTable({ rows, ownerNameById }) {
  if (rows.length === 0) {
    return <p className="empty">No calls attempted in this range.</p>;
  }

  const columnTotals = OUTCOME_SEGMENTS.reduce((acc, seg) => {
    acc[seg.key] = rows.reduce((sum, r) => sum + r[seg.key], 0);
    return acc;
  }, {});
  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

  return (
    <div className="timeline-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Telecaller</th>
            {OUTCOME_SEGMENTS.map((seg) => (
              <th key={seg.key} className="num">
                {seg.label}
              </th>
            ))}
            <th className="num table-total-header">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.ownerId}>
              <td>{ownerNameById.get(String(row.ownerId)) ?? row.ownerId}</td>
              {OUTCOME_SEGMENTS.map((seg) => (
                <td key={seg.key} className="num">
                  {row[seg.key]}
                </td>
              ))}
              <td className="num table-total-cell">{row.total}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            {OUTCOME_SEGMENTS.map((seg) => (
              <td key={seg.key} className="num">
                {columnTotals[seg.key]}
              </td>
            ))}
            <td className="num table-total-cell">{grandTotal}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function CallsPerLeadByOwnerTable({ rows, ownerNameById }) {
  if (rows.length === 0) {
    return <p className="empty">No calls attempted in this range.</p>;
  }

  const columnTotals = FREQ_SEGMENTS.reduce((acc, seg) => {
    acc[seg.key] = rows.reduce((sum, r) => sum + (r.counts[seg.key] ?? 0), 0);
    return acc;
  }, {});
  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

  return (
    <div className="timeline-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Telecaller</th>
            {FREQ_SEGMENTS.map((seg) => (
              <th key={seg.key} className="num">
                {seg.label}
              </th>
            ))}
            <th className="num table-total-header">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.ownerId}>
              <td>{ownerNameById.get(String(row.ownerId)) ?? row.ownerId}</td>
              {FREQ_SEGMENTS.map((seg) => (
                <td key={seg.key} className="num">
                  {row.counts[seg.key] ?? 0}
                </td>
              ))}
              <td className="num table-total-cell">{row.total}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            {FREQ_SEGMENTS.map((seg) => (
              <td key={seg.key} className="num">
                {columnTotals[seg.key]}
              </td>
            ))}
            <td className="num table-total-cell">{grandTotal}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function stackSegments(baseline, plotHeight, maxTotal, segments, valuesByKey) {
  let cursor = baseline;
  let started = false;
  const rendered = [];
  for (const seg of segments) {
    const value = valuesByKey[seg.key] ?? 0;
    if (value <= 0) continue;
    const height = (value / maxTotal) * plotHeight;
    if (started) cursor -= SEGMENT_GAP;
    const y = cursor - height;
    rendered.push({ ...seg, value, y, height });
    cursor = y;
    started = true;
  }
  return rendered;
}

export default function CallAttemptsTimeline({ timeline, owners, viewMode }) {
  const [hover, setHover] = useState(null); // { day, x, y }
  const [mode, setMode] = useState("outcome"); // "outcome" | "callsPerLead"

  const ownerNameById = useMemo(() => {
    const map = new Map();
    (owners ?? []).forEach((o) => map.set(String(o.id), o.name));
    return map;
  }, [owners]);

  const hasDays = timeline && timeline.days.length > 0;

  // Summed client-side from counts the API already returns per day, so
  // these can't drift from the bars/tooltips they sit next to.
  const totals = useMemo(() => {
    if (!hasDays) return null;
    const outcome = { total: 0 };
    OUTCOME_SEGMENTS.forEach((seg) => {
      outcome[seg.key] = timeline.outcomeByDay.reduce((sum, d) => sum + d[seg.key], 0);
    });
    outcome.total = timeline.outcomeByDay.reduce((sum, d) => sum + d.total, 0);

    const freq = { total: 0 };
    FREQ_SEGMENTS.forEach((seg) => {
      freq[seg.key] = timeline.callsPerLeadByDay.reduce(
        (sum, d) => sum + (d.counts[seg.key] ?? 0),
        0
      );
    });
    freq.total = timeline.callsPerLeadByDay.reduce((sum, d) => sum + d.total, 0);

    return { outcome, freq };
  }, [timeline, hasDays]);

  const segments = mode === "outcome" ? OUTCOME_SEGMENTS : FREQ_SEGMENTS;
  const rowsByDay = mode === "outcome" ? timeline?.outcomeByDay : timeline?.callsPerLeadByDay;
  const valuesByKey = (row) => (mode === "outcome" ? row : row.counts);

  const plotHeight = CHART_HEIGHT - AXIS_PAD_TOP - AXIS_PAD_BOTTOM;
  const maxTotal = hasDays
    ? Math.max(1, ...timeline.outcomeByDay.map((d) => d.total))
    : 1;
  const plotWidth = hasDays ? timeline.days.length * (BAR_WIDTH + GROUP_GAP) + GROUP_GAP : 0;
  const labelStep = Math.max(1, Math.ceil(MIN_LABEL_SPACING / (BAR_WIDTH + GROUP_GAP)));
  const labelIndices = hasDays
    ? computeLabelIndices(timeline.outcomeByDay.length, labelStep)
    : new Set();

  function yFor(value) {
    return AXIS_PAD_TOP + plotHeight - (value / maxTotal) * plotHeight;
  }

  const tickValues = Array.from({ length: Y_TICKS + 1 }, (_, i) =>
    Math.round((maxTotal / Y_TICKS) * i)
  );

  const baseline = AXIS_PAD_TOP + plotHeight;

  const hoverRow = hover ? rowsByDay?.find((r) => r.date === hover.day) : null;

  return (
    <section className="timeline-section">
      <div className="timeline-header">
        <div>
          <h2 className="section-title">Attempted Calls Analysis</h2>
        </div>
        {hasDays && (
          <div className="view-toggle" role="tablist" aria-label="Attempted calls breakdown">
            {ANALYSIS_MODES.map((m) => (
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
        )}
      </div>

      {!hasDays ? (
        <p className="empty">No calls attempted in this range.</p>
      ) : (
        <>
          <p className="analysis-total">
            Total{" "}
            <span className="num">
              {mode === "outcome" ? totals.outcome.total : totals.freq.total}
            </span>{" "}
            attempted
          </p>

          {viewMode === "telecaller" ? (
            <div className="analytics-subsection">
              <h3 className="subsection-title">
                {mode === "outcome" ? "Outcome" : "Calls per Lead"} — Telecaller
              </h3>
              {mode === "outcome" ? (
                <OutcomeByOwnerTable
                  rows={timeline.outcomeByOwner ?? []}
                  ownerNameById={ownerNameById}
                />
              ) : (
                <CallsPerLeadByOwnerTable
                  rows={timeline.callsPerLeadByOwner ?? []}
                  ownerNameById={ownerNameById}
                />
              )}
            </div>
          ) : (
          <>
          <div className="timeline-legend">
            {segments.map((seg) => (
              <span className="legend-item" key={seg.key}>
                <span
                  className={`legend-swatch ${seg.className === "bar-connected" ? "legend-swatch-accent" : "legend-swatch-neutral"}`}
                  style={{ opacity: seg.opacity }}
                />
                {seg.label}{" "}
                <span className="num">
                  {mode === "outcome" ? totals.outcome[seg.key] : totals.freq[seg.key]}
                </span>
              </span>
            ))}
          </div>

          <div className="chart-scroll">
            <div className="chart-plot" style={{ width: plotWidth + AXIS_PAD_LEFT }}>
              <svg
                width={plotWidth + AXIS_PAD_LEFT}
                height={CHART_HEIGHT}
                role="img"
                aria-label={
                  mode === "outcome"
                    ? "Day-wise attempted calls, by outcome"
                    : "Day-wise attempted calls, by calls per lead"
                }
              >
                {tickValues.map((v) => (
                  <g key={v}>
                    <line
                      x1={AXIS_PAD_LEFT}
                      x2={plotWidth + AXIS_PAD_LEFT}
                      y1={yFor(v)}
                      y2={yFor(v)}
                      className="chart-gridline"
                    />
                    <text
                      x={AXIS_PAD_LEFT - 6}
                      y={yFor(v)}
                      className="chart-axis-label"
                      textAnchor="end"
                      dominantBaseline="middle"
                    >
                      {v}
                    </text>
                  </g>
                ))}

                {rowsByDay.map((row, i) => {
                  const x = AXIS_PAD_LEFT + GROUP_GAP + i * (BAR_WIDTH + GROUP_GAP);
                  const segs = stackSegments(baseline, plotHeight, maxTotal, segments, valuesByKey(row));
                  const showLabel = labelIndices.has(i);

                  const tooltipTitle =
                    mode === "outcome"
                      ? `${row.date} outcome — ${row.total} attempted: ${row.connected} connected, ${row.noAnswer} no answer, ${row.missedCall} missed, ${row.rejected} rejected`
                      : `${row.date} calls-per-lead — ${row.total} attempted: ${row.counts.new} to new leads, ${row.counts.followup} follow-up`;

                  return (
                    <g key={row.date}>
                      <g
                        onMouseEnter={() =>
                          setHover({ day: row.date, x: x + BAR_WIDTH / 2, y: yFor(row.total) })
                        }
                        onMouseLeave={() =>
                          setHover((h) => (h?.day === row.date ? null : h))
                        }
                        onFocus={() =>
                          setHover({ day: row.date, x: x + BAR_WIDTH / 2, y: yFor(row.total) })
                        }
                        onBlur={() => setHover((h) => (h?.day === row.date ? null : h))}
                        tabIndex={0}
                      >
                        <title>{tooltipTitle}</title>
                        <rect
                          x={x}
                          y={AXIS_PAD_TOP}
                          width={BAR_WIDTH}
                          height={plotHeight}
                          fill="transparent"
                        />
                        {segs.map((seg) => (
                          <rect
                            key={seg.key}
                            x={x}
                            y={seg.y}
                            width={BAR_WIDTH}
                            height={seg.height}
                            rx={2}
                            className={seg.className}
                            style={{ opacity: seg.opacity }}
                          />
                        ))}
                      </g>

                      {showLabel && (
                        <text
                          x={x + BAR_WIDTH / 2}
                          y={baseline + 18}
                          className="chart-axis-label"
                          textAnchor="middle"
                        >
                          {formatShortDate(row.date)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {hoverRow && (
                <div className="chart-tooltip" style={{ left: hover.x, top: Math.max(hover.y, MIN_TOOLTIP_TOP) }}>
                  <div className="chart-tooltip-date">
                    {formatShortDate(hoverRow.date)} — {mode === "outcome" ? "Outcome" : "Calls per Lead"}
                  </div>
                  {segments.map((seg) => (
                    <div className="chart-tooltip-row" key={seg.key}>
                      <span>{seg.label}</span>
                      <span className="num">{valuesByKey(hoverRow)[seg.key] ?? 0}</span>
                    </div>
                  ))}
                  <div className="chart-tooltip-row chart-tooltip-total">
                    <span>Total</span>
                    <span className="num">{hoverRow.total}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          </>
          )}
        </>
      )}
    </section>
  );
}
