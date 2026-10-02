// Table column headers for a run of consecutive dates: the month is the
// noisy part once every day sits in its own adjacent column, so it's shown
// only on the first header and again wherever the month (or year) actually
// changes — every other column is just the day number.
export function formatDateColumnLabels(days) {
  let prevMonth = null;
  let prevYear = null;
  return days.map((iso) => {
    const d = new Date(`${iso}T00:00:00`);
    const month = d.getMonth();
    const year = d.getFullYear();
    const showMonth = month !== prevMonth || year !== prevYear;
    prevMonth = month;
    prevYear = year;
    return showMonth
      ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : String(d.getDate());
  });
}

// Picks which x-axis category indices get a text label, spaced at least
// `step` apart, always including the last category — without letting that
// forced-last label land right next to whichever step-selected label
// happens to precede it (a naive `i % step === 0 || isLast` check collides
// exactly when count-1 isn't itself a multiple of step).
export function computeLabelIndices(count, step) {
  if (count <= 0) return new Set();
  const indices = [];
  for (let i = 0; i < count; i += step) indices.push(i);
  const lastIdx = count - 1;
  const prev = indices[indices.length - 1];
  if (prev !== lastIdx) {
    if (lastIdx - prev < step) {
      indices[indices.length - 1] = lastIdx;
    } else {
      indices.push(lastIdx);
    }
  }
  return new Set(indices);
}
