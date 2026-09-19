import { useEffect, useState } from "react";
import {
  getOwners,
  getMetrics,
  getLeadTimeline,
  getCallAttemptsTimeline,
  getCallAnalytics,
} from "./api.js";
import OwnerMultiSelect from "./OwnerMultiSelect.jsx";
import LeadTimeline from "./LeadTimeline.jsx";
import CallAttemptsTimeline from "./CallAttemptsTimeline.jsx";
import CallAnalytics from "./CallAnalytics.jsx";
import DateRangeNav, { toISODate } from "./DateRangeNav.jsx";
import CalendarRangePicker from "./CalendarRangePicker.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

function todayMinus(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toISODate(d);
}

function formatDisplayRange(startIso, endIso) {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startFmt = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
  const endFmt = end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startFmt} – ${endFmt}`;
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

// Fixed order/position within each group — a manager should be able to
// find "connect rate" in the same cell every time, not hunt for it.
//
// Both groups come from /api/metrics, which scopes by LEAD creation date,
// not call date: it finds leads created in the selected range, then sums
// every call ever made to those leads (any date) and their durations. A
// call attempted or a minute logged here may have happened after the
// range ended — the group labels below say so, so "Total Call Attempts"
// isn't misread as "calls dialed in this range" (that's the separately
// call-date-scoped Attempted Calls Analysis / Call Analytics sections).
const STAT_GROUPS = [
  {
    label: "Leads Assigned This Range",
    stats: [
      { key: "totalLeads", label: "Total Leads", format: (m) => m.totalLeads },
      { key: "totalCallAttempts", label: "Total Call Attempts", format: (m) => m.totalCallAttempts },
      { key: "leadsWithNoCall", label: "Total No Call", format: (m) => m.leadsWithNoCall },
      { key: "leadsWithCalls", label: "Total Connected Calls", format: (m) => m.leadsWithCalls },
      { key: "connectRatePct", label: "Total Connect Rate", format: (m) => `${m.connectRatePct}%` },
    ],
  },
  {
    label: "Duration — Same Leads",
    stats: [
      { key: "totalCallDurationSec", label: "Total Call Duration", format: (m) => formatDuration(m.totalCallDurationSec) },
      { key: "avgCallDurationSec", label: "Avg Call Duration / Lead", format: (m) => formatDuration(m.avgCallDurationSec) },
    ],
  },
];

export default function App() {
  const [owners, setOwners] = useState([]);
  const [ownerIds, setOwnerIds] = useState([]);
  const [rangeMode, setRangeMode] = useState("custom");
  const [start, setStart] = useState(todayMinus(30));
  const [end, setEnd] = useState(todayMinus(0));
  const [pageView, setPageView] = useState("date");
  const [metrics, setMetrics] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [callAttempts, setCallAttempts] = useState(null);
  const [callAnalytics, setCallAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getOwners()
      .then((data) => {
        setOwners(data);
        if (data.length > 0) setOwnerIds([String(data[0].id)]);
      })
      .catch((err) => setError(err.message));
  }, []);

  async function handleLoad(range) {
    if (ownerIds.length === 0) return;
    const rangeStart = range?.start ?? start;
    const rangeEnd = range?.end ?? end;
    setLoading(true);
    setError(null);
    try {
      const [metricsData, timelineData, callAttemptsData, callAnalyticsData] = await Promise.all([
        getMetrics({ ownerIds, start: rangeStart, end: rangeEnd }),
        getLeadTimeline({ ownerIds, start: rangeStart, end: rangeEnd }),
        getCallAttemptsTimeline({ ownerIds, start: rangeStart, end: rangeEnd }),
        getCallAnalytics({ ownerIds, start: rangeStart, end: rangeEnd }),
      ]);
      setMetrics(metricsData);
      setTimeline(timelineData);
      setCallAttempts(callAttemptsData);
      setCallAnalytics(callAnalyticsData);
    } catch (err) {
      setError(err.message);
      setMetrics(null);
      setTimeline(null);
      setCallAttempts(null);
      setCallAnalytics(null);
    } finally {
      setLoading(false);
    }
  }

  // Fired by the week/month navigator: switching modes or stepping
  // prev/next adjusts start/end itself, then re-loads immediately — the
  // point of navigating range-wise is seeing the next period without an
  // extra click on a manager already mid-review.
  function handleRangeChange({ mode, start: newStart, end: newEnd }) {
    setRangeMode(mode);
    setStart(newStart);
    setEnd(newEnd);
    if (ownerIds.length > 0) handleLoad({ start: newStart, end: newEnd });
  }

  return (
    <main className="page">
      <header className="topbar">
        <div className="topbar-head">
          <h1>Call Coverage</h1>
          <ThemeToggle />
        </div>
        <div className="filters">
          <label className="field">
            <span>Owners</span>
            <OwnerMultiSelect owners={owners} selectedIds={ownerIds} onChange={setOwnerIds} />
          </label>

          <DateRangeNav mode={rangeMode} start={start} end={end} onChange={handleRangeChange} />

          {rangeMode === "custom" && (
            <label className="field">
              <span>Range</span>
              <CalendarRangePicker
                start={start}
                end={end}
                onChange={(range) =>
                  handleRangeChange({ mode: "custom", start: range.start, end: range.end })
                }
              />
            </label>
          )}

          <button className="btn" onClick={() => handleLoad()} disabled={ownerIds.length === 0 || loading}>
            {loading ? "Loading…" : "Load"}
          </button>
        </div>
      </header>

      <div className="page-view-toggle view-toggle" role="tablist" aria-label="Page view">
        <button
          type="button"
          role="tab"
          aria-selected={pageView === "date"}
          className={`view-toggle-btn${pageView === "date" ? " active" : ""}`}
          onClick={() => setPageView("date")}
        >
          Date-wise
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pageView === "telecaller"}
          className={`view-toggle-btn${pageView === "telecaller" ? " active" : ""}`}
          onClick={() => setPageView("telecaller")}
        >
          Telecaller-wise
        </button>
      </div>

      {error && <p className="state state-error">Error: {error}</p>}

      {!metrics && !loading && !error && (
        <p className="state">Pick an owner and date range, then Load.</p>
      )}

      {metrics && (
        <>
          <p className="applied-range">
            Showing {formatDisplayRange(start, end)}
            {ownerIds.length > 0 && ` · ${ownerIds.length} owner${ownerIds.length === 1 ? "" : "s"}`}
          </p>

          <div className="stat-groups">
            {STAT_GROUPS.map((group) => (
              <div className="stat-group" key={group.label}>
                <span className="stat-group-label">{group.label}</span>
                <div className="stat-grid">
                  {group.stats.map((s) => (
                    <div className="stat" key={s.key}>
                      <span className="stat-label">{s.label}</span>
                      <span className="stat-value num">{s.format(metrics)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="chart-grid">
            <LeadTimeline timeline={timeline} owners={owners} viewMode={pageView} />

            <CallAttemptsTimeline timeline={callAttempts} owners={owners} viewMode={pageView} />
          </div>

          <CallAnalytics
            analytics={callAnalytics}
            owners={owners}
            metrics={metrics}
            viewMode={pageView}
          />
        </>
      )}
    </main>
  );
}
