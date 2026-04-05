import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { startParticipant } from "../lib/api";
import { phaseRoute } from "../lib/helpers";
import type { ParticipantPhase } from "../types/contracts";

export function IntroPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      const existingToken = localStorage.getItem("symbol-games:last-token") ?? undefined;
      const response = await startParticipant(existingToken);
      localStorage.setItem("symbol-games:last-token", response.token);
      navigate(phaseRoute(response.token, response.phase as ParticipantPhase));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start session.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">Multiplayer Orthography Experiment</p>
          <h1>Build symbols, teach them to a partner, and see whether depth emerges.</h1>
          <p>
            This pilot combines a miniature language, a shared symbol workspace, and a real communication game. The study is
            designed for desktop use with audio enabled.
          </p>
          <button type="button" className="primary-button" disabled={loading} onClick={() => void handleStart()}>
            {loading ? "Preparing Session..." : "Enter Study"}
          </button>
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </section>
    </AppShell>
  );
}
