import { useEffect, useState } from "react";
import { getOwners, getMetrics } from "./api.js";

function todayMinus(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

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

  return (
    <main className="page">
      <h1>CRM Call-Coverage Dashboard</h1>

      <section className="filters">
        <label>
          Owner
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Start
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>

        <label>
          End
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>

        <button onClick={handleLoad} disabled={!ownerId || loading}>
          {loading ? "Loading…" : "Load"}
        </button>
      </section>

      {error && <p className="error">Error: {error}</p>}

      {metrics && (
        <section className="results">
          <div className="kpi-grid">
            <div className="kpi-card">
              <span className="kpi-value">{metrics.totalLeads}</span>
              <span className="kpi-label">Total Leads</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-value">{metrics.leadsWithCalls}</span>
              <span className="kpi-label">Leads With Calls</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-value">{metrics.leadsWithNoCall}</span>
              <span className="kpi-label">Leads With No Call</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-value">{metrics.connectRatePct}%</span>
              <span className="kpi-label">Connect Rate</span>
            </div>
          </div>

          <h2>Outcome Breakdown</h2>
          <table>
            <thead>
              <tr>
                <th>Outcome</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(metrics.outcomeBreakdown).map(([outcome, count]) => (
                <tr key={outcome}>
                  <td>{outcome}</td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
