import { useEffect, useState } from "react";

export function DesktopGuard() {
  const [compact, setCompact] = useState(window.innerWidth < 600 || window.innerHeight < 520);

  useEffect(() => {
    const listener = () => setCompact(window.innerWidth < 600 || window.innerHeight < 520);
    window.addEventListener("resize", listener);
    return () => window.removeEventListener("resize", listener);
  }, []);

  if (!compact) {
    return null;
  }

  return (
    <div className="desktop-guard">
      <div className="desktop-guard-card">
        <h2>Desktop Required</h2>
        <p>This pilot is designed for a desktop or laptop display so the symbol canvas stays precise and readable.</p>
      </div>
    </div>
  );
}
