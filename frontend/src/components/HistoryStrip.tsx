import { primitiveMap } from "../lib/helpers";
import type { HistoryEntry, PrimitiveManifest } from "../types/contracts";

type HistoryStripProps = {
  history: HistoryEntry[];
  primitives: PrimitiveManifest[];
};

export function HistoryStrip({ history, primitives }: HistoryStripProps) {
  const lookup = primitiveMap(primitives);

  return (
    <div className="history-strip">
      <div className="history-title">Recent Forms</div>
      <div className="history-list">
        {history.map((entry) => (
          <div key={entry.trialNumber} className="history-card">
            <span className="history-label">T{entry.trialNumber}</span>
            <svg viewBox="0 0 440 360" className="history-canvas">
              {entry.canvasState.primitives.map((primitive) => (
                <image
                  key={primitive.instanceId}
                  href={lookup[primitive.primitiveId]?.svgUrl}
                  x={primitive.x - 18}
                  y={primitive.y - 18}
                  width="36"
                  height="36"
                />
              ))}
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}
