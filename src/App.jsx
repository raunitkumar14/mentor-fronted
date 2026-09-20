import { useEffect, useMemo, useState } from "react";
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

// Fixed order/position within each group — a manager should be able to
// find "connect rate" in the same cell every time, not hunt for it.
//
// "Leads Assigned" comes from /api/metrics, which scopes by LEAD creation
// date, not call date: it finds leads created in the selected range, then
// sums every call ever made to those leads (any date). A call attempted
// here may have happened after the range ended. (Its duration figures —
// Total Call Duration, Avg Call Duration/Lead — are shown alongside Call
// Duration Distribution in CallAnalytics.jsx instead of up here, since
// both describe the same connected-call durations.)
//
// "Attempted" only means a call was placed (any outcome, including a
// no-answer); "Connected" is the stricter subset where a call actually
// went through. Attempted = Connected + Unconnected, and Not Attempted +
// Attempted = Total Leads.
//
// "Total Calls This Range" is the opposite scope — it dates by the
// CALL, not the lead (same axis as the Call Log Analysis chart
// below), so it can include calls to leads assigned before this range
// started. "On Same-Day Leads" vs "On Older Leads" splits by whether the
// called lead was itself created on that same call's day, or earlier —
// unrelated to the chart's own "new"/"followup" split, which is about
// same-day repeat contact, not lead age.
const STAT_GROUPS = [
  {
    label: "Leads Assigned This Range",
    source: "metrics",
    stats: [
      { key: "totalLeads", label: "Total Leads", format: (m) => m.totalLeads },
      { key: "leadsNotAttempted", label: "Not Attempted", format: (m) => m.leadsNotAttempted },
      { key: "leadsAttempted", label: "Attempted", format: (m) => m.leadsAttempted },
      {
        key: "leadsConnected",
        label: "Connected",
        format: (m) => `${m.leadsConnected} (${m.connectRatePct}%)`,
      },
      { key: "leadsUnconnected", label: "Unconnected", format: (m) => m.leadsUnconnected },
    ],
  },
  {
    label: "Total Calls This Range",
    source: "callFunnel",
    stats: [
      { key: "totalAttempted", label: "Total Calls", format: (f) => f.totalAttempted },
      {
        key: "totalConnected",
        label: "Connected",
        format: (f) => `${f.totalConnected} (${f.connectRatePct}%)`,
      },
      { key: "todayLeadCalls", label: "On Same-Day Leads", format: (f) => f.todayLeadCalls },
      { key: "olderLeadCalls", label: "On Older Leads", format: (f) => f.olderLeadCalls },
      { key: "avgCallsPerLead", label: "Avg Calls / Lead", format: (f) => f.avgCallsPerLead },
    ],
  },
];

// Renders the group's title above the bordered stat-box, not inside it,
// so the accent border wraps only the metrics grid.
function renderStatCard(group, data, className = "") {
  if (!data) return null;
  return (
    <div className={`stat-card${className ? ` ${className}` : ""}`} key={group.label}>
      <span className="stat-group-label">{group.label}</span>
      <div className="stat-box">
        <div className="stat-grid">
          {group.stats.map((s) => (
            <div className="stat" key={s.key}>
              <span className="stat-label">{s.label}</span>
              <span className="stat-value num">{s.format(data)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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

  // Summed client-side from the same per-day rows the Attempted Calls
  // Analysis chart renders, so this can't drift from the chart it echoes.
  const callFunnel = useMemo(() => {
    if (!callAttempts || !callAnalytics) return null;
    const overall = callAnalytics.connectRateOverall ?? {
      totalAttempted: 0,
      totalConnected: 0,
      connectRatePct: 0,
    };
    const todayLeadCalls = (callAttempts.leadAgeByDay ?? []).reduce(
      (sum, d) => sum + (d.counts.todayLead ?? 0),
      0
    );
    const olderLeadCalls = (callAttempts.leadAgeByDay ?? []).reduce(
      (sum, d) => sum + (d.counts.olderLead ?? 0),
      0
    );
    const distinctLeads = callAttempts.distinctLeads ?? 0;
    const avgCallsPerLead =
      distinctLeads > 0 ? (overall.totalAttempted / distinctLeads).toFixed(1) : "—";
    return {
      totalAttempted: overall.totalAttempted,
      totalConnected: overall.totalConnected,
      connectRatePct: overall.connectRatePct,
      todayLeadCalls,
      olderLeadCalls,
      avgCallsPerLead,
    };
  }, [callAttempts, callAnalytics]);

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
          <div className="stat-groups-row">
            {renderStatCard(STAT_GROUPS[0], metrics)}
            {renderStatCard(STAT_GROUPS[1], callFunnel)}
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
