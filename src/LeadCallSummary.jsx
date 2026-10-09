import { useEffect, useMemo, useState } from "react";
import { getLeadCallSummary } from "./api.js";
import { mapCustomFieldCode } from "./customFieldLabels.js";
import ScoreCards from "./ScoreCards.jsx";

const PAGE_SIZE = 50;

function formatDuration(totalSeconds) {
  const s = Math.round(totalSeconds || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

// The backend sends each lead's single final disposition; the label still
// comes from customFieldMapping.json like everywhere else.
function dispositionLabel(disposition) {
  if (!disposition) return "—";
  const mapped = mapCustomFieldCode("cfTelecallerDisposition", disposition.id);
  return mapped === String(disposition.id) ? `Unmapped (${disposition.id})` : mapped;
}

// Lead-wise call summary for the Daily Report's selected date and
// telecallers (both picked in the page header); refetches when either changes.
export default function LeadCallSummary({ owners, date, ownerIds }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);

  const ownerNameById = useMemo(() => {
    const map = new Map();
    owners.forEach((o) => map.set(String(o.id), o.name));
    return map;
  }, [owners]);

  useEffect(() => {
    if (ownerIds.length === 0 || !date) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPage(0);
    getLeadCallSummary({ ownerIds, start: date, end: date })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerIds, date]);

  const leads = data?.leads ?? [];
  const pageCount = Math.max(1, Math.ceil(leads.length / PAGE_SIZE));
  const pageRows = leads.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totals = data?.totals;

  return (
    <section className="timeline-section">
      <div className="timeline-header">
        <div>
          <h2 className="section-title">Lead-wise Call Summary</h2>
          <p className="section-subtitle">Calls made on this date</p>
        </div>
      </div>

      {error && <p className="state state-error">Error: {error}</p>}
      {loading && !data && <p className="state">Loading…</p>}

      {totals && (
        <ScoreCards
          singleRow
          items={[
            { label: "Leads Called", value: totals.leads },
            { label: "Total Calls", value: totals.calls },
            { label: "Total Duration", value: formatDuration(totals.durationSec) },
            { label: "Connected", value: totals.connected },
            { label: "Not Connected", value: totals.notConnected },
            { label: "Incoming", value: totals.incoming },
            { label: "Outgoing", value: totals.outgoing },
          ]}
        />
      )}

      {data && leads.length === 0 && <p className="empty">No calls in this range.</p>}

      {leads.length > 0 && (
        <>
          <div className="timeline-table-wrap" style={loading ? { opacity: 0.5 } : undefined}>
            <table>
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Telecaller</th>
                  <th className="num">Total Duration</th>
                  <th className="num">Connected</th>
                  <th className="num">Not Connected</th>
                  <th className="num">Incoming</th>
                  <th className="num">Outgoing</th>
                  <th>Telecaller Disposition</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={row.leadId}>
                    <td>
                      {row.leadName ?? "—"} <span className="num">#{row.leadId}</span>
                    </td>
                    <td>
                      {row.ownerIds.map((id) => ownerNameById.get(String(id)) ?? id).join(", ")}
                    </td>
                    <td className="num">{formatDuration(row.totalDurationSec)}</td>
                    <td className="num">{row.connected}</td>
                    <td className="num">{row.notConnected}</td>
                    <td className="num">{row.incoming}</td>
                    <td className="num">{row.outgoing}</td>
                    <td>{dispositionLabel(row.disposition)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="view-toggle" role="group" aria-label="Pagination">
              <button type="button" className="view-toggle-btn" disabled={page === 0} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <span className="analysis-total">
                Page <span className="num">{page + 1}</span> of <span className="num">{pageCount}</span>
              </span>
              <button
                type="button"
                className="view-toggle-btn"
                disabled={page >= pageCount - 1}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
