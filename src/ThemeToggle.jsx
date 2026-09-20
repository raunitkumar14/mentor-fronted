import { useEffect, useState } from "react";

function getInitialTheme() {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage can be unavailable (private browsing, blocked cookies) — fall
    // through to the system preference for this load.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const THEMES = [
  { key: "light", label: "Bright" },
  { key: "dark", label: "Dark" },
];

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // Theme still applies for this session via the DOM attribute even if
      // it can't be remembered for the next visit.
    }
  }, [theme]);

  return (
    <div className="view-toggle theme-toggle" role="tablist" aria-label="Theme">
      {THEMES.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={theme === t.key}
          className={`view-toggle-btn${theme === t.key ? " active" : ""}`}
          onClick={() => setTheme(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
