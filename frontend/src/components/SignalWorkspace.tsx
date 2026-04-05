import { CanvasStateRenderer } from "./CanvasStateRenderer";
import { CompositionWorkspace } from "./CompositionWorkspace";
import { EtchASketchWorkspace } from "./EtchASketchWorkspace";
import { InertialWorkspace } from "./InertialWorkspace";
import { PendulumWorkspace } from "./PendulumWorkspace";
import { SeismographWorkspace } from "./SeismographWorkspace";
import { TelegraphWorkspace } from "./TelegraphWorkspace";
import type {
  CanvasState,
  InterfaceType,
  PrimitiveManifest,
  SignalAction,
} from "../types/contracts";

type SignalWorkspaceProps = {
  interfaceType: InterfaceType;
  canvasState: CanvasState;
  onAction?: (action: SignalAction) => void;
  readOnly: boolean;
  primitives?: PrimitiveManifest[];
  maxPrimitives?: number;
  seismographMode?: "continuous" | "hold_to_draw";
  inertialAlpha?: number;
  onClear?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
};

export function SignalWorkspace({
  interfaceType,
  canvasState,
  onAction,
  readOnly,
  primitives,
  maxPrimitives = 10,
  seismographMode = "hold_to_draw",
  inertialAlpha = 0.15,
  onClear,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: SignalWorkspaceProps) {
  // For read-only mode across all types, use the generic renderer
  if (readOnly && interfaceType !== "blocks") {
    return (
      <div className="workspace-panel">
        <CanvasStateRenderer canvasState={canvasState} primitives={primitives} className="composition-canvas" />
      </div>
    );
  }

  if (interfaceType === "blocks" && canvasState.interfaceType === "blocks") {
    return (
      <CompositionWorkspace
        primitives={primitives ?? []}
        placedPrimitives={canvasState.primitives}
        onAction={readOnly ? undefined : (onAction as any)}
        readOnly={readOnly}
        maxPrimitives={maxPrimitives}
        onClear={onClear}
        onUndo={onUndo}
        onRedo={onRedo}
        canUndo={canUndo}
        canRedo={canRedo}
      />
    );
  }

  if (interfaceType === "seismograph" && canvasState.interfaceType === "seismograph") {
    return (
      <SeismographWorkspace
        canvasState={canvasState}
        onAction={readOnly ? undefined : (onAction as any)}
        readOnly={readOnly}
        mode={seismographMode}
        onClear={onClear}
      />
    );
  }

  if (interfaceType === "inertial" && canvasState.interfaceType === "inertial") {
    return (
      <InertialWorkspace
        canvasState={canvasState}
        onAction={readOnly ? undefined : (onAction as any)}
        readOnly={readOnly}
        alpha={inertialAlpha}
        onClear={onClear}
        onUndo={onUndo}
        canUndo={canUndo}
      />
    );
  }

  if (interfaceType === "telegraph" && canvasState.interfaceType === "telegraph") {
    return (
      <TelegraphWorkspace
        canvasState={canvasState}
        onAction={readOnly ? undefined : (onAction as any)}
        readOnly={readOnly}
        onClear={onClear}
      />
    );
  }

  if (interfaceType === "etch_a_sketch" && canvasState.interfaceType === "etch_a_sketch") {
    return (
      <EtchASketchWorkspace
        canvasState={canvasState}
        onAction={readOnly ? undefined : (onAction as any)}
        readOnly={readOnly}
        alphaX={inertialAlpha}
        alphaY={inertialAlpha * 0.6}
        onClear={onClear}
        onUndo={onUndo}
        canUndo={canUndo}
      />
    );
  }

  if (interfaceType === "pendulum" && canvasState.interfaceType === "pendulum") {
    return (
      <PendulumWorkspace
        canvasState={canvasState}
        onAction={readOnly ? undefined : (onAction as any)}
        readOnly={readOnly}
        onClear={onClear}
      />
    );
  }

  // Fallback: generic renderer
  return (
    <div className="workspace-panel">
      <CanvasStateRenderer canvasState={canvasState} primitives={primitives} className="composition-canvas" />
    </div>
  );
}
