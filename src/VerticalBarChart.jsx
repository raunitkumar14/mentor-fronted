import { useEffect, useRef, useState } from "react";

// Minimum slot per bar; when the container is wider than the bars need, the
// slots stretch so the chart fills the full width. Narrower than this and
// the chart scrolls horizontally instead.
const MIN_SLOT = 40;
const BAR_FILL = 0.62;
const CHART_HEIGHT = 260;
const AXIS_PAD_LEFT = 44;
const AXIS_PAD_TOP = 24;
// Room for the 45°-rotated category labels, which are long (e.g.
// "PARENT_DISCUSSION_PENDING"); the chart scrolls horizontally past
// the container width rather than thinning labels away.
const AXIS_PAD_BOTTOM = 140;
const Y_TICKS = 4;
const MIN_TOOLTIP_TOP = 90;
const MAX_LABEL_CHARS = 28;

function truncate(text) {
  return text.length > MAX_LABEL_CHARS ? `${text.slice(0, MAX_LABEL_CHARS - 1)}…` : text;
}

// Single-series vertical bars — same axis, gridline and tooltip mechanics
// as CallAnalytics' SimpleBarChart, but for categories with long names, so
// every label is kept and rotated.
export default function VerticalBarChart({ items, ariaLabel, emptyMessage, unitLabel = "Leads" }) {
  const [hover, setHover] = useState(null); // { index, x, y }
  const wrapRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items?.length]);

  if (!items || items.length === 0) {
    return <p className="empty">{emptyMessage}</p>;
  }

  const plotHeight = CHART_HEIGHT - AXIS_PAD_TOP - AXIS_PAD_BOTTOM;
  const rawMax = Math.max(1, ...items.map((it) => it.value));
  const tickStep = Math.max(1, Math.ceil(rawMax / Y_TICKS));
  const axisMax = tickStep * Y_TICKS;
  const tickValues = Array.from({ length: Y_TICKS + 1 }, (_, i) => tickStep * i);
  const slot = Math.max(MIN_SLOT, (containerWidth - AXIS_PAD_LEFT) / items.length);
  const barWidth = Math.round(slot * BAR_FILL);
  const plotWidth = items.length * slot;
  const baseline = AXIS_PAD_TOP + plotHeight;

  const yFor = (value) => baseline - (value / axisMax) * plotHeight;
  const hoverItem = hover !== null ? items[hover.index] : null;

  return (
    <div className="chart-scroll" ref={wrapRef}>
      <div className="chart-plot" style={{ width: plotWidth + AXIS_PAD_LEFT }}>
        <svg width={plotWidth + AXIS_PAD_LEFT} height={CHART_HEIGHT} role="img" aria-label={ariaLabel}>
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
                {v.toLocaleString()}
              </text>
            </g>
          ))}

          {items.map((item, i) => {
            const x = AXIS_PAD_LEFT + i * slot + (slot - barWidth) / 2;
            const height = (item.value / axisMax) * plotHeight;
            const cx = x + barWidth / 2;
            const show = () => setHover({ index: i, x: cx, y: yFor(item.value) });
            const hide = () => setHover((h) => (h?.index === i ? null : h));

            return (
              <g key={item.key} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} tabIndex={0}>
                <title>{`${item.label}: ${item.value} ${unitLabel.toLowerCase()}`}</title>
                <rect x={AXIS_PAD_LEFT + i * slot} y={AXIS_PAD_TOP} width={slot} height={plotHeight} fill="transparent" />
                {item.value > 0 && (
                  <rect x={x} y={baseline - height} width={barWidth} height={height} rx={2} className="bar-connected" />
                )}
                <text x={cx} y={baseline - height - 5} className="chart-axis-label" textAnchor="middle">
                  {item.value.toLocaleString()}
                </text>
                <text
                  x={cx}
                  y={baseline + 10}
                  className="chart-axis-label"
                  textAnchor="end"
                  transform={`rotate(-45 ${cx} ${baseline + 10})`}
                >
                  {truncate(item.label)}
                </text>
              </g>
            );
          })}
        </svg>

        {hoverItem && (
          <div className="chart-tooltip" style={{ left: hover.x, top: Math.max(hover.y, MIN_TOOLTIP_TOP) }}>
            <div className="chart-tooltip-date">{hoverItem.label}</div>
            <div className="chart-tooltip-row">
              <span>{unitLabel}</span>
              <span className="num">{hoverItem.value.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
