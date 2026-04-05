import { useCallback, useEffect, useRef, useState } from "react";

import type { PendulumAction, PendulumCanvasState } from "../types/contracts";

type PendulumWorkspaceProps = {
  canvasState: PendulumCanvasState;
  onAction?: (action: PendulumAction) => void;
  readOnly: boolean;
  onClear?: () => void;
};

const CANVAS_W = 440;
const CANVAS_H = 360;
const CX = CANVAS_W / 2;
const CY = CANVAS_H / 2;
const GRAVITY = 0.0003;
const DAMPING = 0.995;
const FORCE_SCALE = 0.00015;

export function PendulumWorkspace({ canvasState, onAction, readOnly, onClear }: PendulumWorkspaceProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const posRef = useRef({ x: CX, y: CY });
  const velRef = useRef({ x: 0, y: 0 });
  const forceTarget = useRef<{ x: number; y: number } | null>(null);
  const isApplyingForce = useRef(false);
  const startTimeRef = useRef<number | null>(null);
  const animFrame = useRef<number>(0);
  const [bobPos, setBobPos] = useState({ x: CX, y: CY });
  const [running, setRunning] = useState(false);

  const toSvgPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: CX, y: CY };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((clientY - rect.top) / rect.height) * CANVAS_H,
    };
  }, []);

  useEffect(() => {
    if (readOnly || !running) return;
    function tick() {
      const pos = posRef.current;
      const vel = velRef.current;

      // Gravity toward center
      const dx = CX - pos.x;
      const dy = CY - pos.y;
      vel.x += dx * GRAVITY;
      vel.y += dy * GRAVITY;

      // User force
      if (isApplyingForce.current && forceTarget.current) {
        const fx = (forceTarget.current.x - pos.x) * FORCE_SCALE;
        const fy = (forceTarget.current.y - pos.y) * FORCE_SCALE;
        vel.x += fx;
        vel.y += fy;
      }

      // Damping
      vel.x *= DAMPING;
      vel.y *= DAMPING;

      // Integrate
      pos.x += vel.x;
      pos.y += vel.y;

      // Clamp
      pos.x = Math.max(5, Math.min(CANVAS_W - 5, pos.x));
      pos.y = Math.max(5, Math.min(CANVAS_H - 5, pos.y));

      setBobPos({ x: pos.x, y: pos.y });

      const now = Date.now();
      if (startTimeRef.current === null) startTimeRef.current = now;
      const t = now - startTimeRef.current;
      const fxOut = isApplyingForce.current && forceTarget.current ? (forceTarget.current.x - pos.x) * FORCE_SCALE : 0;
      const fyOut = isApplyingForce.current && forceTarget.current ? (forceTarget.current.y - pos.y) * FORCE_SCALE : 0;
      onAction?.({ action: "physics_sample", t, x: pos.x, y: pos.y, forceX: fxOut, forceY: fyOut, timestampMs: now });

      animFrame.current = requestAnimationFrame(tick);
    }
    animFrame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrame.current);
  }, [readOnly, running, onAction]);

  function handlePointerDown(clientX: number, clientY: number) {
    if (readOnly) return;
    forceTarget.current = toSvgPoint(clientX, clientY);
    isApplyingForce.current = true;
    if (!running) setRunning(true);
  }

  function handlePointerMove(clientX: number, clientY: number) {
    if (readOnly || !isApplyingForce.current) return;
    forceTarget.current = toSvgPoint(clientX, clientY);
  }

  function handlePointerUp() {
    isApplyingForce.current = false;
    forceTarget.current = null;
  }

  // Render trace from state
  const trace = canvasState.trace;
  let tracePath = "";
  if (trace.length > 1) {
    tracePath = trace.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  }

  return (
    <div className="workspace-panel">
      <svg
        ref={svgRef}
        className={`composition-canvas ${readOnly ? "read-only" : ""}`}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        onPointerDown={(e) => handlePointerDown(e.clientX, e.clientY)}
        onPointerMove={(e) => handlePointerMove(e.clientX, e.clientY)}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <rect x="1" y="1" width={CANVAS_W - 2} height={CANVAS_H - 2} rx="8" />
        {/* Center anchor */}
        <circle cx={CX} cy={CY} r="3" fill="#e0e0e0" />
        {/* Trace */}
        {tracePath ? <path d={tracePath} fill="none" stroke="#121212" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {/* Bob */}
        {!readOnly ? (
          <>
            <circle cx={bobPos.x} cy={bobPos.y} r="6" fill="#121212" />
            {/* Force direction indicator */}
            {isApplyingForce.current && forceTarget.current ? (
              <line
                x1={bobPos.x}
                y1={bobPos.y}
                x2={forceTarget.current.x}
                y2={forceTarget.current.y}
                stroke="#c4c4c4"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            ) : null}
          </>
        ) : null}
      </svg>
      {!readOnly ? (
        <div className="canvas-actions">
          <div className="canvas-actions-left">
            <button type="button" className="icon-button" onClick={() => {
              posRef.current = { x: CX, y: CY };
              velRef.current = { x: 0, y: 0 };
              startTimeRef.current = null;
              setRunning(false);
              setBobPos({ x: CX, y: CY });
              onClear?.();
            }}>
              Clear
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
