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

export type CanvasPrimitive = {
  instanceId: string;
  primitiveId: string;
  x: number;
  y: number;
  placementOrder: number;
  createdAtMs: number;
  updatedAtMs: number;
};

export type CanvasAction =
  | {
      action: "place";
      primitiveInstanceId: string;
      primitiveId: string;
      x: number;
      y: number;
      timestampMs: number;
    }
  | {
      action: "move";
      primitiveInstanceId: string;
      x: number;
      y: number;
      timestampMs: number;
    }
  | {
      action: "remove";
      primitiveInstanceId: string;
      timestampMs: number;
    }
  | {
      action: "submit";
      timestampMs: number;
    };

export type HistoryEntry = {
  trialNumber: number;
  targetReferent: string;
  canvasState: { primitives: CanvasPrimitive[] };
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

export type SocketMessage =
  | { event: "phase_sync"; payload: { sessionId: string; dyadId: string; condition: Condition; trial: TrialPayload; score: number; history: HistoryEntry[]; paused: boolean } }
  | { event: "session_resumed"; payload: TrialPayload }
  | { event: "speaker_ready"; payload: { trialNumber: number; canvasState: { primitives: CanvasPrimitive[] }; actionLog: CanvasAction[] } }
  | { event: "feedback"; payload: { trialNumber: number; targetReferent: string; selectedReferent: string; correct: boolean; score: number } }
  | { event: "role_swap"; payload: TrialPayload | { completed: true; nextPhase: "debrief" } }
  | { event: "partner_disconnected"; payload: { token: string; reconnectGraceSeconds: number } }
  | { event: "session_paused"; payload: { sessionId: string } }
  | { event: "heartbeat"; payload: { serverTimeMs: number } };
