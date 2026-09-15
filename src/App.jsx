import { useEffect, useState } from "react";
import { getOwners, getMetrics } from "./api.js";

function toISO(d) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function toISOWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function parseISOWeek(str) {
  const [yearStr, wStr] = str.split("-W");
  const year = parseInt(yearStr, 10);
  const week = parseInt(wStr, 10);
  const jan4 = new Date(year, 0, 4);
  const startOfW1 = new Date(jan4);
  startOfW1.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1);
  const monday = new Date(startOfW1);
  monday.setDate(startOfW1.getDate() + (week - 1) * 7);
  return monday;
}

function computePeriodBounds(granularity, anchor) {
  const d = new Date(anchor);
  switch (granularity) {
    case "Day":
      return { start: toISO(d), end: toISO(d) };
    case "Week": {
      const dow = d.getDay();
      const mon = new Date(d);
      mon.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { start: toISO(mon), end: toISO(sun) };
    }
    case "Month":
      return {
        start: toISO(new Date(d.getFullYear(), d.getMonth(), 1)),
        end: toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
      };
    case "Year":
      return {
        start: toISO(new Date(d.getFullYear(), 0, 1)),
        end: toISO(new Date(d.getFullYear(), 11, 31)),
      };
    default:
      return { start: toISO(d), end: toISO(d) };
  }
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

const BUCKET_OPACITY = { "0": 0.35, "1": 0.55, "2": 0.75, "3+": 1 };

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

const GRANS = ["Day", "Week", "Month", "Year"];

function formatWeekRange(anchor) {
  const { start, end } = computePeriodBounds("Week", anchor);
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const sDay = s.getDate();
  const eDay = e.getDate();
  const sMon = s.toLocaleString("en-GB", { month: "short" });
  const eMon = e.toLocaleString("en-GB", { month: "short" });
  const sYear = s.getFullYear();
  const eYear = e.getFullYear();
  if (sYear !== eYear) {
    return `(${sDay} ${sMon} ${sYear} – ${eDay} ${eMon} ${eYear})`;
  }
  if (s.getMonth() !== e.getMonth()) {
    return `(${sDay} ${sMon} – ${eDay} ${eMon})`;
  }
  return `(${sDay}–${eDay} ${eMon})`;
}

function openPicker(e) {
  try { e.target.showPicker(); } catch (_) {}
}

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR - 10 + i);

export default function App() {
  const [owners, setOwners] = useState([]);
  const [ownerId, setOwnerId] = useState("");
  const [ownersLoading, setOwnersLoading] = useState(true);
  const [ownersError, setOwnersError] = useState(null);

  const [granularity, setGranularity] = useState("Month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [activeSource, setActiveSource] = useState("period");

  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setOwnersLoading(true);
    getOwners()
      .then((data) => {
        setOwners(data);
        if (data.length > 0) setOwnerId(String(data[0].id));
      })
      .catch((err) => setOwnersError(err.message))
      .finally(() => setOwnersLoading(false));
  }, []);

  function stepPeriod(dir) {
    setActiveSource("period");
    setAnchor((prev) => {
      const d = new Date(prev);
      if (granularity === "Day") d.setDate(d.getDate() + dir);
      else if (granularity === "Week") d.setDate(d.getDate() + 7 * dir);
      else if (granularity === "Month") d.setMonth(d.getMonth() + dir);
      else if (granularity === "Year") d.setFullYear(d.getFullYear() + dir);
      return d;
    });
  }

  const today = new Date();
  const todayISO = toISO(today);
  const todayMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const todayWeek = toISOWeek(today);
  const minISO = `${today.getFullYear() - 10}-01-01`;
  const minMonth = `${today.getFullYear() - 10}-01`;
  const minWeek = `${today.getFullYear() - 10}-W01`;

  const nextAnchor = (() => {
    const d = new Date(anchor);
    if (granularity === "Day") d.setDate(d.getDate() + 1);
    else if (granularity === "Week") d.setDate(d.getDate() + 7);
    else if (granularity === "Month") d.setMonth(d.getMonth() + 1);
    else if (granularity === "Year") d.setFullYear(d.getFullYear() + 1);
    return d;
  })();
  const nextDisabled = computePeriodBounds(granularity, nextAnchor).start > todayISO;

  async function handleLoad() {
    if (!ownerId) return;
    const bounds =
      activeSource === "period"
        ? computePeriodBounds(granularity, anchor)
        : { start: customStart, end: customEnd };
    setLoading(true);
    setError(null);
    try {
      const data = await getMetrics({ ownerId, start: bounds.start, end: bounds.end });
      setMetrics(data);
    } catch (err) {
      setError(err.message);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }

  function renderPeriodPicker() {
    if (granularity === "Day") {
      return (
        <input
          type="date"
          className="period-input"
          value={toISO(anchor)}
          min={minISO}
          max={todayISO}
          onClick={openPicker}
          onFocus={openPicker}
          onChange={(e) => {
            if (e.target.value) {
              setAnchor(new Date(e.target.value + "T00:00:00"));
              setActiveSource("period");
            }
          }}
        />
      );
    }
    if (granularity === "Week") {
      return (
        <>
          <input
            type="week"
            className="period-input"
            value={toISOWeek(anchor)}
            min={minWeek}
            max={todayWeek}
            onClick={openPicker}
            onFocus={openPicker}
            onChange={(e) => {
              if (e.target.value) {
                setAnchor(parseISOWeek(e.target.value));
                setActiveSource("period");
              }
            }}
          />
          <span className="week-range">{formatWeekRange(anchor)}</span>
        </>
      );
    }
    if (granularity === "Month") {
      const monthVal = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, "0")}`;
      return (
        <input
          type="month"
          className="period-input"
          value={monthVal}
          min={minMonth}
          max={todayMonth}
          onClick={openPicker}
          onFocus={openPicker}
          onChange={(e) => {
            if (e.target.value) {
              const [y, m] = e.target.value.split("-");
              setAnchor(new Date(+y, +m - 1, 1));
              setActiveSource("period");
            }
          }}
        />
      );
    }
    // Year
    return (
      <select
        className="period-input period-input--select"
        value={anchor.getFullYear()}
        onChange={(e) => {
          setAnchor(new Date(+e.target.value, 0, 1));
          setActiveSource("period");
        }}
      >
        {YEAR_OPTIONS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    );
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
            {ownersError ? (
              <>
                <select disabled>
                  <option>Failed to load</option>
                </select>
                <span className="field-error">{ownersError}</span>
              </>
            ) : (
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                disabled={ownersLoading}
              >
                {ownersLoading ? (
                  <option value="">Loading owners…</option>
                ) : (
                  owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))
                )}
              </select>
            )}
          </label>

          <div className={`pf${activeSource === "period" ? " pf-active" : ""}`}>
            <span className="pf-label">Period</span>
            <div className="gran-tabs">
              {GRANS.map((g) => (
                <button
                  key={g}
                  className={`gran-tab${granularity === g ? " active" : ""}`}
                  onClick={() => {
                    setGranularity(g);
                    setActiveSource("period");
                  }}
                >
                  {g}
                </button>
              ))}
            </div>
            <div className="period-nav">
              <button className="nav-btn" onClick={() => stepPeriod(-1)}>◀</button>
              {renderPeriodPicker()}
              <button
                className="nav-btn"
                onClick={() => stepPeriod(1)}
                disabled={nextDisabled}
              >
                ▶
              </button>
            </div>
          </div>

          <div className={`cf${activeSource === "custom" ? " cf-active" : ""}`}>
            <span className="cf-label">Custom Date</span>
            <div className="cf-dates">
              <label className="field">
                <span>Start</span>
                <input
                  type="date"
                  value={customStart}
                  onClick={openPicker}
                  onFocus={openPicker}
                  onChange={(e) => {
                    setCustomStart(e.target.value);
                    setActiveSource("custom");
                  }}
                />
              </label>
              <label className="field">
                <span>End</span>
                <input
                  type="date"
                  value={customEnd}
                  onClick={openPicker}
                  onFocus={openPicker}
                  onChange={(e) => {
                    setCustomEnd(e.target.value);
                    setActiveSource("custom");
                  }}
                />
              </label>
            </div>
          </div>

          <button
            className="btn"
            onClick={handleLoad}
            disabled={!ownerId || loading || ownersLoading}
          >
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
