import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  getGoogleAdFunnel,
  getGoogleAdFunnelFilterOptions,
  getOwners,
} from "./api.js";
import { customFieldOptions, mapCustomFieldCode } from "./customFieldLabels.js";
import MultiSelect from "./MultiSelect.jsx";
import PIPELINE_NAMES from "./pipelineNames.json";
import { SERIES_VARS, MUTED_VAR } from "./seriesPalette.js";
import HorizontalBarChart from "./HorizontalBarChart.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

// Matches the backend's UNSET_FILTER sentinel ("field never set").
const UNSET_FILTER = "__unset__";
const UNSPECIFIED_OPTION = { value: UNSET_FILTER, label: "(blank)" };

// Narrows a code->label option list to the codes present in the selected
// manager's leads (None = some leads have no value). Mongo's distinct omits
// missing fields, so "(blank)" is always offered rather than inferred.
function presentOptions(all, presentCodes) {
  const present = new Set((presentCodes ?? []).filter((c) => c !== null).map(String));
  return [...all.filter((o) => present.has(String(o.value))), UNSPECIFIED_OPTION];
}
const REGISTRATION_STATUS_OPTIONS = [
  { value: "registered", label: "Registered" },
  { value: "unregistered", label: "Unregistered" },
];
const ALL_EXAM_MODES = customFieldOptions("cfExamMode");
const ALL_COURSES = customFieldOptions("cfCourse");
const ALL_CLASSES = customFieldOptions("cfClass");

const DEFAULT_FILTERS = {
  manager: "",
  // Ticked rows in the campaign table: whole segments and/or single campaigns.
  segments: [],
  campaigns: [],
  pipeline: "",
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

const utmOptions = (values) => values.map((v) => ({ value: v ?? UNSET_FILTER, label: v ?? "(blank)" }));

// Fixed order, so a segment keeps the same hue in every chart no matter how
// the data is sorted or filtered (color follows the entity, never its rank).
const SEGMENT_ORDER = [
  "display",
  "pmax",
  "search_branded",
  "search_nonbranded",
  "search_other",
  "demand_gen",
  "other",
  "unattributed",
];
const SEGMENT_COLOR = Object.fromEntries(
  SEGMENT_ORDER.map((key, i) => [key, SERIES_VARS[i % SERIES_VARS.length]])
);

const EMPTY = "—";
const int = (v) => (v == null ? EMPTY : Math.round(v).toLocaleString());
const money = (v) =>
  v == null ? EMPTY : `₹${v.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
const moneyShort = (v) => (v == null ? EMPTY : `₹${Math.round(v).toLocaleString()}`);
const pct = (v) => (v == null ? EMPTY : `${v.toFixed(2)}%`);
const dec = (v) => (v == null ? EMPTY : v.toLocaleString(undefined, { maximumFractionDigits: 2 }));

// Same ordering/colour rules as the Lead Dashboard's class/course charts:
// by raw code ascending, "no value" last in the muted gray.
function codeDistItems(rows, field) {
  const sorted = [...(rows ?? [])].sort((a, b) => {
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

const parseDay = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const fmtDay = (iso) =>
  parseDay(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
// Inclusive day count, so 10 Sep -> 1 Oct reads as 22 days.
const daysInWindow = (start, end) => Math.round((parseDay(end) - parseDay(start)) / 86400000) + 1;

// `pos` pins a card to a grid cell ({ col, row }); omit for normal flow.
function Kpi({ label, value, hint, pos }) {
  return (
    <div
      className="lead-summary-card"
      title={hint}
      style={pos ? { gridColumn: pos.col, gridRow: pos.row } : undefined}
    >
      <span className="stat-label">{label}</span>
      <span className="stat-value num lead-summary-value">{value}</span>
    </div>
  );
}

function KpiGroup({ title, subtitle, cols, children }) {
  return (
    <section className="gaf-group">
      <h2 className="section-title">{title}</h2>
      {subtitle && <p className="section-subtitle gaf-group-sub">{subtitle}</p>}
      <div className="gaf-kpis" style={{ "--gaf-cols": cols }}>{children}</div>
    </section>
  );
}

// Ad Spend -> Leads -> Registered -> Verified. The three count stages share
// one scale (and one hue, stepping down in opacity) so bar length is directly
// comparable; Spend is money, not a count, so it sits above as the funnel's
// input rather than being scaled against them.
function Funnel({ funnel }) {
  const [spend, ...stages] = funnel;
  const top = Math.max(1, stages[0]?.value ?? 0);
  const opacity = [1, 0.75, 0.55];

  return (
    <div className="gaf-funnel" role="img" aria-label="Funnel from ad spend to leads, registered and verified leads">
      <div className="gaf-funnel-spend">
        <span className="stat-label">Ad Spend</span>
        <span className="num gaf-funnel-spend-value">{money(spend.value)}</span>
      </div>

      {stages.map((stage, i) => {
        const width = (stage.value / top) * 100;
        const fromLabel = i === 0 ? "spend" : stages[i - 1].stage.toLowerCase();
        return (
          <Fragment key={stage.stage}>
            <div className="gaf-funnel-link">
              <span className="gaf-funnel-arrow" aria-hidden="true">↓</span>
              {i > 0 && (
                <span className="num gaf-funnel-rate">
                  {pct(stage.stepRatePct)} of {fromLabel}
                </span>
              )}
              <span className="num gaf-funnel-cost">{money(stage.costPer)} per {COST_UNIT[stage.stage]}</span>
            </div>
            <div className="gaf-funnel-row" title={`${stage.stage}: ${int(stage.value)}`}>
              <span className="gaf-funnel-label">{stage.stage}</span>
              <div className="hbar-track gaf-funnel-track">
                {stage.value > 0 && (
                  <div
                    className="hbar-fill"
                    style={{ width: `${Math.max(width, 0.6)}%`, background: SERIES_VARS[0], opacity: opacity[i] }}
                  />
                )}
              </div>
              <span className="hbar-value num">{int(stage.value)}</span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

const COST_UNIT = {
  Leads: "lead",
  Registered: "registered lead",
  "Registered & verified": "registered & verified lead",
};

const LEAD_NOTE =
  "Leads can't be matched to an individual Google Ads campaign (their UTM names differ), so lead figures are per segment — the sum of its campaigns — and shown on the segment row.";

function CampaignTable({ segments, total, selection, onToggleSegment, onToggleCampaign }) {
  const [open, setOpen] = useState(() => new Set());

  function toggle(key) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="gaf-table-scroll">
      <table className="gaf-table">
        <thead>
          <tr>
            <th>Campaign</th>
            <th>Spend</th>
            <th>Impr.</th>
            <th>Clicks</th>
            <th>Leads</th>
            <th>Registered</th>
            <th>Unreg.</th>
            <th>Verified</th>
            <th>Unver.</th>
            <th>CPL</th>
            <th>Cost / Reg.</th>
            <th>Cost / Ver.</th>
          </tr>
        </thead>
        <tbody>
          {segments.map((seg) => {
            const isOpen = open.has(seg.key);
            const canOpen = seg.campaigns.length > 0;
            const names = seg.campaigns.map((c) => c.name);
            const segSelected = selection.segments.includes(seg.key);
            // A segment reads as partly ticked when only some campaigns are.
            const someCampaigns = !segSelected && names.some((n) => selection.campaigns.includes(n));
            return (
              <Fragment key={seg.key}>
                <tr className={`gaf-seg-row${segSelected ? " gaf-selected" : ""}`}>
                  <td>
                    <span className="gaf-name-cell">
                      <button
                        type="button"
                        className="gaf-expand"
                        onClick={() => toggle(seg.key)}
                        disabled={!canOpen}
                        aria-expanded={canOpen ? isOpen : undefined}
                        aria-label={`${isOpen ? "Collapse" : "Expand"} ${seg.label}`}
                      >
                        <span className="gaf-caret" aria-hidden="true">{canOpen ? (isOpen ? "▾" : "▸") : ""}</span>
                      </button>
                      <label className="gaf-name-btn" title={`Include ${seg.label}`}>
                        <input
                          type="checkbox"
                          checked={segSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someCampaigns;
                          }}
                          onChange={() => onToggleSegment(seg.key, names)}
                        />
                        <span className="legend-swatch" style={{ background: SEGMENT_COLOR[seg.key] }} />
                        {seg.label}
                      </label>
                      {canOpen && <span className="gaf-count"> · {seg.campaigns.length}</span>}
                    </span>
                  </td>
                  <td className="num">{moneyShort(seg.spend)}</td>
                  <td className="num">{int(seg.impressions)}</td>
                  <td className="num">{int(seg.clicks)}</td>
                  <td className="num">{int(seg.leads)}</td>
                  <td className="num">{int(seg.registeredLeads)}</td>
                  <td className="num">{int(seg.unregisteredLeads)}</td>
                  <td className="num">{int(seg.verifiedLeads)}</td>
                  <td className="num">{int(seg.unverifiedLeads)}</td>
                  <td className="num">{money(seg.cpl)}</td>
                  <td className="num">{money(seg.costPerRegisteredLead)}</td>
                  <td className="num">{money(seg.costPerVerifiedLead)}</td>
                </tr>
                {isOpen &&
                  seg.campaigns.map((c) => {
                    const campSelected = segSelected || selection.campaigns.includes(c.name);
                    return (
                      <tr className={`gaf-camp-row${campSelected ? " gaf-selected" : ""}`} key={c.name}>
                        <td>
                          <label className="gaf-name-btn gaf-camp-name" title={`Include ${c.name}`}>
                            <input
                              type="checkbox"
                              checked={campSelected}
                              onChange={() => onToggleCampaign(seg.key, c.name, names)}
                            />
                            {c.name}
                          </label>
                          <span className={`gaf-status${c.status === "ENABLED" ? " on" : ""}`}>
                            {c.status.toLowerCase()}
                          </span>
                        </td>
                        <td className="num">{moneyShort(c.spend)}</td>
                        <td className="num">{int(c.impressions)}</td>
                        <td className="num">{int(c.clicks)}</td>
                        <td className="num gaf-na" colSpan={8} title={LEAD_NOTE}>
                          leads tracked at segment level
                        </td>
                      </tr>
                    );
                  })}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td className="num">{moneyShort(total.spend)}</td>
            <td className="num">{int(total.impressions)}</td>
            <td className="num">{int(total.clicks)}</td>
            <td className="num">{int(total.leads)}</td>
            <td className="num">{int(total.registeredLeads)}</td>
            <td className="num">{int(total.unregisteredLeads)}</td>
            <td className="num">{int(total.verifiedLeads)}</td>
            <td className="num">{int(total.unverifiedLeads)}</td>
            <td className="num">{money(total.cpl)}</td>
            <td className="num">{money(total.costPerRegisteredLead)}</td>
            <td className="num">{money(total.costPerVerifiedLead)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function GoogleAdFunnel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [owners, setOwners] = useState([]);
  const [ready, setReady] = useState(false);
  // Options already fetched this session, by manager — switching back to a
  // manager is instant instead of another round trip.
  const optionsCache = useRef(new Map());
  const [filterOptions, setFilterOptions] = useState({
    managers: [],
    pipelines: [],
    utmSources: [],
    utmMediums: [],
    utmCampaigns: [],
    ownerIds: [],
    otpStatuses: [],
    examModes: [],
    courses: [],
    classes: [],
  });

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  // Manager comes first: switching it changes which leads are in scope, so
  // every other filter (whose options and values were for the old scope) is
  // cleared rather than left pointing at values that may no longer exist.
  function selectManager(manager) {
    setFilters({ ...DEFAULT_FILTERS, manager });
  }

  const leadFiltersActive = Object.entries(filters).some(
    ([k, v]) =>
      !["manager", "segments", "campaigns"].includes(k) && (Array.isArray(v) ? v.length > 0 : v !== "")
  );

  // Table ticks -> re-scope the whole page. Segment and campaign ticks can be
  // mixed freely; a campaign tick is dropped as redundant once its whole
  // segment is ticked, and unticking one campaign of a ticked segment turns
  // that segment into "all its other campaigns".
  function toggleSegment(key, campaignNames) {
    setFilters((prev) => {
      if (prev.segments.includes(key)) {
        return { ...prev, segments: prev.segments.filter((k) => k !== key) };
      }
      return {
        ...prev,
        segments: [...prev.segments, key],
        campaigns: prev.campaigns.filter((n) => !campaignNames.includes(n)),
      };
    });
  }

  function toggleCampaign(segmentKey, name, siblingNames) {
    setFilters((prev) => {
      if (prev.segments.includes(segmentKey)) {
        return {
          ...prev,
          segments: prev.segments.filter((k) => k !== segmentKey),
          campaigns: [...prev.campaigns, ...siblingNames.filter((n) => n !== name)],
        };
      }
      return {
        ...prev,
        campaigns: prev.campaigns.includes(name)
          ? prev.campaigns.filter((n) => n !== name)
          : [...prev.campaigns, name],
      };
    });
  }

  function clearSelection() {
    setFilters((prev) => ({ ...prev, segments: [], campaigns: [] }));
  }

  useEffect(() => {
    getOwners()
      .then(setOwners)
      .catch((err) => setError(err.message));
  }, []);

  // Options are re-fetched per manager so every dropdown only offers values
  // that exist in that manager's leads. The first load has no manager yet:
  // it supplies the manager list, and the first manager becomes the default.
  useEffect(() => {
    let cancelled = false;
    const cached = optionsCache.current.get(filters.manager);
    (cached ? Promise.resolve(cached) : getGoogleAdFunnelFilterOptions(filters.manager))
      .then((opts) => {
        if (cancelled) return;
        optionsCache.current.set(filters.manager, opts);
        setFilterOptions(opts);
        if (!ready) {
          const first = opts.managers.find((m) => m !== null);
          if (first && !filters.manager) setFilters((prev) => ({ ...prev, manager: first }));
          setReady(true);
        }
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.manager]);

  const ownerOptions = useMemo(
    () =>
      owners
        .filter((o) => filterOptions.ownerIds.includes(o.id))
        .map((o) => ({ value: String(o.id), label: o.name })),
    [owners, filterOptions.ownerIds]
  );
  const otpOptions = useMemo(() => {
    const values = new Set([...filterOptions.otpStatuses, "Unknown"]);
    return [...values].map((v) => ({ value: v, label: v }));
  }, [filterOptions.otpStatuses]);
  const examModeOptions = useMemo(
    () => presentOptions(ALL_EXAM_MODES, filterOptions.examModes),
    [filterOptions.examModes]
  );
  const courseOptions = useMemo(
    () => presentOptions(ALL_COURSES, filterOptions.courses),
    [filterOptions.courses]
  );
  const classOptions = useMemo(
    () => presentOptions(ALL_CLASSES, filterOptions.classes),
    [filterOptions.classes]
  );

  useEffect(() => {
    if (!ready) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getGoogleAdFunnel(filters)
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
  }, [filters, ready]);

  const segments = data?.segments ?? [];

  const classItems = useMemo(
    () => codeDistItems(data?.distributions?.class, "cfClass"),
    [data]
  );
  const courseItems = useMemo(
    () => codeDistItems(data?.distributions?.course, "cfCourse"),
    [data]
  );

  const hasSelection = filters.segments.length > 0 || filters.campaigns.length > 0;
  const selectionLabel = [
    ...(data?.selection?.segments ?? []).map((k) => segments.find((g) => g.key === k)?.label ?? k),
    ...(data?.selection?.campaigns ?? []),
  ].join(" + ");

  const o = data?.overall;
  const hasAny = data && (data.hasAdData || data.hasLeadData);

  return (
    <main className="page">
      <header className="topbar">
        <div className="topbar-head">
          <h1>Google Ad Funnel</h1>
          <ThemeToggle />
        </div>
        <p className="section-subtitle lead-dashboard-desc">
          Ad spend → leads → registered → verified, aggregated across all Google Ads campaigns. Expand a segment in the table to drill into its campaigns.
        </p>

        {data?.window?.startDate && data?.window?.endDate && (
          <div className="gaf-window">
            <span className="stat-label">Data window</span>
            <span className="num gaf-window-range">
              {fmtDay(data.window.startDate)} – {fmtDay(data.window.endDate)}
            </span>
            <span className="gaf-window-note">
              {daysInWindow(data.window.startDate, data.window.endDate)} days · ad metrics and leads
              both cover this period
            </span>
          </div>
        )}

      </header>

      <div className="lead-dashboard-body">
        <aside className="lead-filter-panel">
          <div className="lead-filter-panel-head">
            <h2>Filters</h2>
            <button type="button" className="lead-filter-reset" onClick={() => selectManager(filters.manager)}>
              Reset
            </button>
          </div>

          <label className="field">
            <span>Manager</span>
            <select value={filters.manager} onChange={(e) => selectManager(e.target.value)}>
              {filterOptions.managers
                .filter((m) => m !== null)
                .map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
            </select>
          </label>

          <label className="field">
            <span>Pipeline</span>
            <select value={filters.pipeline} onChange={(e) => setFilter("pipeline", e.target.value)}>
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
              options={utmOptions(filterOptions.utmSources)}
              selected={filters.utmSources}
              onChange={(v) => setFilter("utmSources", v)}
              placeholder="All Google Sources"
              allLabel="All Google Sources"
            />
          </label>

          <label className="field">
            <span>UTM Medium</span>
            <MultiSelect
              options={utmOptions(filterOptions.utmMediums)}
              selected={filters.utmMediums}
              onChange={(v) => setFilter("utmMediums", v)}
              placeholder="All Mediums"
              allLabel="All Mediums"
            />
          </label>

          <label className="field">
            <span>UTM Campaign</span>
            <MultiSelect
              options={utmOptions(filterOptions.utmCampaigns)}
              selected={filters.utmCampaigns}
              onChange={(v) => setFilter("utmCampaigns", v)}
              placeholder="All Campaigns"
              allLabel="All Campaigns"
            />
          </label>

          <label className="field">
            <span>Owners</span>
            <MultiSelect
              options={ownerOptions}
              selected={filters.ownerIds}
              onChange={(v) => setFilter("ownerIds", v)}
              placeholder="All Owners"
              allLabel="All Owners"
            />
          </label>

          <label className="field">
            <span>OTP Status</span>
            <select value={filters.otpStatus} onChange={(e) => setFilter("otpStatus", e.target.value)}>
              <option value="">All Statuses</option>
              {otpOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Registration Status</span>
            <select
              value={filters.registrationStatus}
              onChange={(e) => setFilter("registrationStatus", e.target.value)}
            >
              <option value="">All</option>
              {REGISTRATION_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Exam Mode</span>
            <select value={filters.examMode} onChange={(e) => setFilter("examMode", e.target.value)}>
              <option value="">All Modes</option>
              {examModeOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Course</span>
            <MultiSelect
              options={courseOptions}
              selected={filters.courses}
              onChange={(v) => setFilter("courses", v)}
              placeholder="All Courses"
              allLabel="All Courses"
            />
          </label>

          <label className="field">
            <span>Class</span>
            <MultiSelect
              options={classOptions}
              selected={filters.classes}
              onChange={(v) => setFilter("classes", v)}
              placeholder="All Classes"
              allLabel="All Classes"
            />
          </label>
        </aside>

        <div className="lead-dashboard-main">

      {error && <p className="state state-error">Error: {error}</p>}
      {loading && <p className="state gaf-loading">{data ? "Updating…" : "Loading…"}</p>}

      {!loading && !error && data && !hasAny && (
        <p className="state">No Google Ads data or leads for the current selection.</p>
      )}

      {!error && data && hasAny && (
        <div className={loading ? "gaf-stale" : undefined} aria-busy={loading}>
          {leadFiltersActive && (
            <p className="state gaf-banner">
              Lead filters apply to leads only. Ad spend can't be split by lead attributes, so cost
              metrics (CPL etc.) are the full ad spend divided by the filtered leads.
            </p>
          )}
          {data.scope.utmSources && data.scope.utmSources.length === 0 && (
            <p className="state gaf-banner">
              No UTM source is mapped to {filters.manager}, so no leads are attributed to their
              campaigns. Add the mapping in the backend (_MANAGER_UTM_SOURCES).
            </p>
          )}

          {!data.hasAdData && (
            <p className="state gaf-banner">
              No campaign data has been uploaded, so spend and cost metrics are blank. Leads below
              are still the manager's leads.
            </p>
          )}

          {hasSelection && (
            <div className="gaf-selection">
              <span className="stat-label">Showing</span>
              <strong>{selectionLabel}</strong>
              <button type="button" className="lead-filter-reset" onClick={clearSelection}>
                Clear selection
              </button>
              {!data.selection.costAvailable && (
                <span className="gaf-selection-note">
                  Your selection includes only part of a segment. Ad metrics cover just the ticked
                  campaigns, but leads can only be tracked per segment (UTM names don't match campaign
                  names), so leads and the funnel cover the whole segment and cost per lead isn't
                  available. Tick the whole segment to see it.
                </span>
              )}
            </div>
          )}

          <KpiGroup title="Google Ads performance" cols={6}>
            <Kpi label="Spend" value={moneyShort(o.spend)} hint={money(o.spend)} />
            <Kpi
              label="Daily budget"
              value={moneyShort(o.budget)}
              hint="Sum of each campaign's daily Budget. Not comparable with cumulative spend."
            />
            <Kpi label="Impressions" value={int(o.impressions)} />
            <Kpi label="Clicks" value={int(o.clicks)} />
            <Kpi label="CTR" value={pct(o.ctrPct)} hint="Clicks ÷ impressions" />
            <Kpi label="Avg. CPC" value={money(o.cpc)} />
          </KpiGroup>

          <KpiGroup
            title="Lead funnel"
            cols={4}
            subtitle={`Leads created in the data window with ${
              data.scope.utmSources?.length
                ? `utmSource = ${data.scope.utmSources.join(" / ")}`
                : "a Google UTM source"
            }. Registered = registration number set; verified = OTP verified; registered & verified = both.`}
          >
            <Kpi label="Leads" value={int(o.leads)} pos={{ col: 1, row: 1 }} />
            <Kpi label="Registered" value={int(o.registeredLeads)} pos={{ col: 2, row: 1 }} />
            <Kpi
              label="Verified"
              value={int(o.verifiedLeads)}
              hint={`All OTP-verified leads. ${int(o.otpVerifiedUnregistered)} of them have no registration number.`}
              pos={{ col: 3, row: 1 }}
            />
            <Kpi
              label="Registered & verified"
              value={int(o.registeredVerifiedLeads)}
              hint="Registered leads that are also OTP-verified (registered ∩ verified)"
              pos={{ col: 4, row: 1 }}
            />
            {/* The "not" counterparts sit directly under what they complement. */}
            <Kpi label="Unregistered" value={int(o.unregisteredLeads)} pos={{ col: 2, row: 2 }} />
            <Kpi label="Unverified" value={int(o.unverifiedLeads)} pos={{ col: 3, row: 2 }} />
          </KpiGroup>

          <KpiGroup title="Cost & efficiency" cols={6}>
            <Kpi label="CPL" value={money(o.cpl)} hint="Spend ÷ leads" />
            <Kpi label="Cost / registered" value={money(o.costPerRegisteredLead)} />
            <Kpi label="Cost / verified" value={money(o.costPerVerifiedLead)} hint="Spend ÷ verified (OTP)" />
            <Kpi label="Registration rate" value={pct(o.registrationRatePct)} hint="Registered ÷ leads" />
            <Kpi
              label="Verification rate"
              value={pct(o.verificationRatePct)}
              hint="Registered & verified ÷ registered"
            />
            <Kpi
              label="Reg. & verified ÷ verified"
              value={pct(o.registeredOfVerifiedPct)}
              hint="Registered & verified ÷ verified: how many verified leads are also registered"
            />
          </KpiGroup>

          <section className="analytics-subsection">
            <h2 className="section-title">Funnel</h2>
            <p className="section-subtitle">
              End to end, {pct(o.leadToVerifiedPct)} of leads end up registered & verified.
            </p>
            <Funnel funnel={data.funnel} />
          </section>

          <section className="analytics-subsection">
            <h2 className="section-title">Campaign breakdown</h2>
            <p className="section-subtitle">{LEAD_NOTE}</p>
            <CampaignTable
              segments={segments}
              total={data.tableTotal}
              selection={{ segments: filters.segments, campaigns: filters.campaigns }}
              onToggleSegment={toggleSegment}
              onToggleCampaign={toggleCampaign}
            />
          </section>

          <section className="analytics-subsection">
            <h2 className="section-title">Class &amp; course distribution</h2>
            <p className="section-subtitle">
              Leads in scope:{" "}
              {hasSelection ? data.selection.leadScope.join(", ") || "none" : "all campaigns"}.
            </p>
            <div className="lead-bar-row">
              <div className="analytics-subsection">
                <h3 className="subsection-title">Class distribution</h3>
                <HorizontalBarChart
                  items={classItems}
                  ariaLabel="Distribution of leads by class"
                  emptyMessage="No class data for these leads."
                />
              </div>
              <div className="analytics-subsection">
                <h3 className="subsection-title">Course distribution</h3>
                <HorizontalBarChart
                  items={courseItems}
                  ariaLabel="Distribution of leads by course"
                  emptyMessage="No course data for these leads."
                />
              </div>
            </div>
          </section>
        </div>
      )}
        </div>
      </div>
    </main>
  );
}
