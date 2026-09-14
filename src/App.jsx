import { useEffect, useState } from "react";
import { getOwners, getMetrics } from "./api.js";

function todayMinus(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatDuration(totalSeconds) {
  const s = Math.round(totalSeconds || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function humanizeOutcome(outcome) {
  return outcome
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Bucket length already carries magnitude; opacity carries a second signal —
// the rarer, more-called buckets (the anomaly worth a manager's attention)
// read bolder even though their bars are short.
const BUCKET_OPACITY = { "0": 0.35, "1": 0.55, "2": 0.75, "3+": 1 };

// Fixed order/position — a manager should be able to find "connect rate"
// in the same grid cell every time, not hunt for it.
const STATS = [
  { key: "totalLeads", label: "Total Leads", format: (m) => m.totalLeads },
  { key: "leadsWithCalls", label: "With Calls", format: (m) => m.leadsWithCalls },
  { key: "leadsWithNoCall", label: "No Call", format: (m) => m.leadsWithNoCall },
  { key: "connectRatePct", label: "Connect Rate", format: (m) => `${m.connectRatePct}%` },
  { key: "totalCallAttempts", label: "Total Call Attempts", format: (m) => m.totalCallAttempts },
  { key: "avgCallsPerContactedLead", label: "Avg Calls / Lead", format: (m) => `${m.avgCallsPerContactedLead}x` },
  { key: "maxCallsOnLead", label: "Max On One Lead", format: (m) => m.maxCallsOnLead },
  { key: "totalCallDurationSec", label: "Total Call Duration", format: (m) => formatDuration(m.totalCallDurationSec) },
  { key: "avgCallDurationSec", label: "Avg Call Duration", format: (m) => formatDuration(m.avgCallDurationSec) },
];

export default function App() {
  const [owners, setOwners] = useState([]);
  const [ownerId, setOwnerId] = useState("");
  const [start, setStart] = useState(todayMinus(30));
  const [end, setEnd] = useState(todayMinus(0));
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getOwners()
      .then((data) => {
        setOwners(data);
        if (data.length > 0) setOwnerId(String(data[0].id));
      })
      .catch((err) => setError(err.message));
  }, []);

  async function handleLoad() {
    if (!ownerId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getMetrics({ ownerId, start, end });
      setMetrics(data);
    } catch (err) {
      setError(err.message);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }

  const outcomeRows = metrics
    ? Object.entries(metrics.outcomeBreakdown).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <main className="page">
      <header className="topbar">
        <h1>Call Coverage</h1>
        <div className="filters">
          <label className="field">
            <span>Owner</span>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Start</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>

          <label className="field">
            <span>End</span>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>

          <button className="btn" onClick={handleLoad} disabled={!ownerId || loading}>
            {loading ? "Loading…" : "Load"}
          </button>
        </div>
      </header>

      {error && <p className="state state-error">Error: {error}</p>}

      {!metrics && !loading && !error && (
        <p className="state">Pick an owner and date range, then Load.</p>
      )}

      {metrics && (
        <>
          <div className="stat-grid">
            {STATS.map((s) => (
              <div className="stat" key={s.key}>
                <span className="stat-label">{s.label}</span>
                <span className="stat-value num">{s.format(metrics)}</span>
              </div>
            ))}
          </div>

          <div className="panels">
            <section>
              <h2 className="section-title">Calls per Lead</h2>
              <p className="hint">
                How many times each lead was called — one row per lead, not per
                call, so a lead called 19 times still counts once.
              </p>
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
            </section>

            <section>
              <h2 className="section-title">Outcome Breakdown</h2>
              {outcomeRows.length === 0 ? (
                <p className="empty">No calls recorded in this range.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Outcome</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outcomeRows.map(([outcome, count]) => (
                      <tr key={outcome}>
                        <td>{humanizeOutcome(outcome)}</td>
                        <td className="num">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
