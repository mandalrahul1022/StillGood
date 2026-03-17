import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { OnboardingOverlay } from "./OnboardingOverlay";
import { StillGoodLogo } from "./StillGoodLogo";

const links = [
  { to: "/", label: "Dashboard", kicker: "DB" },
  { to: "/add-item", label: "Add Item", kicker: "AI" },
  { to: "/notifications", label: "Notifications", kicker: "NT" },
  { to: "/analytics", label: "Analytics", kicker: "AN" },
  { to: "/integrations", label: "Integrations", kicker: "IN" },
  { to: "/settings", label: "Settings", kicker: "ST" }
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, household, logout } = useAuth();

  return (
    <div className="app-background">
      {user ? <OnboardingOverlay userId={user.id} householdName={household?.name ?? null} /> : null}
      <div className="ambient-orb orb-a" />
      <div className="ambient-orb orb-b" />
      <div className="ambient-grid" />

      <div className="app-shell">
        <header className="topbar">
          <div className="brand-lockup">
            <StillGoodLogo className="logo-mark" />
            <div className="brand-meta">
              <div className="brand-title-row">
                <h1>StillGood</h1>
                <span className="brand-tag">Prototype</span>
              </div>
              <p>Freshness intelligence for everyday kitchens</p>
            </div>
          </div>

          <div className="topbar-actions">
            <div className="household-pill">
              <span>Household</span>
              <strong>{household?.name ?? "Not set"}</strong>
            </div>
            <div className="user-chip">{user?.name}</div>
            <button className="button ghost logout" onClick={() => void logout()}>
              Log out
            </button>
          </div>
        </header>

        <nav className="nav-grid">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              <span className="nav-kicker">{link.kicker}</span>
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
