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

export function getCallAnalytics({ ownerIds, start, end }) {
  const params = new URLSearchParams({ ownerIds: ownerIds.join(","), start, end });
  return request(`/api/call-analytics?${params}`);
}
