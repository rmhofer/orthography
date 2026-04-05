import { useMemo, useRef, useState } from "react";

import { primitiveMap, randomCanvasPoint } from "../lib/helpers";
import type { CanvasAction, CanvasPrimitive, PrimitiveManifest } from "../types/contracts";

type CompositionWorkspaceProps = {
  primitives: PrimitiveManifest[];
  placedPrimitives: CanvasPrimitive[];
  onAction?: (action: CanvasAction) => void;
  readOnly?: boolean;
  maxPrimitives: number;
};

export function CompositionWorkspace({
  primitives,
  placedPrimitives,
  onAction,
  readOnly = false,
  maxPrimitives,
}: CompositionWorkspaceProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const lookup = useMemo(() => primitiveMap(primitives), [primitives]);

  function toSvgPoint(clientX: number, clientY: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: 220, y: 180 };
    }
    return {
      x: ((clientX - rect.left) / rect.width) * 440,
      y: ((clientY - rect.top) / rect.height) * 360,
    };
  }

  function addPrimitive(primitiveId: string) {
    if (readOnly || placedPrimitives.length >= maxPrimitives) {
      return;
    }
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

  return (
    <div className="workspace-panel">
      <svg
        ref={svgRef}
        className={`composition-canvas ${readOnly ? "read-only" : ""}`}
        viewBox="0 0 440 360"
        onPointerMove={(event) => {
          if (!draggingId || readOnly) {
            return;
          }
          const point = toSvgPoint(event.clientX, event.clientY);
          onAction?.({
            action: "move",
            primitiveInstanceId: draggingId,
            x: point.x,
            y: point.y,
            timestampMs: Date.now(),
          });
        }}
        onPointerUp={() => setDraggingId(null)}
      >
        <rect x="1" y="1" width="438" height="358" rx="28" />
        {placedPrimitives.map((primitive) => (
          <g
            key={primitive.instanceId}
            transform={`translate(${primitive.x - 18} ${primitive.y - 18})`}
            onPointerDown={() => !readOnly && setDraggingId(primitive.instanceId)}
          >
            <image href={lookup[primitive.primitiveId]?.svgUrl} width="36" height="36" />
            {!readOnly ? (
              <g
                transform="translate(26 -2)"
                className="remove-chip"
                onClick={() =>
                  onAction?.({
                    action: "remove",
                    primitiveInstanceId: primitive.instanceId,
                    timestampMs: Date.now(),
                  })
                }
              >
                <circle cx="10" cy="10" r="10" />
                <path d="M6 6 L14 14 M14 6 L6 14" />
              </g>
            ) : null}
          </g>
        ))}
      </svg>
      {!readOnly ? (
        <div className="tray">
          {primitives.map((primitive) => (
            <button
              key={primitive.id}
              type="button"
              className="tray-item"
              onClick={() => addPrimitive(primitive.id)}
              disabled={placedPrimitives.length >= maxPrimitives}
            >
              <img src={primitive.svgUrl} alt={primitive.label} />
              <span>{primitive.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
