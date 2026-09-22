import CUSTOM_FIELD_MAPPING from "./customFieldMapping.json";

// Converts a raw customFieldValues code (e.g. cfClass: 2918328) into its
// human-readable name via customFieldMapping.json — the single source of
// truth for every coded custom field, so a new mapped field only needs an
// entry there, not a UI change. A code missing from the mapping (or a lead
// that never set the field) falls back to the raw value rather than being
// dropped from the chart.
export function mapCustomFieldCode(field, code) {
  if (code === null || code === undefined || code === "") return "Unspecified";
  const label = CUSTOM_FIELD_MAPPING[field]?.[String(code)];
  return label ?? String(code);
}

// Filter-dropdown options for a coded custom field, straight from the same
// mapping — sorted ascending by code to match codeDistItems' chart order,
// so a filter's option order lines up with the chart it's filtering.
export function customFieldOptions(field) {
  const entries = Object.entries(CUSTOM_FIELD_MAPPING[field] ?? {});
  return entries
    .map(([code, label]) => ({ value: code, label }))
    .sort((a, b) => Number(a.value) - Number(b.value));
}
