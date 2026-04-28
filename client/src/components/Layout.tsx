import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Footer } from "./Footer";
import { OnboardingOverlay } from "./OnboardingOverlay";
import { StillGoodLogo } from "./StillGoodLogo";

function IconDashboard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function IconPlus() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  );
}
function IconPuzzle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}
function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
function IconLogout() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

const links = [
  { to: "/", label: "Dashboard", end: true, icon: <IconDashboard /> },
  { to: "/add-item", label: "Add Item", icon: <IconPlus /> },
  { to: "/notifications", label: "Notifications", icon: <IconBell /> },
  { to: "/analytics", label: "Analytics", icon: <IconChart /> },
  { to: "/integrations", label: "Integrations", icon: <IconPuzzle /> },
  { to: "/settings", label: "Settings", icon: <IconSettings /> }
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, household, logout } = useAuth();

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  return (
    <div className="app-shell">
      {user ? <OnboardingOverlay userId={user.id} householdName={household?.name ?? null} /> : null}

      <header className="topnav">
        <div className="topnav-inner">
          <div className="topnav-brand">
            <StillGoodLogo className="logo-mark" />
            <div className="topnav-brand-text">
              <div className="topnav-brand-title-row">
                <span className="topnav-brand-name">StillGood</span>
                <span className="brand-tag">Beta</span>
              </div>
              <span className="topnav-brand-tagline">Make food, not waste</span>
            </div>
          </div>

          <nav className="topnav-links">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => `topnav-link${isActive ? " active" : ""}`}
              >
                <span className="nav-icon">{link.icon}</span>
                <span className="topnav-link-label">{link.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="topnav-user">
            {household && (
              <div className="household-pill" title={`Household: ${household.name}`}>
                <div className="household-dot" />
                <strong className="household-name">{household.name}</strong>
              </div>
            )}
            <div className="topnav-user-avatar" title={user?.name ?? ""}>{initials}</div>
            <button className="topnav-logout-btn" onClick={() => void logout()} title="Log out">
              <IconLogout />
            </button>
          </div>
        </div>
      </header>

      <div className="main-wrap">
        <main className="content wide">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
