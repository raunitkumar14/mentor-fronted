const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

async function request(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json();
}

export function getOwners() {
  return request("/api/owners");
}

export function getMetrics({ ownerIds, start, end }) {
  const params = new URLSearchParams({ ownerIds: ownerIds.join(","), start, end });
  return request(`/api/metrics?${params}`);
}

export function getLeadTimeline({ ownerIds, start, end }) {
  const params = new URLSearchParams({ ownerIds: ownerIds.join(","), start, end });
  return request(`/api/lead-timeline?${params}`);
}

export function getCallAttemptsTimeline({ ownerIds, start, end }) {
  const params = new URLSearchParams({ ownerIds: ownerIds.join(","), start, end });
  return request(`/api/call-attempts-timeline?${params}`);
}

export function getLeadsBreakdown({ ownerIds, start, end }) {
  const params = new URLSearchParams({ ownerIds: ownerIds.join(","), start, end });
  return request(`/api/leads-breakdown?${params}`);
}

export function getLeadCallSummary({ ownerIds, start, end }) {
  const params = new URLSearchParams({ ownerIds: ownerIds.join(","), start, end });
  return request(`/api/lead-call-summary?${params}`);
}

export function getConnectedCallSplit({ ownerIds, date }) {
  const params = new URLSearchParams({ ownerIds: ownerIds.join(","), date });
  return request(`/api/connected-call-split?${params}`);
}

export function getCallAnalytics({ ownerIds, start, end }) {
  const params = new URLSearchParams({ ownerIds: ownerIds.join(","), start, end });
  return request(`/api/call-analytics?${params}`);
}

export function getLeadDashboardFilterOptions() {
  return request("/api/lead-dashboard/filter-options");
}

export function getLeadDashboard({
  start,
  end,
  pipeline,
  utmSources = [],
  utmMediums = [],
  utmCampaigns = [],
  ownerIds = [],
  otpStatus,
  registrationStatus,
  examMode,
  courses = [],
  classes = [],
}) {
  const params = new URLSearchParams();
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  if (pipeline) params.set("pipeline", pipeline);
  if (utmSources.length) params.set("utmSource", utmSources.join(","));
  if (utmMediums.length) params.set("utmMedium", utmMediums.join(","));
  if (utmCampaigns.length) params.set("utmCampaign", utmCampaigns.join(","));
  if (ownerIds.length) params.set("ownerIds", ownerIds.join(","));
  if (otpStatus) params.set("otpStatus", otpStatus);
  if (registrationStatus) params.set("registrationStatus", registrationStatus);
  if (examMode) params.set("examMode", examMode);
  if (courses.length) params.set("course", courses.join(","));
  if (classes.length) params.set("class", classes.join(","));
  const qs = params.toString();
  return request(`/api/lead-dashboard${qs ? `?${qs}` : ""}`);
}

export function getGoogleAdFunnel({
  date,
  manager,
  segments = [],
  campaigns = [],
  pipeline,
  utmSources = [],
  utmMediums = [],
  utmCampaigns = [],
  ownerIds = [],
  otpStatus,
  registrationStatus,
  examMode,
  courses = [],
  classes = [],
}) {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (manager) params.set("manager", manager);
  // Repeated params (not comma-joined): campaign names can contain commas.
  segments.forEach((v) => params.append("segment", v));
  campaigns.forEach((v) => params.append("campaign", v));
  if (pipeline) params.set("pipeline", pipeline);
  if (utmSources.length) params.set("utmSource", utmSources.join(","));
  if (utmMediums.length) params.set("utmMedium", utmMediums.join(","));
  if (utmCampaigns.length) params.set("utmCampaign", utmCampaigns.join(","));
  if (ownerIds.length) params.set("ownerIds", ownerIds.join(","));
  if (otpStatus) params.set("otpStatus", otpStatus);
  if (registrationStatus) params.set("registrationStatus", registrationStatus);
  if (examMode) params.set("examMode", examMode);
  if (courses.length) params.set("course", courses.join(","));
  if (classes.length) params.set("class", classes.join(","));
  const qs = params.toString();
  return request(`/api/google-ad-funnel${qs ? `?${qs}` : ""}`);
}

export function getGoogleAdFunnelFilterOptions(manager) {
  const qs = manager ? `?${new URLSearchParams({ manager })}` : "";
  return request(`/api/google-ad-funnel/filter-options${qs}`);
}

export function getGoogleAdFunnelDates() {
  return request("/api/google-ad-funnel/dates");
}

export function getCampaignSummary({ start, end }) {
  const params = new URLSearchParams({ start, end });
  return request(`/api/campaign-summary?${params}`);
}
