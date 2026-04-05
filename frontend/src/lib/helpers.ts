import type {
  CanvasPrimitive,
  Condition,
  HistoryEntry,
  ParticipantPhase,
  PrimitiveManifest,
  ReferentManifest,
  StimuliManifest,
} from "../types/contracts";

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

export function referentById(manifest: StimuliManifest, referentId: string) {
  return manifest.referents.find((referent) => referent.id === referentId);
}

export function primitiveMap(primitives: PrimitiveManifest[]) {
  return Object.fromEntries(primitives.map((primitive) => [primitive.id, primitive]));
}

export function playAudio(url: string) {
  const audio = new Audio(url);
  audio.play().catch(() => undefined);
}

export function randomCanvasPoint() {
  const angle = Math.random() * Math.PI * 2;
  const radius = 36 + Math.random() * 56;
  return {
    x: 220 + Math.cos(angle) * radius,
    y: 180 + Math.sin(angle) * radius,
  };
}

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
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

export function buildRecognitionOptions(referents: ReferentManifest[], targetId: string): string[] {
  const others = referents.filter((referent) => referent.id !== targetId).slice(0, 3).map((referent) => referent.id);
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
