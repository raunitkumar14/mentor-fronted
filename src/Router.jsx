import { useEffect, useState } from "react";
import App from "./App.jsx";
import LeadDashboard from "./LeadDashboard.jsx";

const ROUTES = [
  { path: "/", label: "Call Coverage" },
  { path: "/leads", label: "Lead Dashboard" },
];

function navigate(path) {
  if (path === window.location.pathname) return;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

// Links only — each page keeps its own ThemeToggle in its own header (as
// App.jsx already does), so this shared bar doesn't duplicate it.
function AppNav({ path }) {
  return (
    <nav className="app-nav">
      {ROUTES.map((r) => (
        <a
          key={r.path}
          href={r.path}
          className={`app-nav-link${path === r.path ? " active" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            navigate(r.path);
          }}
        >
          {r.label}
        </a>
      ))}
    </nav>
  );
}

// No router dependency for a two-page app — pathname + History API is
// enough, and Vite's dev/preview servers already fall back to index.html
// for unknown paths (their default SPA appType), so a direct load of
// /leads works the same as navigating to it client-side.
export default function Router() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    function onPopState() {
      setPath(window.location.pathname);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return (
    <>
      <AppNav path={path} />
      {path === "/leads" ? <LeadDashboard /> : <App />}
    </>
  );
}
