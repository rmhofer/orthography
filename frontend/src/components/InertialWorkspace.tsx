import { useCallback, useEffect, useRef, useState } from "react";

import type { InertialAction, InertialCanvasState } from "../types/contracts";

type InertialWorkspaceProps = {
  canvasState: InertialCanvasState;
  onAction?: (action: InertialAction) => void;
  readOnly: boolean;
  alpha: number;
  onClear?: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
};

const CANVAS_W = 440;
const CANVAS_H = 360;

export function InertialWorkspace({ canvasState, onAction, readOnly, alpha, onClear, onUndo, canUndo }: InertialWorkspaceProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const isDrawing = useRef(false);
  const strokeId = useRef<string>("");
  const targetPos = useRef({ x: CANVAS_W / 2, y: CANVAS_H / 2 });
  const filteredPos = useRef({ x: CANVAS_W / 2, y: CANVAS_H / 2 });
  const [crosshair, setCrosshair] = useState({ x: CANVAS_W / 2, y: CANVAS_H / 2 });
  const [penPos, setPenPos] = useState({ x: CANVAS_W / 2, y: CANVAS_H / 2 });
  const animFrame = useRef<number>(0);

  const toSvgPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: CANVAS_W / 2, y: CANVAS_H / 2 };
    const rect = svg.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(CANVAS_W, ((clientX - rect.left) / rect.width) * CANVAS_W)),
      y: Math.max(0, Math.min(CANVAS_H, ((clientY - rect.top) / rect.height) * CANVAS_H)),
    };
  }, []);

  useEffect(() => {
    if (readOnly || !isDrawing.current) return;
    function tick() {
      if (!isDrawing.current) return;
      const prev = filteredPos.current;
      const target = targetPos.current;
      const fx = prev.x + alpha * (target.x - prev.x);
      const fy = prev.y + alpha * (target.y - prev.y);
      filteredPos.current = { x: fx, y: fy };
      setPenPos({ x: fx, y: fy });
      onAction?.({
        action: "stroke_move",
        strokeId: strokeId.current,
        x: target.x,
        y: target.y,
        filteredX: fx,
        filteredY: fy,
        timestampMs: Date.now(),
      });
      animFrame.current = requestAnimationFrame(tick);
    }
    animFrame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrame.current);
  }, [readOnly, alpha, onAction]);

  function handlePointerDown(clientX: number, clientY: number) {
    if (readOnly) return;
    const pt = toSvgPoint(clientX, clientY);
    targetPos.current = pt;
    filteredPos.current = pt;
    strokeId.current = crypto.randomUUID();
    isDrawing.current = true;
    setCrosshair(pt);
    setPenPos(pt);
    onAction?.({
      action: "stroke_start",
      strokeId: strokeId.current,
      x: pt.x,
      y: pt.y,
      filteredX: pt.x,
      filteredY: pt.y,
      timestampMs: Date.now(),
    });
    // Re-trigger effect by forcing a state update
    setPenPos({ ...pt });
  }

  function handlePointerMove(clientX: number, clientY: number) {
    if (readOnly) return;
    const pt = toSvgPoint(clientX, clientY);
    targetPos.current = pt;
    setCrosshair(pt);
  }

  function handlePointerUp() {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    cancelAnimationFrame(animFrame.current);
    onAction?.({ action: "stroke_end", strokeId: strokeId.current, timestampMs: Date.now() });
  }

  // Render strokes
  const strokePaths = canvasState.strokes.map((stroke, i) => {
    if (stroke.points.length < 2) return null;
    const d = stroke.points.map((p, j) => `${j === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    return <path key={i} d={d} fill="none" stroke="#121212" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />;
  });

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
        {strokePaths}
        {!readOnly ? (
          <>
            {/* Crosshair at raw mouse position */}
            <line x1={crosshair.x - 8} y1={crosshair.y} x2={crosshair.x + 8} y2={crosshair.y} stroke="#c4c4c4" strokeWidth="1" />
            <line x1={crosshair.x} y1={crosshair.y - 8} x2={crosshair.x} y2={crosshair.y + 8} stroke="#c4c4c4" strokeWidth="1" />
            {/* Pen position (filtered) */}
            <circle cx={penPos.x} cy={penPos.y} r="4" fill="#121212" />
          </>
        ) : null}
      </svg>
      {!readOnly ? (
        <div className="canvas-actions">
          <div className="canvas-actions-left">
            <button type="button" className="icon-button" onClick={onClear}>Clear</button>
            <button type="button" className="icon-button" onClick={onUndo} disabled={!canUndo} title="Undo last stroke">
              <svg viewBox="0 0 20 20" width="16" height="16"><path d="M5 10l5-5v3h4a4 4 0 010 8H9v-2h5a2 2 0 000-4h-4v3L5 10z" fill="currentColor"/></svg>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
