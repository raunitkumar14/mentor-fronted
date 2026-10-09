// The dataviz skill's 8-hue categorical palette, fixed order (never cycled
// past 8 — see index.css's --series-1..8). "Unspecified" buckets (a custom
// field never set on the lead) use the muted gray token instead of a 9th
// generated hue, since they represent absence of data, not a competing
// category identity.
export const SERIES_VARS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];

export const MUTED_VAR = "var(--gray-1)";
