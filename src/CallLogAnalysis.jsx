import { useMemo, useState } from "react";
import CallAttemptsTimeline from "./CallAttemptsTimeline.jsx";
import ScoreCards from "./ScoreCards.jsx";

function formatDuration(totalSeconds) {
  const s = Math.round(totalSeconds || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

const sumValues = (obj) => Object.values(obj ?? {}).reduce((a, b) => a + b, 0);

// Whole-range totals, summed from the same per-day rows the tables render
// so the cards can't drift from them.
function callLogTotals(timeline) {
  const days = timeline?.outcomeByDay ?? [];
  const calls = days.reduce((n, d) => n + d.total, 0);
  const connected = days.reduce((n, d) => n + d.connected, 0);
  const table = timeline?.outcomeTable ?? [];
  const leads = timeline?.distinctLeads ?? 0;
  return [
    { label: "Total Calls", value: calls },
    { label: "Connected", value: connected },
    { label: "Not Connected", value: calls - connected },
    { label: "Incoming", value: table.reduce((n, r) => n + sumValues(r.incoming), 0) },
    { label: "Outgoing", value: table.reduce((n, r) => n + sumValues(r.outgoing), 0) },
    { label: "Total Duration", value: formatDuration(table.reduce((n, r) => n + r.totalDurationSec, 0)) },
    { label: "Unique Leads", value: leads },
    { label: "Avg Calls / Lead", value: leads > 0 ? (calls / leads).toFixed(1) : "—" },
  ];
}

const VIEWS = [
  { key: "date", label: "Date-wise" },
  { key: "telecaller", label: "Telecaller-wise" },
];

// Call Log Analysis with its scorecards on top. Telecaller-wise is the
// default; with `allowDateWise` (Cumulative Report only) a Date-wise /
// Telecaller-wise switch sits above it, as on Call Coverage. Without it
// (Daily Report) the analysis is Telecaller-wise only.
export default function CallLogAnalysis({ timeline, owners, allowDateWise = false }) {
  const [view, setView] = useState("telecaller");
  const cards = useMemo(() => callLogTotals(timeline), [timeline]);

  return (
    <>
      {allowDateWise && (
        <div className="page-view-toggle view-toggle" role="tablist" aria-label="Call log view">
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
      )}

      <CallAttemptsTimeline
        timeline={timeline}
        owners={owners}
        viewMode={allowDateWise ? view : "telecaller"}
        scorecards={<ScoreCards items={cards} singleRow />}
      />
    </>
  );
}
