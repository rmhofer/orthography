export type Condition = "transparent" | "opaque";
export type ParticipantPhase =
  | "landing"
  | "consent_complete"
  | "learning"
  | "ready_for_lobby"
  | "waiting"
  | "game"
  | "debrief"
  | "completed";

export type InterfaceType = "blocks" | "seismograph" | "inertial" | "telegraph" | "etch_a_sketch" | "pendulum";

export type StudyConfig = {
  condition: "random" | Condition;
  viewMode: "transmit";
  totalTrials: number;
  roleSwapEvery: number;
  maxPrimitivesPerForm: number;
  learningCriterion: number;
  choiceSetSize: number;
  pairingMode: "auto" | "manual";
  interTrialIntervalMs: number;
  speakerTimeLimitS: number;
  pointsPerCorrect: number;
  showWordAudioToSpeaker: boolean;
  historyPreviewSize: number;
  interfaceType?: InterfaceType;
  seismographMode?: "continuous" | "hold_to_draw";
  inertialAlpha?: number;
};

export type PrimitiveManifest = {
  id: string;
  category: "stroke" | "enclosure" | "complex" | "decorator";
  label: string;
  svgUrl: string;
};

export type ReferentManifest = {
  id: string;
  stemId: string;
  modifierId: "bare" | "mod_a" | "mod_b";
  imageUrl: string;
  audio: Record<Condition, string>;
  surfaceForms: Record<Condition, string>;
};

export type StimuliManifest = {
  stems: Array<{ id: string; surface: string; label: string; finalClass: string; shapeId: string }>;
  modifiers: Array<{ id: string; label: string; suffix: string; variant: string; description: string }>;
  primitives: PrimitiveManifest[];
  referents: ReferentManifest[];
};

export type ParticipantBootstrap = {
  participant: {
    id: string;
    token: string;
    phase: ParticipantPhase;
    consented: boolean;
    audioChecked: boolean;
    learningState: Record<string, unknown>;
    completionCode?: string | null;
    slot?: "participant_a" | "participant_b" | null;
    assignedCondition?: Condition;
  };
  studyConfig: StudyConfig;
  assets: StimuliManifest;
  resumableSession?: {
    dyadId: string;
    sessionId: string;
    condition: Condition;
    state: string;
    currentTrialNumber: number;
    cumulativeScore: number;
    history: Array<HistoryEntry>;
  } | null;
};

/* ── Canvas primitives (blocks interface) ──────────────── */

export type CanvasPrimitive = {
  instanceId: string;
  primitiveId: string;
  x: number;
  y: number;
  placementOrder: number;
  createdAtMs: number;
  updatedAtMs: number;
};

/* ── Canvas state: discriminated union across interfaces ── */

export type BlocksCanvasState = {
  interfaceType: "blocks";
  primitives: CanvasPrimitive[];
};

export type SeismographCanvasState = {
  interfaceType: "seismograph";
  trace: { t: number; y: number }[];
  durationMs: number;
};

export type InertialCanvasState = {
  interfaceType: "inertial";
  strokes: { points: { x: number; y: number; t: number }[] }[];
};

export type TelegraphCanvasState = {
  interfaceType: "telegraph";
  pulses: { startMs: number; endMs: number }[];
  durationMs: number;
};

export type EtchASketchCanvasState = {
  interfaceType: "etch_a_sketch";
  strokes: { points: { x: number; y: number; t: number }[] }[];
};

export type PendulumCanvasState = {
  interfaceType: "pendulum";
  trace: { t: number; x: number; y: number }[];
  durationMs: number;
};

export type CanvasState =
  | BlocksCanvasState
  | SeismographCanvasState
  | InertialCanvasState
  | TelegraphCanvasState
  | EtchASketchCanvasState
  | PendulumCanvasState;

/* ── Actions: per-interface action types ───────────────── */

export type BlocksAction =
  | { action: "place"; primitiveInstanceId: string; primitiveId: string; x: number; y: number; timestampMs: number }
  | { action: "move"; primitiveInstanceId: string; x: number; y: number; timestampMs: number }
  | { action: "remove"; primitiveInstanceId: string; timestampMs: number }
  | { action: "submit"; timestampMs: number };

export type SeismographAction =
  | { action: "sample"; t: number; y: number; timestampMs: number }
  | { action: "clear"; timestampMs: number };

export type InertialAction =
  | { action: "stroke_start"; strokeId: string; x: number; y: number; filteredX: number; filteredY: number; timestampMs: number }
  | { action: "stroke_move"; strokeId: string; x: number; y: number; filteredX: number; filteredY: number; timestampMs: number }
  | { action: "stroke_end"; strokeId: string; timestampMs: number }
  | { action: "clear"; timestampMs: number };

export type TelegraphAction =
  | { action: "pulse_start"; t: number; timestampMs: number }
  | { action: "pulse_end"; t: number; timestampMs: number }
  | { action: "clear"; timestampMs: number };

export type EtchASketchAction =
  | { action: "stroke_start"; strokeId: string; x: number; y: number; filteredX: number; filteredY: number; timestampMs: number }
  | { action: "stroke_move"; strokeId: string; x: number; y: number; filteredX: number; filteredY: number; timestampMs: number }
  | { action: "stroke_end"; strokeId: string; timestampMs: number }
  | { action: "clear"; timestampMs: number };

export type PendulumAction =
  | { action: "physics_sample"; t: number; x: number; y: number; forceX: number; forceY: number; timestampMs: number }
  | { action: "clear"; timestampMs: number };

export type SignalAction = BlocksAction | SeismographAction | InertialAction | TelegraphAction | EtchASketchAction | PendulumAction;

// Legacy CanvasAction alias for backward compat
export type CanvasAction = BlocksAction;

/* ── History & trial payloads ──────────────────────────── */

export type HistoryEntry = {
  trialNumber: number;
  targetReferent: string;
  canvasState: CanvasState;
};

export type TrialPayload = {
  trialNumber: number;
  trialType: string;
  role: "speaker" | "listener";
  choiceSet: string[];
  targetReferent: string;
  targetAudioUrl?: string | null;
  timerSeconds: number;
  score: number;
  history: HistoryEntry[];
  condition: Condition;
  speakerToken: string;
  listenerToken: string;
};

/* ── WebSocket messages ────────────────────────────────── */

export type SocketMessage =
  | { event: "phase_sync"; payload: { sessionId: string; dyadId: string; condition: Condition; trial: TrialPayload; score: number; history: HistoryEntry[]; paused: boolean } }
  | { event: "session_resumed"; payload: TrialPayload }
  | { event: "canvas_action_relay"; payload: SignalAction }
  | { event: "speaker_done"; payload: { trialNumber: number; canvasState: CanvasState } }
  | { event: "feedback"; payload: { trialNumber: number; targetReferent: string; selectedReferent: string; correct: boolean; score: number } }
  | { event: "role_swap"; payload: TrialPayload | { completed: true; nextPhase: "debrief" } }
  | { event: "partner_disconnected"; payload: { token: string; reconnectGraceSeconds: number } }
  | { event: "session_paused"; payload: { sessionId: string } }
  | { event: "heartbeat"; payload: { serverTimeMs: number } };
