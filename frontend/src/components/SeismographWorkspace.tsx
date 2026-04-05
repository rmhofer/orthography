import { useCallback, useEffect, useRef, useState } from "react";

import type { SeismographAction, SeismographCanvasState } from "../types/contracts";

type SeismographWorkspaceProps = {
  canvasState: SeismographCanvasState;
  onAction?: (action: SeismographAction) => void;
  readOnly: boolean;
  mode: "continuous" | "hold_to_draw";
  onClear?: () => void;
};

const CANVAS_W = 480;
const CANVAS_H = 320;
const SAMPLE_INTERVAL = 16; // ~60fps

export function SeismographWorkspace({ canvasState, onAction, readOnly, mode, onClear }: SeismographWorkspaceProps) {
  const sliderRef = useRef(0.5);
  const [sliderDisplay, setSliderDisplay] = useState(0.5);
  const startTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number>(0);
  const isHeldRef = useRef(false);
  const [recording, setRecording] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const sample = useCallback(() => {
    if (!onAction || readOnly) return;
    const now = Date.now();
    if (startTimeRef.current === null) startTimeRef.current = now;
    const t = now - startTimeRef.current;
    onAction({ action: "sample", t, y: sliderRef.current, timestampMs: now });
  }, [onAction, readOnly]);

  useEffect(() => {
    if (!recording || readOnly) return;
    let lastSample = 0;
    function tick() {
      const now = Date.now();
      if (now - lastSample >= SAMPLE_INTERVAL) {
        if (mode === "continuous" || isHeldRef.current) {
          sample();
        }
        lastSample = now;
      }
      animFrameRef.current = requestAnimationFrame(tick);
    }
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [recording, readOnly, mode, sample]);

  function handleSliderChange(value: number) {
    sliderRef.current = value;
    setSliderDisplay(value);
    if (!recording && !readOnly) {
      setRecording(true);
    }
  }

  function handlePointerDown() {
    isHeldRef.current = true;
    if (!recording && !readOnly) setRecording(true);
  }

  function handlePointerUp() {
    isHeldRef.current = false;
  }

  // Build SVG polyline from trace
  const trace = canvasState.trace;
  const viewWindowMs = 5000;
  const latestT = trace.length > 0 ? trace[trace.length - 1].t : 0;
  const windowStart = Math.max(0, latestT - viewWindowMs);

  const visibleTrace = trace.filter((s) => s.t >= windowStart);
  const points = visibleTrace
    .map((s) => {
      const x = ((s.t - windowStart) / viewWindowMs) * (CANVAS_W - 20) + 10;
      const y = (1 - s.y) * (CANVAS_H - 20) + 10;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="workspace-panel seismograph-layout">
      {!readOnly ? (
        <div className="seismograph-slider-container">
          <input
            type="range"
            className="seismograph-slider"
            min="0"
            max="1"
            step="0.005"
            value={sliderDisplay}
            onChange={(e) => handleSliderChange(Number(e.target.value))}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
          />
        </div>
      ) : null}
      <div className="seismograph-canvas-container">
        <svg ref={svgRef} className="composition-canvas" viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}>
          <rect x="1" y="1" width={CANVAS_W - 2} height={CANVAS_H - 2} rx="8" />
          {/* Center line */}
          <line x1="10" y1={CANVAS_H / 2} x2={CANVAS_W - 10} y2={CANVAS_H / 2} stroke="#e0e0e0" strokeWidth="1" strokeDasharray="4 4" />
          {/* Trace */}
          {visibleTrace.length > 1 ? (
            <polyline points={points} fill="none" stroke="#121212" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
          {/* Writing head */}
          {!readOnly && visibleTrace.length > 0 ? (
            <circle
              cx={CANVAS_W - 10}
              cy={(1 - sliderDisplay) * (CANVAS_H - 20) + 10}
              r="5"
              fill="#121212"
            />
          ) : null}
        </svg>
      </div>
      {null}
    </div>
  );
}
