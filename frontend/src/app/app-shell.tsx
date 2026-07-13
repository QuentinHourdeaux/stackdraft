import { NavLink, Outlet } from "react-router";
import { HealthIndicator } from "./health-indicator.tsx";

export function AppShell() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <NavLink className="app-header__home-link" to="/" end>
            <div className="brand-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <span className="app-header__title">Stackdraft</span>
          </NavLink>
        </div>

        <nav className="app-nav" aria-label="Main">
          <NavLink className="app-nav__link" to="/" end>
            Drafts
          </NavLink>
          <NavLink className="app-nav__link" to="/stacks">
            Stacks
          </NavLink>
          <NavLink className="app-nav__link" to="/settings/states">
            States
          </NavLink>
        </nav>

        <HealthIndicator />
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
