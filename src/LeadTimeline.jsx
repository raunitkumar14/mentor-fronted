import { useMemo, useState } from "react";
import { computeLabelIndices, formatDateColumnLabels } from "./chartLabels.js";

function formatShortDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const BAR_WIDTH = 20;
const BAR_GAP = 12;
const CHART_HEIGHT = 220;
const AXIS_PAD_LEFT = 32;
const AXIS_PAD_TOP = 14;
const AXIS_PAD_BOTTOM = 28;
const SEGMENT_GAP = 2;
const Y_TICKS = 4;
// Minimum horizontal room (px) a "20 Aug"-style label needs so consecutive
// x-axis labels never overlap once a range spans many days.
const MIN_LABEL_SPACING = 42;
// `.chart-scroll` needs overflow-x for wide ranges, and the CSS spec forces
// overflow-y to "auto" as soon as overflow-x isn't "visible" — so a tooltip
// anchored above a near-max-height bar gets its top edge clipped by that
// implicit vertical scroll unless we keep it below this floor.
const MIN_TOOLTIP_TOP = 100;

export default function LeadTimeline({ timeline, owners, viewMode }) {
  const [hover, setHover] = useState(null); // { index, x, y }

  const ownerNameById = useMemo(() => {
    const map = new Map();
    owners.forEach((o) => map.set(String(o.id), o.name));
    return map;
  }, [owners]);

  const hasDays = timeline && timeline.days.length > 0;

  const totals = useMemo(() => {
    if (!hasDays) return null;
    return timeline.dayWise.reduce(
      (acc, d) => ({
        assigned: acc.assigned + d.assigned,
        connected: acc.connected + d.connected,
        notConnected: acc.notConnected + d.notConnected,
      }),
      { assigned: 0, connected: 0, notConnected: 0 }
    );
  }, [timeline, hasDays]);

  // Per-owner sums (assigned + connected) for the telecaller-wise table's
  // Total column — summed client-side from counts the API already returns,
  // so it can't drift from the per-cell figures.
  const ownerTotals = useMemo(() => {
    if (!hasDays) return new Map();
    const map = new Map();
    timeline.ownerWise.forEach((row) => {
      const assigned = Object.values(row.counts).reduce((a, b) => a + b, 0);
      const connected = Object.values(row.connected).reduce((a, b) => a + b, 0);
      map.set(row.ownerId, { assigned, connected });
    });
    return map;
  }, [timeline, hasDays]);

  // The Total row reuses timeline.dayWise (already the assigned/connected
  // totals across every selected owner for that day) instead of re-summing
  // ownerWise client-side, so it can never drift from the day-wise chart's
  // own numbers.
  const dayTotals = useMemo(() => {
    if (!hasDays) return {};
    const map = {};
    timeline.dayWise.forEach((row) => {
      map[row.date] = { assigned: row.assigned, connected: row.connected };
    });
    return map;
  }, [timeline, hasDays]);

  const grandTotal = hasDays
    ? [...ownerTotals.values()].reduce(
        (acc, t) => ({ assigned: acc.assigned + t.assigned, connected: acc.connected + t.connected }),
        { assigned: 0, connected: 0 }
      )
    : { assigned: 0, connected: 0 };

  const plotHeight = CHART_HEIGHT - AXIS_PAD_TOP - AXIS_PAD_BOTTOM;
  const maxTotal = hasDays
    ? Math.max(1, ...timeline.dayWise.map((d) => d.assigned))
    : 1;
  const plotWidth = hasDays ? timeline.days.length * (BAR_WIDTH + BAR_GAP) + BAR_GAP : 0;
  const labelStep = Math.max(1, Math.ceil(MIN_LABEL_SPACING / (BAR_WIDTH + BAR_GAP)));
  const labelIndices = hasDays
    ? computeLabelIndices(timeline.dayWise.length, labelStep)
    : new Set();

  function yFor(value) {
    return AXIS_PAD_TOP + plotHeight - (value / maxTotal) * plotHeight;
  }

  const tickValues = Array.from({ length: Y_TICKS + 1 }, (_, i) =>
    Math.round((maxTotal / Y_TICKS) * i)
  );

  const hoverRow = hover !== null ? timeline.dayWise[hover.index] : null;

  const columnLabels = useMemo(
    () => (hasDays ? formatDateColumnLabels(timeline.days) : []),
    [timeline, hasDays]
  );

  return (
    <section className="timeline-section">
      <div className="timeline-header">
        <div>
          <h2 className="section-title">Lead Assignment &amp; Connection</h2>
          <p className="section-subtitle">Lead assigned this range</p>
        </div>
      </div>

      {!hasDays ? (
        <p className="empty">No leads assigned in this range.</p>
      ) : viewMode === "date" ? (
        <>
          <div className="timeline-legend">
            <span className="legend-item">
              <span className="legend-swatch legend-swatch-connected" />
              Connected <span className="num">{totals.connected}</span>
            </span>
            <span className="legend-item">
              <span className="legend-swatch legend-swatch-not-connected" />
              Not Connected <span className="num">{totals.notConnected}</span>
            </span>
            <span className="legend-item legend-item-total">
              Total <span className="num">{totals.assigned}</span>
            </span>
          </div>

          <div className="chart-scroll">
            <div className="chart-plot" style={{ width: plotWidth + AXIS_PAD_LEFT }}>
              <svg
                width={plotWidth + AXIS_PAD_LEFT}
                height={CHART_HEIGHT}
                role="img"
                aria-label="Day-wise assigned leads, connected versus not connected"
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

                {timeline.dayWise.map((row, i) => {
                  const x = AXIS_PAD_LEFT + BAR_GAP + i * (BAR_WIDTH + BAR_GAP);
                  const baseline = AXIS_PAD_TOP + plotHeight;
                  const connectedH = (row.connected / maxTotal) * plotHeight;
                  const notConnectedH = (row.notConnected / maxTotal) * plotHeight;
                  const hasBoth = row.connected > 0 && row.notConnected > 0;
                  const gap = hasBoth ? SEGMENT_GAP : 0;
                  const connectedY = baseline - connectedH;
                  const notConnectedY = connectedY - gap - notConnectedH;
                  const showLabel = labelIndices.has(i);

                  return (
                    <g
                      key={row.date}
                      onMouseEnter={() =>
                        setHover({ index: i, x: x + BAR_WIDTH / 2, y: yFor(row.assigned) })
                      }
                      onMouseLeave={() => setHover((h) => (h?.index === i ? null : h))}
                      onFocus={() =>
                        setHover({ index: i, x: x + BAR_WIDTH / 2, y: yFor(row.assigned) })
                      }
                      onBlur={() => setHover((h) => (h?.index === i ? null : h))}
                      tabIndex={0}
                    >
                      <title>
                        {`${row.date}: ${row.assigned} assigned — ${row.connected} connected, ${row.notConnected} not connected`}
                      </title>
                      <rect
                        x={x}
                        y={AXIS_PAD_TOP}
                        width={BAR_WIDTH}
                        height={plotHeight}
                        fill="transparent"
                      />
                      {row.connected > 0 && (
                        <rect
                          x={x}
                          y={connectedY}
                          width={BAR_WIDTH}
                          height={connectedH}
                          rx={2}
                          className="bar-connected"
                        />
                      )}
                      {row.notConnected > 0 && (
                        <rect
                          x={x}
                          y={notConnectedY}
                          width={BAR_WIDTH}
                          height={notConnectedH}
                          rx={2}
                          className="bar-not-connected"
                        />
                      )}
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
                <div
                  className="chart-tooltip"
                  style={{ left: hover.x, top: Math.max(hover.y, MIN_TOOLTIP_TOP) }}
                >
                  <div className="chart-tooltip-date">{formatShortDate(hoverRow.date)}</div>
                  <div className="chart-tooltip-row">
                    <span>
                      <span className="legend-swatch legend-swatch-connected" />
                      Connected
                    </span>
                    <span className="num">{hoverRow.connected}</span>
                  </div>
                  <div className="chart-tooltip-row">
                    <span>
                      <span className="legend-swatch legend-swatch-not-connected" />
                      Not Connected
                    </span>
                    <span className="num">{hoverRow.notConnected}</span>
                  </div>
                  <div className="chart-tooltip-row chart-tooltip-total">
                    <span>Total</span>
                    <span className="num">{hoverRow.assigned}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="timeline-table-wrap">
          <p className="table-cell-legend">Each cell: assigned · connected</p>
          <table>
            <thead>
              <tr>
                <th>Owner</th>
                {timeline.days.map((d, i) => (
                  <th key={d} className="num">
                    {columnLabels[i]}
                  </th>
                ))}
                <th className="num table-total-header">Total</th>
              </tr>
            </thead>
            <tbody>
              {timeline.ownerWise.map((row) => {
                const total = ownerTotals.get(row.ownerId);
                return (
                  <tr key={row.ownerId}>
                    <td>{ownerNameById.get(String(row.ownerId)) ?? row.ownerId}</td>
                    {timeline.days.map((d) => (
                      <td key={d} className="num cell-stack">
                        <span className="cell-primary">{row.counts[d] ?? 0}</span>
                        <span className="cell-secondary">{row.connected[d] ?? 0}</span>
                      </td>
                    ))}
                    <td className="num table-total-cell cell-stack">
                      <span className="cell-primary">{total.assigned}</span>
                      <span className="cell-secondary">{total.connected}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                {timeline.days.map((d) => {
                  const t = dayTotals[d] ?? { assigned: 0, connected: 0 };
                  return (
                    <td key={d} className="num cell-stack">
                      <span className="cell-primary">{t.assigned}</span>
                      <span className="cell-secondary">{t.connected}</span>
                    </td>
                  );
                })}
                <td className="num table-total-cell cell-stack">
                  <span className="cell-primary">{grandTotal.assigned}</span>
                  <span className="cell-secondary">{grandTotal.connected}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
