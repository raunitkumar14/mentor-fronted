import { useEffect, useRef, useState } from "react";

// Generic checkbox-list multi-select for string-valued filter options (UTM
// Source/Medium, Course, Class) — same interaction model and styling as
// OwnerMultiSelect, decoupled from that component's {id, name} owner shape
// so it can drive any {value, label} option list.
export default function MultiSelect({ options, selected, onChange, placeholder, allLabel }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selectAllRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const selectedSet = new Set(selected);
  const selectedOptions = options.filter((o) => selectedSet.has(o.value));
  const allSelected = options.length > 0 && selectedOptions.length === options.length;
  const someSelected = selectedOptions.length > 0 && !allSelected;

  // Only the native checkbox element supports a visual "some, not all"
  // state, and there's no React prop for it — it has to be set imperatively.
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  let label = placeholder;
  if (allSelected) label = allLabel;
  else if (selectedOptions.length === 1) label = selectedOptions[0].label;
  else if (selectedOptions.length > 1) label = `${selectedOptions.length} selected`;

  function toggle(value) {
    const next = selectedSet.has(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    onChange(next);
  }

  function toggleAll() {
    onChange(allSelected ? [] : options.map((o) => o.value));
  }

  return (
    <div className="owner-select" ref={rootRef}>
      <button
        type="button"
        className="owner-select-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {label}
      </button>
      {open && (
        <ul className="owner-select-panel" role="listbox" aria-multiselectable="true">
          {options.length > 0 && (
            <li className="owner-select-all">
              <label className="owner-select-option">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                />
                <span>Select All</span>
              </label>
            </li>
          )}
          {options.map((o) => {
            const checked = selectedSet.has(o.value);
            return (
              <li key={o.value}>
                <label className="owner-select-option">
                  <input type="checkbox" checked={checked} onChange={() => toggle(o.value)} />
                  <span>{o.label}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
