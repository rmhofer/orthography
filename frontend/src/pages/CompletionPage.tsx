import { useLocation, useParams } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { useBootstrap } from "../hooks/useBootstrap";

export function CompletionPage() {
  const { token } = useParams();
  const location = useLocation();
  const { data } = useBootstrap(token);

  const code = (location.state as { completionCode?: string } | null)?.completionCode ?? data?.participant.completionCode ?? "Pending";

  return (
    <AppShell>
      <section className="panel stack centered">
        <p className="eyebrow">Study Complete</p>
        <h1>Completion Code</h1>
        <div className="completion-code">{code}</div>
        <p>Thank you for taking part in this pilot.</p>
      </section>
    </AppShell>
  );
}
