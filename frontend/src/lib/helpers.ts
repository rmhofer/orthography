import type {
  BlocksAction,
  CanvasPrimitive,
  CanvasState,
  Condition,
  EtchASketchAction,
  HistoryEntry,
  InertialAction,
  InterfaceType,
  ParticipantPhase,
  PendulumAction,
  PrimitiveManifest,
  ReferentManifest,
  SeismographAction,
  SignalAction,
  StimuliManifest,
  TelegraphAction,
} from "../types/contracts";

/* ── Routing ───────────────────────────────────────────── */

export function phaseRoute(token: string, phase: ParticipantPhase): string {
  switch (phase) {
    case "learning":
      return `/session/${token}/learning`;
    case "ready_for_lobby":
    case "waiting":
      return `/session/${token}/lobby`;
    case "game":
      return `/session/${token}/game`;
    case "debrief":
      return `/session/${token}/debrief`;
    case "completed":
      return `/session/${token}/completion`;
    default:
      return `/session/${token}`;
  }
}

/* ── Referent / primitive lookups ──────────────────────── */

export function referentById(manifest: StimuliManifest, referentId: string) {
  return manifest.referents.find((referent) => referent.id === referentId);
}

export function primitiveMap(primitives: PrimitiveManifest[]) {
  return Object.fromEntries(primitives.map((primitive) => [primitive.id, primitive]));
}

/* ── Audio ─────────────────────────────────────────────── */

export function playAudio(url: string) {
  const audio = new Audio(url);
  audio.play().catch(() => undefined);
}

/* ── Canvas helpers ────────────────────────────────────── */

export function randomCanvasPoint() {
  const angle = Math.random() * Math.PI * 2;
  const radius = 36 + Math.random() * 56;
  return {
    x: 220 + Math.cos(angle) * radius,
    y: 180 + Math.sin(angle) * radius,
  };
}

/* ── Canvas state: normalize, create, reduce ───────────── */

export function normalizeCanvasState(raw: unknown): CanvasState {
  if (typeof raw === "object" && raw !== null && "interfaceType" in raw) {
    return raw as CanvasState;
  }
  const legacy = raw as { primitives?: CanvasPrimitive[] } | undefined;
  return { interfaceType: "blocks", primitives: legacy?.primitives ?? [] };
}

export function makeEmptyCanvasState(interfaceType: InterfaceType): CanvasState {
  switch (interfaceType) {
    case "blocks":
      return { interfaceType: "blocks", primitives: [] };
    case "seismograph":
      return { interfaceType: "seismograph", trace: [], durationMs: 0 };
    case "inertial":
      return { interfaceType: "inertial", strokes: [] };
    case "telegraph":
      return { interfaceType: "telegraph", pulses: [], durationMs: 0 };
    case "etch_a_sketch":
      return { interfaceType: "etch_a_sketch", strokes: [] };
    case "pendulum":
      return { interfaceType: "pendulum", trace: [], durationMs: 0 };
  }
}

export function applyActionToCanvasState(state: CanvasState, action: SignalAction): CanvasState {
  if (state.interfaceType === "blocks") {
    const a = action as BlocksAction;
    if (a.action === "place") {
      return {
        ...state,
        primitives: [
          ...state.primitives,
          {
            instanceId: a.primitiveInstanceId,
            primitiveId: a.primitiveId,
            x: a.x,
            y: a.y,
            placementOrder: state.primitives.length + 1,
            createdAtMs: a.timestampMs,
            updatedAtMs: a.timestampMs,
          },
        ],
      };
    }
    if (a.action === "move") {
      return {
        ...state,
        primitives: state.primitives.map((p) =>
          p.instanceId === a.primitiveInstanceId ? { ...p, x: a.x, y: a.y, updatedAtMs: a.timestampMs } : p,
        ),
      };
    }
    if (a.action === "remove") {
      return { ...state, primitives: state.primitives.filter((p) => p.instanceId !== a.primitiveInstanceId) };
    }
    return state;
  }

  if (state.interfaceType === "seismograph") {
    const a = action as SeismographAction;
    if (a.action === "sample") {
      const trace = [...state.trace, { t: a.t, y: a.y }];
      return { ...state, trace, durationMs: a.t };
    }
    if (a.action === "clear") {
      return { interfaceType: "seismograph", trace: [], durationMs: 0 };
    }
    return state;
  }

  if (state.interfaceType === "inertial" || state.interfaceType === "etch_a_sketch") {
    const a = action as InertialAction | EtchASketchAction;
    if (a.action === "stroke_start") {
      return { ...state, strokes: [...state.strokes, { points: [{ x: a.filteredX, y: a.filteredY, t: a.timestampMs }] }] };
    }
    if (a.action === "stroke_move") {
      const strokes = [...state.strokes];
      const last = strokes[strokes.length - 1];
      if (last) {
        strokes[strokes.length - 1] = { points: [...last.points, { x: a.filteredX, y: a.filteredY, t: a.timestampMs }] };
      }
      return { ...state, strokes };
    }
    if (a.action === "clear") {
      return { ...state, strokes: [] };
    }
    return state;
  }

  if (state.interfaceType === "telegraph") {
    const a = action as TelegraphAction;
    if (a.action === "pulse_start") {
      return { ...state, pulses: [...state.pulses, { startMs: a.t, endMs: a.t }], durationMs: a.t };
    }
    if (a.action === "pulse_end") {
      const pulses = [...state.pulses];
      const last = pulses[pulses.length - 1];
      if (last) {
        pulses[pulses.length - 1] = { ...last, endMs: a.t };
      }
      return { ...state, pulses, durationMs: a.t };
    }
    if (a.action === "clear") {
      return { interfaceType: "telegraph", pulses: [], durationMs: 0 };
    }
    return state;
  }

  if (state.interfaceType === "pendulum") {
    const a = action as PendulumAction;
    if (a.action === "physics_sample") {
      return { ...state, trace: [...state.trace, { t: a.t, x: a.x, y: a.y }], durationMs: a.t };
    }
    if (a.action === "clear") {
      return { interfaceType: "pendulum", trace: [], durationMs: 0 };
    }
    return state;
  }

  return state;
}

/* ── Local storage persistence ─────────────────────────── */

export function storageKey(token: string, key: string) {
  return `symbol-games:${token}:${key}`;
}

export function persistHistory(token: string, history: HistoryEntry[]) {
  localStorage.setItem(storageKey(token, "history"), JSON.stringify(history));
}

export function loadHistory(token: string): HistoryEntry[] {
  const raw = localStorage.getItem(storageKey(token, "history"));
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return parsed.map((entry) => ({ ...entry, canvasState: normalizeCanvasState(entry.canvasState) }));
  } catch {
    return [];
  }
}

/* ── Debrief helpers ───────────────────────────────────── */

export function buildRecognitionOptions(referents: ReferentManifest[], targetId: string): string[] {
  const others = referents
    .filter((referent) => referent.id !== targetId)
    .slice(0, 3)
    .map((referent) => referent.id);
  return shuffle([targetId, ...others]);
}

export function buildNovelPrompts(referents: ReferentManifest[]) {
  const stems = Array.from(new Set(referents.map((referent) => referent.stemId))).slice(0, 2);
  return stems.map((stemId, index) => {
    const targetId = `${stemId}_${index === 0 ? "mod_b" : "mod_a"}`;
    return {
      promptId: `novel-${stemId}`,
      targetId,
      options: buildRecognitionOptions(referents, targetId),
    };
  });
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function formatModifierLabel(referent: ReferentManifest) {
  if (referent.modifierId === "mod_a") {
    return "Red";
  }
  if (referent.modifierId === "mod_b") {
    return "Large";
  }
  return "Base";
}

export function createPracticePrompt(primitives: PrimitiveManifest[]) {
  return {
    target: ["Try building a form with 2-3 symbols.", "Move a symbol, then remove one before submitting."],
    primitives,
  };
}
