import { useEffect, useState } from "react";
import { getOwners, getCallAttemptsTimeline, getLeadsBreakdown } from "./api.js";
import OwnerMultiSelect from "./OwnerMultiSelect.jsx";
import CallLogAnalysis from "./CallLogAnalysis.jsx";
import LeadsBreakdown from "./LeadsBreakdown.jsx";
import DailyReport from "./DailyReport.jsx";
import DateRangeNav, { toISODate } from "./DateRangeNav.jsx";
import SingleDatePicker from "./SingleDatePicker.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

const REPORT_MODES = [
  { key: "daily", label: "Daily Report" },
  { key: "cumulative", label: "Cumulative Report" },
];

function todayMinus(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toISODate(d);
}

// Lead Dashboard (Old CRM format). The Daily/Cumulative toggle comes first
// (Daily is the default view)
// and decides which filters the header shows:
// - Cumulative: Owners + Date range, applied with the Load button.
// - Daily: a single Date + multi-select Telecallers, applied immediately.
// Both reports reuse CallAttemptsTimeline (via CallLogAnalysis) so the
// Call Log Analysis tables and calculations match Call Coverage's views;
// Date-wise is offered in the Cumulative Report only.
export default function LeadCallDashboard() {
  const [owners, setOwners] = useState([]);
  const [ownerIds, setOwnerIds] = useState([]);
  const [rangeMode, setRangeMode] = useState("custom");
  const [start, setStart] = useState(todayMinus(30));
  const [end, setEnd] = useState(todayMinus(0));
  const [callAttempts, setCallAttempts] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [reportMode, setReportMode] = useState("daily"); // "daily" | "cumulative"
  const [dailyDate, setDailyDate] = useState(todayMinus(0));
  const [dailyOwnerIds, setDailyOwnerIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getOwners()
      .then((data) => {
        setOwners(data);
        if (data.length > 0) {
          setOwnerIds([String(data[0].id)]);
          setDailyOwnerIds([String(data[0].id)]);
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  async function handleLoad(range) {
    if (ownerIds.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const params = { ownerIds, start: range?.start ?? start, end: range?.end ?? end };
      const [callAttemptsData, breakdownData] = await Promise.all([
        getCallAttemptsTimeline(params),
        getLeadsBreakdown(params),
      ]);
      setCallAttempts(callAttemptsData);
      setBreakdown(breakdownData);
    } catch (err) {
      setError(err.message);
      setCallAttempts(null);
      setBreakdown(null);
    } finally {
      setLoading(false);
    }
  }

  // Week/month stepping re-loads immediately, same as Call Coverage; the
  // Owners and date-picker changes wait for the Load button.
  function handleRangeChange({ mode, start: newStart, end: newEnd }) {
    setRangeMode(mode);
    setStart(newStart);
    setEnd(newEnd);
  }

  function handleNavChange(range) {
    handleRangeChange(range);
    if (ownerIds.length > 0) handleLoad({ start: range.start, end: range.end });
  }

  return (
    <main className="page">
      <header className="topbar topbar-sticky">
        <div className="topbar-head">
          <h1>Lead Dashboard (Old CRM format)</h1>
          <ThemeToggle />
        </div>
        <div className="report-mode-toggle view-toggle" role="tablist" aria-label="Report type">
          {REPORT_MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={reportMode === m.key}
              className={`view-toggle-btn${reportMode === m.key ? " active" : ""}`}
              onClick={() => setReportMode(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="filters" hidden={reportMode !== "cumulative"}>
          <label className="field">
            <span>Owners</span>
            <OwnerMultiSelect owners={owners} selectedIds={ownerIds} onChange={setOwnerIds} />
          </label>

          <DateRangeNav mode={rangeMode} start={start} end={end} onChange={handleNavChange} />

          {rangeMode === "custom" && (
            <>
              <label className="field">
                <span>Start date</span>
                <SingleDatePicker
                  value={start}
                  onChange={(iso) =>
                    handleRangeChange({ mode: "custom", start: iso, end: iso > end ? iso : end })
                  }
                />
              </label>

              <label className="field">
                <span>End date</span>
                <SingleDatePicker
                  value={end}
                  onChange={(iso) =>
                    handleRangeChange({ mode: "custom", start: iso < start ? iso : start, end: iso })
                  }
                />
              </label>
            </>
          )}

          {rangeMode === "day" && (
            <label className="field">
              <span>Date</span>
              <SingleDatePicker
                value={start}
                onChange={(iso) => handleRangeChange({ mode: "day", start: iso, end: iso })}
              />
            </label>
          )}

          <button className="btn" onClick={() => handleLoad()} disabled={ownerIds.length === 0 || loading}>
            {loading ? "Loading…" : "Load"}
          </button>
        </div>
        <div className="filters" hidden={reportMode !== "daily"}>
          <label className="field">
            <span>Date</span>
            <SingleDatePicker value={dailyDate} onChange={setDailyDate} />
          </label>

          <label className="field">
            <span>Telecaller</span>
            <OwnerMultiSelect owners={owners} selectedIds={dailyOwnerIds} onChange={setDailyOwnerIds} />
          </label>
        </div>
      </header>

      {/* Cumulative stays mounted (just hidden) while Daily is selected, so
          loaded data and each section's own state survive toggling back. */}
      <div hidden={reportMode !== "cumulative"}>
        {error && <p className="state state-error">Error: {error}</p>}

        {!callAttempts && !loading && !error && (
          <p className="state">Pick an owner and date range, then Load.</p>
        )}

        {callAttempts && (
          <CallLogAnalysis timeline={callAttempts} owners={owners} allowDateWise />
        )}

        {breakdown && <LeadsBreakdown data={breakdown} />}
      </div>

      {/* Daily Report: driven by the single Date + Telecaller filters in the
          header. Mounted only while selected so it fetches when opened. */}
      {reportMode === "daily" && (
        <DailyReport owners={owners} date={dailyDate} ownerIds={dailyOwnerIds} />
      )}
    </main>
  );
}
