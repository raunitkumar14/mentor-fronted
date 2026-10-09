import { useEffect, useState } from "react";
import { getCallAttemptsTimeline, getConnectedCallSplit } from "./api.js";
import CallLogAnalysis from "./CallLogAnalysis.jsx";
import LeadsBreakdown from "./LeadsBreakdown.jsx";
import LeadCallSummary from "./LeadCallSummary.jsx";

// Daily Report body for one date and the selected telecallers (picked in
// the page header). Refetches whenever either changes. Shows the same Call Log
// Analysis as the Cumulative Report — scoped to that single day and
// telecallers — plus the Connected Call Split: the Leads Breakdown for the
// unique leads those telecallers connected with that day — and the
// Lead-wise Call Summary for the same day and telecallers.
export default function DailyReport({ owners, date, ownerIds }) {
  const [callAttempts, setCallAttempts] = useState(null);
  const [split, setSplit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (ownerIds.length === 0 || !date) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getCallAttemptsTimeline({ ownerIds, start: date, end: date }),
      getConnectedCallSplit({ ownerIds, date }),
    ])
      .then(([callAttemptsData, splitData]) => {
        if (cancelled) return;
        setCallAttempts(callAttemptsData);
        setSplit(splitData);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setCallAttempts(null);
        setSplit(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerIds, date]);

  if (ownerIds.length === 0) return <p className="state">Pick a telecaller to see the daily report.</p>;

  return (
    <>
      {error && <p className="state state-error">Error: {error}</p>}
      {loading && !callAttempts && <p className="state">Loading…</p>}

      <div style={loading ? { opacity: 0.5 } : undefined}>
        {callAttempts && (
          <CallLogAnalysis timeline={callAttempts} owners={owners} />
        )}

        {split && (
          <LeadsBreakdown
            data={split}
            title="Connected Call Split"
            subtitle={`${split.connectedCalls.toLocaleString()} connected calls · ${split.uniqueLeads.toLocaleString()} unique leads on this date`}
          />
        )}
      </div>

      <LeadCallSummary owners={owners} date={date} ownerIds={ownerIds} />
    </>
  );
}
