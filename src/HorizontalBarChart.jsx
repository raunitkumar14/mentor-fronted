// Horizontal bars for categories with long or numerous labels (course
// names, class names) — the label sits in its own left-hand column with
// room to wrap, so there's no x-axis to crowd and no rotation/truncation
// tradeoff to make regardless of label length or category count.
export default function HorizontalBarChart({ items, ariaLabel, emptyMessage, unitLabel = "leads" }) {
  if (!items || items.length === 0) {
    return <p className="empty">{emptyMessage}</p>;
  }

  const max = Math.max(1, ...items.map((it) => it.value));

  return (
    <div className="hbar-chart" role="img" aria-label={ariaLabel}>
      {items.map((item) => {
        const pct = (item.value / max) * 100;
        return (
          <div className="hbar-row" key={item.key} title={`${item.label}: ${item.value} ${unitLabel}`}>
            <span className="hbar-label">{item.label}</span>
            <div className="hbar-track">
              {item.value > 0 && (
                <div className="hbar-fill" style={{ width: `${pct}%`, background: item.color }} />
              )}
            </div>
            <span className="hbar-value num">{item.value.toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
}
