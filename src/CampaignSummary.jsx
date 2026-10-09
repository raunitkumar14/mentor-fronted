import { useEffect, useState } from "react";
import { getCampaignSummary } from "./api.js";
import DateRangeNav, { toISODate } from "./DateRangeNav.jsx";
import SingleDatePicker from "./SingleDatePicker.jsx";
import { mapCustomFieldCode } from "./customFieldLabels.js";
import ThemeToggle from "./ThemeToggle.jsx";

function todayMinus(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toISODate(d);
}

const int = (n) => n.toLocaleString();

// Newest date first, categories keeping the backend's fixed order within a
// date — the usual question is "what happened lately", and a stable category
// order lets the eye run down one category across dates.
export default function CampaignSummary() {
  const [rangeMode, setRangeMode] = useState("custom");
  const [start, setStart] = useState(todayMinus(6));
  const [end, setEnd] = useState(todayMinus(0));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCampaignSummary({ start, end })
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
  }, [start, end]);

  function handleRangeChange({ mode, start: newStart, end: newEnd }) {
    setRangeMode(mode);
    setStart(newStart);
    setEnd(newEnd);
  }

  const rows = data ? [...data.rows].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)) : [];
  // One column per class present in the data, ascending by code, with the
  // never-set bucket ("") last.
  const classCodes = data
    ? Object.keys(data.total.classes ?? {}).sort((a, b) =>
        a === "" ? 1 : b === "" ? -1 : Number(a) - Number(b)
      )
    : [];
  // Stable sort keeps the backend's category order inside each date.

  return (
    <main className="page">
      <header className="topbar">
        <div className="topbar-head">
          <h1>Campaign Summary</h1>
          <ThemeToggle />
        </div>
        <p className="section-subtitle lead-dashboard-desc">
          Inquiries, registered and not-registered leads per date and campaign type (with a class-wise breakdown of inquiries), for UTM source “g”.
        </p>

        <div className="filters">
          <DateRangeNav mode={rangeMode} start={start} end={end} onChange={handleRangeChange} />

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
        </div>
      </header>

      <div className="campaign-summary-body">
        {error && <p className="state state-error">Error: {error}</p>}
        {loading && <p className="state">Loading campaign summary…</p>}

        {!loading && !error && data && (
          <div className="timeline-table-wrap">
            <table className="campaign-summary-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Campaign type</th>
                  <th className="num">Inquiries</th>
                  <th className="num">Registered</th>
                  <th className="num">Not registered</th>
                  {classCodes.map((c) => (
                    <th className="num" key={c}>
                      {mapCustomFieldCode("cfClass", c === "" ? null : c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const dayStart = i === 0 || rows[i - 1].date !== r.date;
                  // The date cell spans every category row of that date, so
                  // each date is shown once.
                  const span = dayStart ? rows.filter((x) => x.date === r.date).length : 0;
                  return (
                    <tr
                      key={`${r.date}-${r.category}`}
                      className={dayStart && i > 0 ? "campaign-summary-day-start" : undefined}
                    >
                      {dayStart && (
                        <td className="num campaign-summary-date" rowSpan={span}>
                          {r.date}
                        </td>
                      )}
                      <td>{r.label}</td>
                      <td className="num">{int(r.inquiries)}</td>
                      <td className="num">{int(r.registered)}</td>
                      <td className="num">{int(r.notRegistered)}</td>
                      {classCodes.map((c) => (
                        <td className="num" key={c}>{int(r.classes?.[c] ?? 0)}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Total</td>
                  <td className="num">{int(data.total.inquiries)}</td>
                  <td className="num">{int(data.total.registered)}</td>
                  <td className="num">{int(data.total.notRegistered)}</td>
                  {classCodes.map((c) => (
                    <td className="num" key={c}>{int(data.total.classes[c] ?? 0)}</td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
