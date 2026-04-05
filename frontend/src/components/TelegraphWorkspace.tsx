import { useEffect, useRef, useState } from "react";

import type { TelegraphAction, TelegraphCanvasState } from "../types/contracts";

type TelegraphWorkspaceProps = {
  canvasState: TelegraphCanvasState;
  onAction?: (action: TelegraphAction) => void;
  readOnly: boolean;
  onClear?: () => void;
};

const CANVAS_W = 440;
const CANVAS_H = 360;
const VIEW_WINDOW_MS = 5000;

export function TelegraphWorkspace({ canvasState, onAction, readOnly, onClear }: TelegraphWorkspaceProps) {
  const startTimeRef = useRef<number | null>(null);
  const [keyDown, setKeyDown] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const animFrame = useRef<number>(0);

  // Tick to keep elapsed current for the scrolling view
  useEffect(() => {
    if (readOnly || startTimeRef.current === null) return;
    function tick() {
      if (startTimeRef.current !== null) {
        setElapsed(Date.now() - startTimeRef.current);
      }
      animFrame.current = requestAnimationFrame(tick);
    }
    animFrame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrame.current);
  }, [readOnly, canvasState.pulses.length]);

  function handleKeyDown() {
    if (readOnly || keyDown) return;
    const now = Date.now();
    if (startTimeRef.current === null) startTimeRef.current = now;
    setKeyDown(true);
    onAction?.({ action: "pulse_start", t: now - startTimeRef.current, timestampMs: now });
  }

  function handleKeyUp() {
    if (readOnly || !keyDown) return;
    const now = Date.now();
    if (startTimeRef.current === null) return;
    setKeyDown(false);
    onAction?.({ action: "pulse_end", t: now - startTimeRef.current, timestampMs: now });
  }

  // Global key listeners (spacebar)
  useEffect(() => {
    if (readOnly) return;
    function onDown(e: KeyboardEvent) {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        handleKeyDown();
      }
    }
    function onUp(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        handleKeyUp();
      }
    }
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  });

  // Render pulses in a scrolling window
  const windowEnd = elapsed || canvasState.durationMs || VIEW_WINDOW_MS;
  const windowStart = Math.max(0, windowEnd - VIEW_WINDOW_MS);

  const pulseRects = canvasState.pulses
    .filter((p) => p.endMs > windowStart && p.startMs < windowEnd)
    .map((pulse, i) => {
      const x1 = Math.max(0, ((pulse.startMs - windowStart) / VIEW_WINDOW_MS) * (CANVAS_W - 20) + 10);
      const x2 = Math.min(CANVAS_W - 10, ((pulse.endMs - windowStart) / VIEW_WINDOW_MS) * (CANVAS_W - 20) + 10);
      return <rect key={i} x={x1} y={90} width={Math.max(2, x2 - x1)} height={180} fill="#121212" rx="2" />;
    });

  return (
    <div className="workspace-panel">
      <svg className="composition-canvas" viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}>
        <rect x="1" y="1" width={CANVAS_W - 2} height={CANVAS_H - 2} rx="8" />
        {/* Baseline */}
        <line x1="10" y1={CANVAS_H / 2} x2={CANVAS_W - 10} y2={CANVAS_H / 2} stroke="#e0e0e0" strokeWidth="1" strokeDasharray="4 4" />
        {pulseRects}
        {/* Active pulse indicator */}
        {keyDown ? <rect x={CANVAS_W - 14} y={90} width={4} height={180} fill="#c4453a" rx="2" /> : null}
      </svg>
      {!readOnly ? (
        <>
          <div className="telegraph-key-row">
            <button
              type="button"
              className={`telegraph-key ${keyDown ? "active" : ""}`}
              onPointerDown={handleKeyDown}
              onPointerUp={handleKeyUp}
              onPointerLeave={handleKeyUp}
            >
              {keyDown ? "KEY DOWN" : "PRESS / HOLD"}
            </button>
            <span className="muted-copy" style={{ fontSize: "0.75rem" }}>or use Spacebar</span>
          </div>
          <div className="canvas-actions">
            <div className="canvas-actions-left">
              <button type="button" className="icon-button" onClick={() => { startTimeRef.current = null; setElapsed(0); onClear?.(); }}>
                Clear
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
