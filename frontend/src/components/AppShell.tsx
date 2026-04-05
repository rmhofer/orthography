import { Link } from "react-router-dom";
import type { PropsWithChildren } from "react";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <header className="page-header">
        <Link to="/" className="brand-mark">
          Symbol Games
        </Link>
      </header>
      <main className="page-content">{children}</main>
    </div>
  );
}
