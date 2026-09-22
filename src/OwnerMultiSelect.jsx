import { useEffect, useRef, useState } from "react";

export default function OwnerMultiSelect({ owners, selectedIds, onChange }) {
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

  const selectedSet = new Set(selectedIds);
  const selectedOwners = owners.filter((o) => selectedSet.has(String(o.id)));
  const allSelected = owners.length > 0 && selectedOwners.length === owners.length;
  const someSelected = selectedOwners.length > 0 && !allSelected;

  // Only the native checkbox element supports a visual "some, not all"
  // state, and there's no React prop for it — it has to be set imperatively.
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  let label = "Select owners";
  if (allSelected) label = "All owners";
  else if (selectedOwners.length === 1) label = selectedOwners[0].name;
  else if (selectedOwners.length > 1) label = `${selectedOwners.length} owners`;

  function toggle(id) {
    const idStr = String(id);
    const next = selectedSet.has(idStr)
      ? selectedIds.filter((v) => v !== idStr)
      : [...selectedIds, idStr];
    onChange(next);
  }

  function toggleAll() {
    onChange(allSelected ? [] : owners.map((o) => String(o.id)));
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
          {owners.length > 0 && (
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
          {owners.map((o) => {
            const idStr = String(o.id);
            const checked = selectedSet.has(idStr);
            return (
              <li key={o.id}>
                <label className="owner-select-option">
                  <input type="checkbox" checked={checked} onChange={() => toggle(o.id)} />
                  <span>{o.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
