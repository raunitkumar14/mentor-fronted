import { useEffect, useMemo, useState } from "react";
import { getLeadDashboard, getLeadDashboardFilterOptions, getOwners } from "./api.js";
import { mapCustomFieldCode, customFieldOptions } from "./customFieldLabels.js";
import { SERIES_VARS, MUTED_VAR } from "./seriesPalette.js";
import DonutChart from "./DonutChart.jsx";
import HorizontalBarChart from "./HorizontalBarChart.jsx";
import DateRangeNav, { toISODate } from "./DateRangeNav.jsx";
import SingleDatePicker from "./SingleDatePicker.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import MultiSelect from "./MultiSelect.jsx";
import PIPELINE_NAMES from "./pipelineNames.json";

const OTP_STATUS_OPTIONS = [
  { value: "Verified", label: "Verified" },
  { value: "Not Verified", label: "Not Verified" },
  { value: "Unknown", label: "Unknown" },
];

const REGISTRATION_STATUS_OPTIONS = [
  { value: "registered", label: "Registered" },
  { value: "unregistered", label: "Unregistered" },
];

// Matches the backend's UNSET_FILTER sentinel — sent instead of a real value
// to mean "leads where this field was never set." A real, sizeable segment
// for several of these fields (most leads have no exam mode/course set), so
// it's kept as a selectable option rather than dropped from the list.
const UNSET_FILTER = "__unset__";
const UNSPECIFIED_OPTION = { value: UNSET_FILTER, label: "(blank)" };

// "(blank)" appended last, matching the chart-side ordering in
// codeDistItems below (the null bucket always sorts after every real code).
const EXAM_MODE_OPTIONS = [...customFieldOptions("cfExamMode"), UNSPECIFIED_OPTION];
const COURSE_OPTIONS = [...customFieldOptions("cfCourse"), UNSPECIFIED_OPTION];
const CLASS_OPTIONS = [...customFieldOptions("cfClass"), UNSPECIFIED_OPTION];

function todayMinus(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toISODate(d);
}

// "Verified"/"Not Verified" always take the same two slots regardless of
// data order, so a status's color stays stable across filter changes;
// anything else the CRM starts sending (there's currently just "Unknown"
// for leads with no OTP field at all) falls in alphabetically after.
const OTP_STATUS_ORDER = ["Verified", "Not Verified"];

function otpDistItems(rows) {
  const present = new Set(rows.map((r) => r.code));
  const known = OTP_STATUS_ORDER.filter((label) => present.has(label));
  const rest = [...present].filter((label) => !OTP_STATUS_ORDER.includes(label)).sort();
  const order = [...known, ...rest];
  const countByLabel = new Map(rows.map((r) => [r.code, r.count]));
  return order.map((label, i) => ({
    key: label,
    label,
    value: countByLabel.get(label) ?? 0,
    color: SERIES_VARS[i % SERIES_VARS.length],
  }));
}

// UTM medium is free text, so the category count is unbounded: biggest
// first, top slots get a hue, the tail collapses into one "Other" slice,
// and leads with no medium use the muted gray.
const MEDIUM_MAX_SLICES = SERIES_VARS.length - 1;

// Slice keys are the same tokens the UTM Medium filter uses (the raw value,
// or UNSET_FILTER for blank), so a click can toggle the filter directly.
// Currently-selected mediums always get their own slice, even outside the
// top N, so a selection never disappears into "Other".
function utmMediumItems(rows, selected) {
  const named = rows
    .filter((r) => r.code !== null && r.code !== "")
    .sort((a, b) => b.count - a.count || String(a.code).localeCompare(String(b.code)));
  const unset = rows.filter((r) => r.code === null || r.code === "").reduce((n, r) => n + r.count, 0);
  const top = new Set(named.slice(0, MEDIUM_MAX_SLICES).map((r) => r.code));
  const head = named.filter((r) => top.has(r.code) || selected.includes(r.code));
  const tail = named.filter((r) => !head.includes(r)).reduce((n, r) => n + r.count, 0);
  const items = head.map((r, i) => ({
    key: String(r.code),
    label: String(r.code),
    value: r.count,
    color: SERIES_VARS[i % SERIES_VARS.length],
  }));
  if (tail > 0) {
    items.push({ key: "__other", label: "Other", value: tail, color: SERIES_VARS[SERIES_VARS.length - 1], disabled: true });
  }
  if (unset > 0) items.push({ key: UNSET_FILTER, label: "(blank)", value: unset, color: MUTED_VAR });
  return items;
}

// Shared by exam mode/course/class: sorted by the raw code ascending (the
// CRM assigned these in a deliberate sequence — class codes run Class 6 ->
// Class 12 Pass in code order), with the "no value set" bucket (code null)
// always last and drawn in the muted gray rather than a competing hue,
// since it represents absence of data rather than another category.
function codeDistItems(rows, field) {
  const sorted = [...rows].sort((a, b) => {
    if (a.code === null) return 1;
    if (b.code === null) return -1;
    return a.code - b.code;
  });
  let slot = 0;
  return sorted.map((row) => ({
    key: String(row.code),
    label: mapCustomFieldCode(field, row.code),
    value: row.count,
    color: row.code === null ? MUTED_VAR : SERIES_VARS[slot++ % SERIES_VARS.length],
  }));
}

function SummaryCard({ label, value }) {
  return (
    <div className="lead-summary-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value num lead-summary-value">{value.toLocaleString()}</span>
    </div>
  );
}

const DEFAULT_FILTERS = {
  pipeline: "35623",
  utmSources: [],
  utmMediums: [],
  utmCampaigns: [],
  ownerIds: [],
  otpStatus: "",
  registrationStatus: "",
  examMode: "",
  courses: [],
  classes: [],
};

export default function LeadDashboard() {
  const [filterOptions, setFilterOptions] = useState({
    pipelines: [],
    utmSources: [],
    utmMediums: [],
    utmCampaigns: [],
  });
  const [owners, setOwners] = useState([]);
  const [rangeMode, setRangeMode] = useState("custom");
  const [start, setStart] = useState(todayMinus(30));
  const [end, setEnd] = useState(todayMinus(0));
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const {
    pipeline,
    utmSources,
    utmMediums,
    utmCampaigns,
    ownerIds,
    otpStatus,
    registrationStatus,
    examMode,
    courses,
    classes,
  } = filters;

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function toggleUtmMedium(key) {
    setFilters((prev) => ({
      ...prev,
      utmMediums: prev.utmMediums.includes(key)
        ? prev.utmMediums.filter((m) => m !== key)
        : [...prev.utmMediums, key],
    }));
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  useEffect(() => {
    getLeadDashboardFilterOptions()
      .then(setFilterOptions)
      .catch((err) => setError(err.message));
    getOwners()
      .then(setOwners)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getLeadDashboard({
      start,
      end,
      pipeline,
      utmSources,
      utmMediums,
      utmCampaigns,
      ownerIds,
      otpStatus,
      registrationStatus,
      examMode,
      courses,
      classes,
    })
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
  }, [
    start,
    end,
    pipeline,
    utmSources,
    utmMediums,
    utmCampaigns,
    ownerIds,
    otpStatus,
    registrationStatus,
    examMode,
    courses,
    classes,
  ]);

  // Same mode/start/end handling as App.jsx's DateRangeNav wiring, so
  // "Custom/Week/Month" and the prev/next steppers behave identically here.
  function handleRangeChange({ mode, start: newStart, end: newEnd }) {
    setRangeMode(mode);
    setStart(newStart);
    setEnd(newEnd);
  }

  const otpItems = useMemo(() => otpDistItems(data?.otpStatusDistribution ?? []), [data]);
  const examModeItems = useMemo(
    () => codeDistItems(data?.examModeDistribution ?? [], "cfExamMode"),
    [data]
  );
  const utmMediumChartItems = useMemo(
    () => utmMediumItems(data?.utmMediumDistribution ?? [], utmMediums),
    [data, utmMediums]
  );
  const courseItems = useMemo(() => codeDistItems(data?.courseDistribution ?? [], "cfCourse"), [data]);
  const classItems = useMemo(() => codeDistItems(data?.classDistribution ?? [], "cfClass"), [data]);

  const registrationItems = useMemo(() => {
    if (!data) return [];
    return [
      { key: "registered", label: "Registered", value: data.registeredLeads, color: SERIES_VARS[0] },
      { key: "unregistered", label: "Unregistered", value: data.unregisteredLeads, color: SERIES_VARS[1] },
    ];
  }, [data]);

  const hasLeads = (data?.totalLeads ?? 0) > 0;

  return (
    <main className="page">
      <header className="topbar">
        <div className="topbar-head">
          <h1>Lead Dashboard</h1>
          <ThemeToggle />
        </div>
        <p className="section-subtitle lead-dashboard-desc">
          Analyze lead acquisition, registration, OTP verification, and academic preferences.
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

      <div className="lead-dashboard-body">
        <aside className="lead-filter-panel">
          <div className="lead-filter-panel-head">
            <h2>Filters</h2>
            <button type="button" className="lead-filter-reset" onClick={resetFilters}>
              Reset
            </button>
          </div>

          <label className="field">
            <span>Pipeline</span>
            <select value={pipeline} onChange={(e) => setFilter("pipeline", e.target.value)}>
              <option value="">All Pipelines</option>
              {filterOptions.pipelines.map((p) => (
                <option key={p ?? UNSET_FILTER} value={p ?? UNSET_FILTER}>
                  {p === null ? "(blank)" : PIPELINE_NAMES[p] ?? `Pipeline ${p}`}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>UTM Source</span>
            <MultiSelect
              options={filterOptions.utmSources.map((s) => ({
                value: s ?? UNSET_FILTER,
                label: s ?? "(blank)",
              }))}
              selected={utmSources}
              onChange={(v) => setFilter("utmSources", v)}
              placeholder="All Sources"
              allLabel="All Sources"
            />
          </label>

          <label className="field">
            <span>UTM Medium</span>
            <MultiSelect
              options={filterOptions.utmMediums.map((m) => ({
                value: m ?? UNSET_FILTER,
                label: m ?? "(blank)",
              }))}
              selected={utmMediums}
              onChange={(v) => setFilter("utmMediums", v)}
              placeholder="All Mediums"
              allLabel="All Mediums"
            />
          </label>

          <label className="field">
            <span>UTM Campaign</span>
            <MultiSelect
              options={filterOptions.utmCampaigns.map((c) => ({
                value: c ?? UNSET_FILTER,
                label: c ?? "(blank)",
              }))}
              selected={utmCampaigns}
              onChange={(v) => setFilter("utmCampaigns", v)}
              placeholder="All Campaigns"
              allLabel="All Campaigns"
            />
          </label>

          <label className="field">
            <span>Owners</span>
            <MultiSelect
              options={owners.map((o) => ({ value: String(o.id), label: o.name }))}
              selected={ownerIds}
              onChange={(v) => setFilter("ownerIds", v)}
              placeholder="All Owners"
              allLabel="All Owners"
            />
          </label>

          <label className="field">
            <span>OTP Status</span>
            <select value={otpStatus} onChange={(e) => setFilter("otpStatus", e.target.value)}>
              <option value="">All Statuses</option>
              {OTP_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Registration Status</span>
            <select
              value={registrationStatus}
              onChange={(e) => setFilter("registrationStatus", e.target.value)}
            >
              <option value="">All</option>
              {REGISTRATION_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Exam Mode</span>
            <select value={examMode} onChange={(e) => setFilter("examMode", e.target.value)}>
              <option value="">All Modes</option>
              {EXAM_MODE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Course</span>
            <MultiSelect
              options={COURSE_OPTIONS}
              selected={courses}
              onChange={(v) => setFilter("courses", v)}
              placeholder="All Courses"
              allLabel="All Courses"
            />
          </label>

          <label className="field">
            <span>Class</span>
            <MultiSelect
              options={CLASS_OPTIONS}
              selected={classes}
              onChange={(v) => setFilter("classes", v)}
              placeholder="All Classes"
              allLabel="All Classes"
            />
          </label>
        </aside>

        <div className="lead-dashboard-main">
          {error && <p className="state state-error">Error: {error}</p>}

          {loading && <p className="state">Loading lead data…</p>}

          {!loading && !error && data && !hasLeads && (
            <p className="state">No leads match the selected filters.</p>
          )}

          {!loading && !error && data && hasLeads && (
            <>
              <div className="lead-summary-row">
                <SummaryCard label="Total Leads" value={data.totalLeads} />
                <SummaryCard label="Registered Leads" value={data.registeredLeads} />
                <SummaryCard label="Unregistered Leads" value={data.unregisteredLeads} />
                <SummaryCard label="OTP Verified" value={data.otpVerifiedLeads} />
              </div>

              <div className="lead-donut-row">
                <div className="analytics-subsection">
                  <h3 className="subsection-title">UTM Medium</h3>
                  <DonutChart
                    items={utmMediumChartItems}
                    ariaLabel="Distribution of leads by UTM medium"
                    emptyMessage="No UTM medium data in this range."
                    totalLabel="Leads"
                    onSliceClick={toggleUtmMedium}
                    selectedKeys={utmMediums}
                  />
                </div>

                <div className="analytics-subsection">
                  <h3 className="subsection-title">OTP Status</h3>
                  <DonutChart
                    items={otpItems}
                    ariaLabel="Distribution of leads by OTP verification status"
                    emptyMessage="No OTP status data in this range."
                    totalLabel="Leads"
                  />
                </div>

                <div className="analytics-subsection">
                  <h3 className="subsection-title">Exam Mode Distribution</h3>
                  <DonutChart
                    items={examModeItems}
                    ariaLabel="Distribution of leads by exam mode"
                    emptyMessage="No exam mode data in this range."
                    totalLabel="Leads"
                  />
                </div>

                <div className="analytics-subsection">
                  <h3 className="subsection-title">Registration Status</h3>
                  <DonutChart
                    items={registrationItems}
                    ariaLabel="Distribution of leads by registration status"
                    emptyMessage="No leads in this range."
                    totalLabel="Leads"
                  />
                </div>
              </div>

              <div className="lead-bar-row">
                <div className="analytics-subsection">
                  <h3 className="subsection-title">Course Distribution</h3>
                  <HorizontalBarChart
                    items={courseItems}
                    ariaLabel="Distribution of leads by course"
                    emptyMessage="No course data in this range."
                  />
                </div>

                <div className="analytics-subsection">
                  <h3 className="subsection-title">Class Distribution</h3>
                  <HorizontalBarChart
                    items={classItems}
                    ariaLabel="Distribution of leads by class"
                    emptyMessage="No class data in this range."
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
