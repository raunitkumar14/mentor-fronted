import { useMemo, useState } from "react";
import { mapCustomFieldCode } from "./customFieldLabels.js";
import VerticalBarChart from "./VerticalBarChart.jsx";
import ScoreCards from "./ScoreCards.jsx";

// Raw ids are mapped through customFieldMapping.json (the single label
// source). Leads with no disposition are left out of the chart (the count
// is reported beside the total instead); an id the mapping doesn't know is
// kept and shown as "Unmapped (<id>)" so it stays visible.
function dispositionItems(rows) {
  return rows
    .filter((row) => row.id !== null && row.id !== undefined)
    .map((row) => {
      const mapped = mapCustomFieldCode("cfTelecallerDisposition", row.id);
      const known = mapped !== String(row.id);
      return {
        key: String(row.id),
        label: known ? mapped : `Unmapped (${row.id})`,
        value: row.count,
      };
    });
}

function reasonItems(rows) {
  return rows
    .filter((row) => row.reason !== null && row.reason !== undefined && row.reason !== "")
    .map((row) => ({ key: String(row.reason), label: String(row.reason), value: row.count }));
}

function Total({ label, value, children }) {
  return (
    <p className="analysis-total">
      {label} <span className="num">{value.toLocaleString()}</span>
      {children}
    </p>
  );
}

const VIEWS = [
  { key: "active", label: "Active Leads" },
  { key: "waste", label: "Waste Leads" },
];

export default function LeadsBreakdown({ data, title = "Leads Breakdown", subtitle = "Leads updated this range" }) {
  const [view, setView] = useState("active");
  const active = useMemo(() => dispositionItems(data?.activeDispositions ?? []), [data]);
  const waste = useMemo(() => reasonItems(data?.wasteReasons ?? []), [data]);

  const noDisposition =
    (data?.activeDispositions ?? []).find((r) => r.id === null || r.id === undefined)?.count ?? 0;

  return (
    <section className="timeline-section">
      <div className="timeline-header">
        <div>
          <h2 className="section-title">{title}</h2>
          <p className="section-subtitle">{subtitle}</p>
        </div>
        <div className="view-toggle" role="tablist" aria-label="Leads breakdown category">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={view === v.key}
              className={`view-toggle-btn${view === v.key ? " active" : ""}`}
              onClick={() => setView(v.key)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <ScoreCards
        items={[
          { label: "Total Leads", value: (data?.activeTotal ?? 0) + (data?.wasteTotal ?? 0) },
          { label: "Active Leads", value: data?.activeTotal ?? 0 },
          { label: "Waste Leads", value: data?.wasteTotal ?? 0 },
          { label: "Active, No Disposition", value: noDisposition },
        ]}
      />

      <div className="analytics-subsection">
        {view === "active" ? (
          <>
            <h3 className="subsection-title">Active Leads by Telecaller Disposition</h3>
            <Total label="Total Active Leads" value={data?.activeTotal ?? 0}>
              {noDisposition > 0 && (
                <>
                  {" "}
                  · <span className="num">{noDisposition.toLocaleString()}</span> with no
                  disposition not shown
                </>
              )}
            </Total>
            <VerticalBarChart
              items={active}
              ariaLabel="Active leads by telecaller disposition"
              emptyMessage="No active leads with a disposition in this range."
            />
          </>
        ) : (
          <>
            <h3 className="subsection-title">Waste Leads by Pipeline Stage Reason</h3>
            <Total label="Total Waste Leads" value={data?.wasteTotal ?? 0} />
            <VerticalBarChart
              items={waste}
              ariaLabel="Waste leads by pipeline stage reason"
              emptyMessage="No waste leads with a reason in this range."
            />
          </>
        )}
      </div>
    </section>
  );
}
