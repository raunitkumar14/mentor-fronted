import { useMemo, useState } from "react";
import { computeLabelIndices, formatDateColumnLabels } from "./chartLabels.js";
import { BUCKET_OPACITY } from "./constants.js";

// Full phrasing for the tooltip; a terse form for the axis tick, since all
// six buckets must stay visible at once — there's no thinning headroom to
// hide any of these.
const DURATION_LABELS = {
  "0-1": "0–1 min",
  "1-2": "1–2 min",
  "2-3": "2–3 min",
  "3-4": "3–4 min",
  "4-5": "4–5 min",
  "5+": ">5 min",
};
const DURATION_AXIS_LABELS = {
  "0-1": "0–1",
  "1-2": "1–2",
  "2-3": "2–3",
  "3-4": "3–4",
  "4-5": "4–5",
  "5+": ">5",
};

const BAR_WIDTH = 20;
const BAR_GAP = 12;
const CHART_HEIGHT = 200;
const AXIS_PAD_LEFT = 32;
const AXIS_PAD_TOP = 14;
const AXIS_PAD_BOTTOM = 28;
const Y_TICKS = 4;
const MIN_LABEL_SPACING = 34;
// See LeadTimeline.jsx: `.chart-scroll`'s overflow-x forces overflow-y to
// "auto" too, so a tooltip anchored above a near-max-height bar would get
// its top edge clipped unless kept below this floor.
const MIN_TOOLTIP_TOP = 90;

// A single-series vertical bar chart — same axis/gridline/tooltip mechanics
// as the day-wise charts, just one bar per category instead of a stack.
function SimpleBarChart({ items, ariaLabel, emptyMessage }) {
  const [hover, setHover] = useState(null); // { index, x, y }

  if (items.length === 0) {
    return <p className="empty">{emptyMessage}</p>;
  }

  const plotHeight = CHART_HEIGHT - AXIS_PAD_TOP - AXIS_PAD_BOTTOM;
  const maxValue = Math.max(1, ...items.map((it) => it.value));
  const plotWidth = items.length * (BAR_WIDTH + BAR_GAP) + BAR_GAP;
  // A short, fixed category list (e.g. the 6 duration buckets) always shows
  // every label; thinning only kicks in once there are enough categories
  // that showing all of them would crowd.
  const labelStep =
    items.length <= 8
      ? 1
      : Math.max(1, Math.ceil(MIN_LABEL_SPACING / (BAR_WIDTH + BAR_GAP)));
  const labelIndices = computeLabelIndices(items.length, labelStep);
  const baseline = AXIS_PAD_TOP + plotHeight;

  function yFor(value) {
    return AXIS_PAD_TOP + plotHeight - (value / maxValue) * plotHeight;
  }

  const tickValues = Array.from({ length: Y_TICKS + 1 }, (_, i) =>
    Math.round((maxValue / Y_TICKS) * i)
  );

  const hoverItem = hover !== null ? items[hover.index] : null;

  return (
    <div className="chart-scroll">
      <div className="chart-plot" style={{ width: plotWidth + AXIS_PAD_LEFT }}>
        <svg
          width={plotWidth + AXIS_PAD_LEFT}
          height={CHART_HEIGHT}
          role="img"
          aria-label={ariaLabel}
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

          {items.map((item, i) => {
            const x = AXIS_PAD_LEFT + BAR_GAP + i * (BAR_WIDTH + BAR_GAP);
            const height = (item.value / maxValue) * plotHeight;
            const showLabel = labelIndices.has(i);

            return (
              <g
                key={item.key}
                onMouseEnter={() =>
                  setHover({ index: i, x: x + BAR_WIDTH / 2, y: yFor(item.value) })
                }
                onMouseLeave={() => setHover((h) => (h?.index === i ? null : h))}
                onFocus={() =>
                  setHover({ index: i, x: x + BAR_WIDTH / 2, y: yFor(item.value) })
                }
                onBlur={() => setHover((h) => (h?.index === i ? null : h))}
                tabIndex={0}
              >
                <title>{`${item.label}: ${item.value} calls`}</title>
                <rect
                  x={x}
                  y={AXIS_PAD_TOP}
                  width={BAR_WIDTH}
                  height={plotHeight}
                  fill="transparent"
                />
                {item.value > 0 && (
                  <rect
                    x={x}
                    y={baseline - height}
                    width={BAR_WIDTH}
                    height={height}
                    rx={2}
                    className="bar-connected"
                  />
                )}
                {showLabel && (
                  <text
                    x={x + BAR_WIDTH / 2}
                    y={baseline + 18}
                    className="chart-axis-label"
                    textAnchor="middle"
                  >
                    {item.axisLabel ?? item.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {hoverItem && (
          <div className="chart-tooltip" style={{ left: hover.x, top: Math.max(hover.y, MIN_TOOLTIP_TOP) }}>
            <div className="chart-tooltip-date">{hoverItem.label}</div>
            <div className="chart-tooltip-row">
              <span>Calls</span>
              <span className="num">{hoverItem.value}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CallsPerLead({ metrics }) {
  if (!metrics || metrics.totalLeads === 0) {
    return <p className="empty">No leads in this range.</p>;
  }

  return (
    <div className="dist">
      {["0", "1", "2", "3+"].map((bucket) => {
        const count = metrics.callsPerLeadDistribution[bucket] ?? 0;
        const pct = metrics.totalLeads ? (count / metrics.totalLeads) * 100 : 0;
        return (
          <div className="dist-row" key={bucket}>
            <span className="dist-label">{bucket}</span>
            <div className="dist-track">
              <div
                className="dist-fill"
                style={{ width: `${pct}%`, opacity: BUCKET_OPACITY[bucket] }}
              />
            </div>
            <span className="dist-count num">
              {count} ({pct.toFixed(1)}%)
            </span>
          </div>
        );
      })}
    </div>
  );
}

const CALLS_PER_LEAD_BUCKETS = ["0", "1", "2", "3+"];

function CallsPerLeadByOwnerTable({ rows, ownerNameById }) {
  if (rows.length === 0) {
    return <p className="empty">No leads in this range.</p>;
  }

  const columnTotals = CALLS_PER_LEAD_BUCKETS.reduce((acc, b) => {
    acc[b] = rows.reduce((sum, r) => sum + (r.distribution[b] ?? 0), 0);
    return acc;
  }, {});
  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

  return (
    <div className="timeline-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Telecaller</th>
            {CALLS_PER_LEAD_BUCKETS.map((b) => (
              <th key={b} className="num">
                {b}
              </th>
            ))}
            <th className="num table-total-header">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.ownerId}>
              <td>{ownerNameById.get(String(row.ownerId)) ?? row.ownerId}</td>
              {CALLS_PER_LEAD_BUCKETS.map((b) => (
                <td key={b} className="num">
                  {row.distribution[b] ?? 0}
                </td>
              ))}
              <td className="num table-total-cell">{row.total}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            {CALLS_PER_LEAD_BUCKETS.map((b) => (
              <td key={b} className="num">
                {columnTotals[b]}
              </td>
            ))}
            <td className="num table-total-cell">{grandTotal}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function DurationByOwnerTable({ rows, ownerNameById }) {
  if (rows.length === 0) {
    return <p className="empty">No connected calls in this range.</p>;
  }

  const buckets = Object.keys(DURATION_AXIS_LABELS);
  const columnTotals = buckets.reduce((acc, b) => {
    acc[b] = rows.reduce((sum, r) => sum + (r.buckets[b] ?? 0), 0);
    return acc;
  }, {});
  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

  return (
    <div className="timeline-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Telecaller</th>
            {buckets.map((b) => (
              <th key={b} className="num">
                {DURATION_AXIS_LABELS[b]}
              </th>
            ))}
            <th className="num table-total-header">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.ownerId}>
              <td>{ownerNameById.get(String(row.ownerId)) ?? row.ownerId}</td>
              {buckets.map((b) => (
                <td key={b} className="num">
                  {row.buckets[b] ?? 0}
                </td>
              ))}
              <td className="num table-total-cell">{row.total}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            {buckets.map((b) => (
              <td key={b} className="num">
                {columnTotals[b]}
              </td>
            ))}
            <td className="num table-total-cell">{grandTotal}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ConnectRateTable({ days, rows, owners, ownerTotals }) {
  const ownerNameById = useMemo(() => {
    const map = new Map();
    owners.forEach((o) => map.set(String(o.id), o.name));
    return map;
  }, [owners]);

  const totalsByOwnerId = useMemo(() => {
    const map = new Map();
    (ownerTotals ?? []).forEach((t) => map.set(t.ownerId, t));
    return map;
  }, [ownerTotals]);

  if (days.length === 0 || rows.length === 0) {
    return <p className="empty">No calls attempted in this range.</p>;
  }

  const columnLabels = formatDateColumnLabels(days);

  return (
    <div className="timeline-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Telecaller</th>
            {days.map((d, i) => (
              <th key={d} className="num">
                {columnLabels[i]}
              </th>
            ))}
            <th className="num table-total-header">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const t = totalsByOwnerId.get(row.ownerId);
            return (
              <tr key={row.ownerId}>
                <td>{ownerNameById.get(String(row.ownerId)) ?? row.ownerId}</td>
                {days.map((d) => {
                  const rate = row.rates[d];
                  return (
                    <td key={d} className="num">
                      {rate === null || rate === undefined ? "—" : `${rate}%`}
                    </td>
                  );
                })}
                <td className="num table-total-cell">
                  {t && t.totalAttempted > 0
                    ? `${t.connectRatePct}% (${t.totalConnected}/${t.totalAttempted})`
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function CallAnalytics({ analytics, owners, metrics, viewMode }) {
  const ownerNameById = useMemo(() => {
    const map = new Map();
    (owners ?? []).forEach((o) => map.set(String(o.id), o.name));
    return map;
  }, [owners]);

  const durationItems = useMemo(() => {
    if (!analytics) return [];
    return analytics.durationDistribution.map((row) => ({
      key: row.bucket,
      label: DURATION_LABELS[row.bucket] ?? row.bucket,
      axisLabel: DURATION_AXIS_LABELS[row.bucket] ?? row.bucket,
      value: row.count,
    }));
  }, [analytics]);

  // Summed client-side from the same bucket counts the chart renders, so it
  // can't drift from the bars.
  const totalDurationCalls = useMemo(
    () => durationItems.reduce((sum, it) => sum + it.value, 0),
    [durationItems]
  );

  const overall = analytics?.connectRateOverall;

  return (
    <section className="timeline-section">
      <div className="timeline-header">
        <div>
          <h2 className="section-title">Call Analytics</h2>
        </div>
      </div>

      <div className="analytics-grid">
        <div className="analytics-subsection">
          <h3 className="subsection-title">Calls per Lead</h3>
          {metrics && metrics.totalLeads > 0 && (
            <p className="analysis-total">
              Total <span className="num">{metrics.totalLeads}</span> leads
            </p>
          )}
          {viewMode === "telecaller" ? (
            <CallsPerLeadByOwnerTable
              rows={metrics?.callsPerLeadDistributionByOwner ?? []}
              ownerNameById={ownerNameById}
            />
          ) : (
            <CallsPerLead metrics={metrics} />
          )}
        </div>

        <div className="analytics-subsection">
          <h3 className="subsection-title">Call Duration Distribution</h3>
          {totalDurationCalls > 0 && (
            <p className="analysis-total">
              Total <span className="num">{totalDurationCalls}</span> connected calls
            </p>
          )}
          {viewMode === "telecaller" ? (
            <DurationByOwnerTable
              rows={analytics?.durationByOwner ?? []}
              ownerNameById={ownerNameById}
            />
          ) : (
            <SimpleBarChart
              items={durationItems}
              ariaLabel="Distribution of connected calls by duration bucket"
              emptyMessage="No connected calls in this range."
            />
          )}
        </div>
      </div>

      <div className="analytics-subsection">
        <h3 className="subsection-title">Connected Rate — Telecaller &amp; Date</h3>
        {overall && overall.totalAttempted > 0 && (
          <p className="analysis-total">
            Total <span className="num">{overall.totalAttempted}</span> attempted ·{" "}
            <span className="num">{overall.connectRatePct}%</span> connected overall
          </p>
        )}
        <ConnectRateTable
          days={analytics?.days ?? []}
          rows={analytics?.connectRateByOwnerDate ?? []}
          owners={owners}
          ownerTotals={analytics?.connectRateOwnerTotals}
        />
      </div>
    </section>
  );
}
