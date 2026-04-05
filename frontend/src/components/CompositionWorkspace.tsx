import { useCallback, useMemo, useRef, useState } from "react";

import { primitiveMap, randomCanvasPoint } from "../lib/helpers";
import type { CanvasAction, CanvasPrimitive, PrimitiveManifest } from "../types/contracts";

type CompositionWorkspaceProps = {
  primitives: PrimitiveManifest[];
  placedPrimitives: CanvasPrimitive[];
  onAction?: (action: CanvasAction) => void;
  readOnly?: boolean;
  maxPrimitives: number;
  onClear?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
};

export function CompositionWorkspace({
  primitives,
  placedPrimitives,
  onAction,
  readOnly = false,
  maxPrimitives,
  onClear,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: CompositionWorkspaceProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragOffset = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const lookup = useMemo(() => primitiveMap(primitives), [primitives]);

  const toSvgPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) {
      return { x: 220, y: 180 };
    }
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 440,
      y: ((clientY - rect.top) / rect.height) * 360,
    };
  }, []);

  function handlePointerDown(instanceId: string, clientX: number, clientY: number) {
    if (readOnly) return;
    const primitive = placedPrimitives.find((p) => p.instanceId === instanceId);
    if (!primitive) return;
    const svgPt = toSvgPoint(clientX, clientY);
    dragOffset.current = { dx: primitive.x - svgPt.x, dy: primitive.y - svgPt.y };
    setDraggingId(instanceId);
    setActiveId(instanceId);
  }

  function handlePointerMove(clientX: number, clientY: number) {
    if (!draggingId || readOnly) return;
    const svgPt = toSvgPoint(clientX, clientY);
    onAction?.({
      action: "move",
      primitiveInstanceId: draggingId,
      x: svgPt.x + dragOffset.current.dx,
      y: svgPt.y + dragOffset.current.dy,
      timestampMs: Date.now(),
    });
  }

  function addPrimitive(primitiveId: string) {
    if (readOnly || placedPrimitives.length >= maxPrimitives) return;
    const point = randomCanvasPoint();
    onAction?.({
      action: "place",
      primitiveInstanceId: crypto.randomUUID(),
      primitiveId,
      x: point.x,
      y: point.y,
      timestampMs: Date.now(),
    });
  }

  function handleCanvasClick() {
    if (!readOnly) setActiveId(null);
  }

  return (
    <div className="workspace-panel">
      <svg
        ref={svgRef}
        className={`composition-canvas ${readOnly ? "read-only" : ""}`}
        viewBox="0 0 440 360"
        onPointerMove={(e) => handlePointerMove(e.clientX, e.clientY)}
        onPointerUp={() => setDraggingId(null)}
        onPointerLeave={() => setDraggingId(null)}
        onClick={handleCanvasClick}
      >
        <rect x="1" y="1" width="438" height="358" rx="8" />
        {placedPrimitives.map((primitive) => (
          <g
            key={primitive.instanceId}
            transform={`translate(${primitive.x - 18} ${primitive.y - 18})`}
            onPointerDown={(e) => {
              e.stopPropagation();
              handlePointerDown(primitive.instanceId, e.clientX, e.clientY);
            }}
            onClick={(e) => e.stopPropagation()}
            style={{ cursor: readOnly ? "default" : "grab" }}
          >
            <image href={lookup[primitive.primitiveId]?.svgUrl} width="36" height="36" />
            {!readOnly && activeId === primitive.instanceId ? (
              <g
                transform="translate(26 -2)"
                className="remove-chip"
                onClick={(e) => {
                  e.stopPropagation();
                  onAction?.({
                    action: "remove",
                    primitiveInstanceId: primitive.instanceId,
                    timestampMs: Date.now(),
                  });
                  setActiveId(null);
                }}
              >
                <circle cx="10" cy="10" r="10" />
                <path d="M6 6 L14 14 M14 6 L6 14" />
              </g>
            ) : null}
          </g>
        ))}
      </svg>
      {!readOnly ? (
        <>
          <div className="tray">
            {primitives.map((primitive) => (
              <button
                key={primitive.id}
                type="button"
                className="tray-item"
                onClick={() => addPrimitive(primitive.id)}
                disabled={placedPrimitives.length >= maxPrimitives}
                title={primitive.label}
              >
                <img src={primitive.svgUrl} alt={primitive.label} />
              </button>
            ))}
          </div>
          <div className="canvas-actions">
            <div className="canvas-actions-left">
              <button type="button" className="icon-button" onClick={onClear} title="Clear canvas">
                Clear
              </button>
              <button type="button" className="icon-button" onClick={onUndo} disabled={!canUndo} title="Undo">
                <svg viewBox="0 0 20 20" width="16" height="16"><path d="M5 10l5-5v3h4a4 4 0 010 8H9v-2h5a2 2 0 000-4h-4v3L5 10z" fill="currentColor"/></svg>
              </button>
              <button type="button" className="icon-button" onClick={onRedo} disabled={!canRedo} title="Redo">
                <svg viewBox="0 0 20 20" width="16" height="16"><path d="M15 10l-5-5v3H6a4 4 0 000 8h5v-2H6a2 2 0 010-4h4v3l5-5z" fill="currentColor"/></svg>
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
