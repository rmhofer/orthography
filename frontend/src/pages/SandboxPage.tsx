import { useCallback, useEffect, useState } from "react";

import { AppShell } from "../components/AppShell";
import { ReferentGrid } from "../components/ReferentGrid";
import { SignalWorkspace } from "../components/SignalWorkspace";
import { fetchManifest } from "../lib/api";
import { applyActionToCanvasState, makeEmptyCanvasState } from "../lib/helpers";
import type { CanvasState, InterfaceType, ReferentDomain, SignalAction, StimuliManifest } from "../types/contracts";

const INTERFACES: { value: InterfaceType; label: string }[] = [
  { value: "blocks", label: "Blocks" },
  { value: "seismograph", label: "Seismograph" },
  { value: "inertial", label: "Inertial" },
  { value: "telegraph", label: "Telegraph" },
  { value: "etch_a_sketch", label: "Etch-a-Sketch" },
  { value: "pendulum", label: "Pendulum" },
];

const DOMAINS: { value: ReferentDomain; label: string }[] = [
  { value: "objects", label: "Objects" },
  { value: "logo", label: "Turtle" },
  { value: "lsystem", label: "L-Systems" },
  { value: "shapes", label: "Shapes" },
  { value: "grid", label: "Grid" },
];

export function SandboxPage() {
  const [interfaceType, setInterfaceType] = useState<InterfaceType>("blocks");
  const [domain, setDomain] = useState<ReferentDomain>("objects");
  const [manifest, setManifest] = useState<StimuliManifest | null>(null);
  const [canvasState, setCanvasState] = useState<CanvasState>(() => makeEmptyCanvasState("blocks"));
  const [targetId, setTargetId] = useState<string | null>(null);
  const [alpha, setAlpha] = useState(0.15);

  // Load manifest when domain changes
  useEffect(() => {
    void fetchManifest(domain).then((m) => {
      setManifest(m);
      // Pick a random target
      if (m.referents.length > 0) {
        setTargetId(m.referents[Math.floor(Math.random() * m.referents.length)].id);
      }
    });
  }, [domain]);

  // Reset canvas when interface changes
  useEffect(() => {
    setCanvasState(makeEmptyCanvasState(interfaceType));
  }, [interfaceType]);

  const handleAction = useCallback((action: SignalAction) => {
    setCanvasState((s) => applyActionToCanvasState(s, action));
  }, []);

  function handleClear() {
    setCanvasState(makeEmptyCanvasState(interfaceType));
  }

  function randomizeTarget() {
    if (!manifest) return;
    const refs = manifest.referents;
    setTargetId(refs[Math.floor(Math.random() * refs.length)].id);
  }

  // Pick 6 referents including the target for a mock choice set
  const choiceSet = manifest && targetId
    ? (() => {
        const others = manifest.referents.filter((r) => r.id !== targetId).slice(0, 5).map((r) => r.id);
        return [targetId, ...others];
      })()
    : [];

  return (
    <AppShell>
      <section className="panel stack game-panel">
        <h2>Sandbox</h2>

        {/* Mock referent grid */}
        {manifest && targetId ? (
          <div>
            <div className="compact-section-header" style={{ marginBottom: "0.5rem" }}>
              <p className="muted-copy">Target is highlighted in green</p>
              <button type="button" className="icon-button" onClick={randomizeTarget}>New target</button>
            </div>
            <div className="game-referent-grid">
              <ReferentGrid
                manifest={manifest}
                referentIds={choiceSet}
                condition="transparent"
                targetId={targetId}
                disabled
              />
            </div>
          </div>
        ) : (
          <p className="muted-copy">Loading referents...</p>
        )}

        {/* Signal workspace */}
        <div className="panel subtle-panel compact-game-panel">
          <SignalWorkspace
            interfaceType={interfaceType}
            canvasState={canvasState}
            onAction={handleAction}
            readOnly={false}
            primitives={manifest?.primitives}
            maxPrimitives={10}
            seismographMode="hold_to_draw"
            inertialAlpha={alpha}
            onClear={handleClear}
          />
        </div>

        {/* Switchers */}
        <div className="sandbox-controls">
          <div>
            <span className="sandbox-label">Interface</span>
            <div className="sandbox-tabs">
              {INTERFACES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`tab ${interfaceType === opt.value ? "active" : ""}`}
                  onClick={() => setInterfaceType(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="sandbox-label">Referents</span>
            <div className="sandbox-tabs">
              {DOMAINS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`tab ${domain === opt.value ? "active" : ""}`}
                  onClick={() => setDomain(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {(interfaceType === "inertial" || interfaceType === "etch_a_sketch") ? (
            <div>
              <span className="sandbox-label">Alpha: {alpha.toFixed(2)}</span>
              <input type="range" min="0.02" max="0.5" step="0.01" value={alpha} onChange={(e) => setAlpha(Number(e.target.value))} />
            </div>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
