import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { startParticipant } from "../lib/api";
import { phaseRoute } from "../lib/helpers";
import type { InterfaceType, ParticipantPhase } from "../types/contracts";

const INTERFACE_OPTIONS: { value: InterfaceType; label: string; description: string }[] = [
  { value: "blocks", label: "Building Blocks", description: "Place and arrange discrete symbols on a canvas" },
  { value: "seismograph", label: "Seismograph", description: "Draw a 1D trace with a vertical slider on a scrolling paper roll" },
  { value: "inertial", label: "Inertial Drawing", description: "Draw with a pen that lags behind your cursor (low-pass filtered)" },
  { value: "telegraph", label: "Telegraph", description: "Send timed pulses by pressing and holding a key" },
  { value: "etch_a_sketch", label: "Etch-a-Sketch", description: "Draw with independent axis filtering (X and Y filtered separately)" },
  { value: "pendulum", label: "Pendulum", description: "Apply force to a swinging mass — the pen draws oscillatory traces" },
];

export function IntroPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefilledUserId = searchParams.get("userId") ?? "";
  const [userId, setUserId] = useState(prefilledUserId);
  const [selectedInterface, setSelectedInterface] = useState<InterfaceType>("blocks");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      const token = userId.trim() || undefined;
      const response = await startParticipant(token, selectedInterface);
      const phase = response.phase as ParticipantPhase;
      const route = phaseRoute(response.token, phase);
      navigate(`${route}?interface=${selectedInterface}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start session.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <section className="panel stack">
        <p className="eyebrow">Multiplayer Orthography Experiment</p>
        <h1>Symbol Games</h1>
        <p>Build signals, teach them to a partner, and see whether structure emerges.</p>

        <div className="stack">
          <label className="stack" style={{ gap: "0.35rem" }}>
            <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>User ID</span>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter your user ID (or leave blank for auto)"
              style={{ maxWidth: "22rem" }}
            />
          </label>

          <div>
            <span style={{ fontWeight: 600, fontSize: "0.85rem", display: "block", marginBottom: "0.5rem" }}>Interface</span>
            <div className="interface-picker">
              {INTERFACE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`interface-option ${selectedInterface === opt.value ? "selected" : ""}`}
                  onClick={() => setSelectedInterface(opt.value)}
                >
                  <strong>{opt.label}</strong>
                  <span>{opt.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <button type="button" className="primary-button" disabled={loading} onClick={() => void handleStart()}>
          {loading ? "Preparing..." : "Enter Study"}
        </button>
        {error ? <p className="error-text">{error}</p> : null}
      </section>
    </AppShell>
  );
}
