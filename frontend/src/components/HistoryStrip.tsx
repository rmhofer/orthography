import { CanvasStateRenderer } from "./CanvasStateRenderer";
import type { HistoryEntry, PrimitiveManifest } from "../types/contracts";

type HistoryStripProps = {
  history: HistoryEntry[];
  primitives: PrimitiveManifest[];
};

export function HistoryStrip({ history, primitives }: HistoryStripProps) {
  return (
    <div className="history-strip">
      <div className="history-title">Recent Forms</div>
      <div className="history-list">
        {history.map((entry) => (
          <div key={entry.trialNumber} className="history-card">
            <span className="history-label">T{entry.trialNumber}</span>
            <CanvasStateRenderer canvasState={entry.canvasState} primitives={primitives} className="history-canvas" />
          </div>
        ))}
      </div>
    </div>
  );
}
