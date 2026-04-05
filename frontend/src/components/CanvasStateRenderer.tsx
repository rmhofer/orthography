import { useMemo } from "react";

import { primitiveMap } from "../lib/helpers";
import type { CanvasState, PrimitiveManifest } from "../types/contracts";

type CanvasStateRendererProps = {
  canvasState: CanvasState;
  primitives?: PrimitiveManifest[];
  className?: string;
};

export function CanvasStateRenderer({ canvasState, primitives, className }: CanvasStateRendererProps) {
  const lookup = useMemo(() => (primitives ? primitiveMap(primitives) : {}), [primitives]);

  if (canvasState.interfaceType === "blocks") {
    return (
      <svg viewBox="0 0 440 360" className={className}>
        {canvasState.primitives.map((p) => (
          <image key={p.instanceId} href={lookup[p.primitiveId]?.svgUrl} x={p.x - 18} y={p.y - 18} width="36" height="36" />
        ))}
      </svg>
    );
  }

  if (canvasState.interfaceType === "seismograph") {
    const trace = canvasState.trace;
    if (trace.length === 0) return <svg viewBox="0 0 440 360" className={className} />;
    const maxT = canvasState.durationMs || trace[trace.length - 1].t || 1;
    const points = trace.map((s) => `${(s.t / maxT) * 430 + 5},${(1 - s.y) * 350 + 5}`).join(" ");
    return (
      <svg viewBox="0 0 440 360" className={className}>
        <polyline points={points} fill="none" stroke="#121212" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    );
  }

  if (canvasState.interfaceType === "inertial" || canvasState.interfaceType === "etch_a_sketch") {
    return (
      <svg viewBox="0 0 440 360" className={className}>
        {canvasState.strokes.map((stroke, i) => {
          if (stroke.points.length < 2) return null;
          const d = stroke.points.map((p, j) => `${j === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
          return <path key={i} d={d} fill="none" stroke="#121212" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;
        })}
      </svg>
    );
  }

  if (canvasState.interfaceType === "telegraph") {
    const pulses = canvasState.pulses;
    if (pulses.length === 0) return <svg viewBox="0 0 440 360" className={className} />;
    const maxT = canvasState.durationMs || pulses[pulses.length - 1].endMs || 1;
    return (
      <svg viewBox="0 0 440 360" className={className}>
        <line x1="5" y1="270" x2="435" y2="270" stroke="#e0e0e0" strokeWidth="1" />
        {pulses.map((pulse, i) => {
          const x1 = (pulse.startMs / maxT) * 430 + 5;
          const x2 = (pulse.endMs / maxT) * 430 + 5;
          return <rect key={i} x={x1} y={90} width={Math.max(2, x2 - x1)} height={180} fill="#121212" rx="2" />;
        })}
      </svg>
    );
  }

  if (canvasState.interfaceType === "pendulum") {
    const trace = canvasState.trace;
    if (trace.length < 2) return <svg viewBox="0 0 440 360" className={className} />;
    const d = trace.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    return (
      <svg viewBox="0 0 440 360" className={className}>
        <path d={d} fill="none" stroke="#121212" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return <svg viewBox="0 0 440 360" className={className} />;
}
