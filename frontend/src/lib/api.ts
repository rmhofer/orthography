import type { ParticipantBootstrap, StudyConfig } from "../types/contracts";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function startParticipant(token?: string, interfaceType?: string) {
  return apiFetch<{ token: string; participantId: string; phase: string }>("/api/participants/start", {
    method: "POST",
    body: JSON.stringify({ token, recruitmentData: {}, interfaceType }),
  });
}

export async function bootstrapParticipant(token: string): Promise<ParticipantBootstrap> {
  return apiFetch<ParticipantBootstrap>(`/api/participants/${token}/bootstrap`);
}

export async function recordConsent(token: string, consented: boolean) {
  return apiFetch(`/api/participants/${token}/consent`, {
    method: "POST",
    body: JSON.stringify({ consented }),
  });
}

export async function recordAudioCheck(token: string, passed: boolean) {
  return apiFetch(`/api/participants/${token}/audio-check`, {
    method: "POST",
    body: JSON.stringify({ passed }),
  });
}

export async function recordExposure(token: string, referentId: string) {
  return apiFetch(`/api/participants/${token}/learning/exposure`, {
    method: "POST",
    body: JSON.stringify({ referentId }),
  });
}

export async function recordQuiz(token: string, payload: { taskType: string; referentId: string; selectedReferentId?: string; isCorrect: boolean }) {
  return apiFetch<{ slidingAccuracy: number; windowSize: number; passed: boolean }>(`/api/participants/${token}/learning/quiz`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function completeLearning(token: string, practiceTrialsCompleted = 2) {
  return apiFetch(`/api/participants/${token}/learning/complete`, {
    method: "POST",
    body: JSON.stringify({ practiceTrialsCompleted }),
  });
}

export async function joinLobby(token: string) {
  return apiFetch<{ participantPhase: string; pairedSession: { sessionId: string } | null }>(`/api/participants/${token}/lobby/join`, {
    method: "POST",
    body: JSON.stringify({ ready: true }),
  });
}

export async function submitDebrief(token: string, answers: Record<string, unknown>) {
  return apiFetch<{ phase: string; completionCode: string }>(`/api/participants/${token}/debrief`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}

export async function adminLogin(password: string) {
  return apiFetch<{ accessToken: string }>("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function getAdminConfig(token: string) {
  return apiFetch<StudyConfig>("/api/admin/config", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateAdminConfig(token: string, payload: Partial<StudyConfig>) {
  return apiFetch("/api/admin/config", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function getLobby(token: string) {
  return apiFetch<{ participants: Array<{ participantId: string; token: string; joinedAt: string | null }> }>("/api/admin/lobby", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getSessions(token: string) {
  return apiFetch<{ sessions: Array<{ sessionId: string; dyadId: string; state: string; trialNumber: number; score: number; condition: string }> }>("/api/admin/sessions", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function pairParticipants(token: string, participantAToken: string, participantBToken: string, condition: "random" | "transparent" | "opaque") {
  return apiFetch("/api/admin/pair", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ participantAToken, participantBToken, condition }),
  });
}

export async function pauseSession(token: string, sessionId: string) {
  return apiFetch(`/api/admin/sessions/${sessionId}/pause`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function endSession(token: string, sessionId: string) {
  return apiFetch(`/api/admin/sessions/${sessionId}/end`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function downloadExport(token: string, format: "json" | "csv") {
  const response = await fetch(`${API_BASE}/api/admin/exports?format=${format}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `symbol-games-export.${format}`;
  link.click();
  URL.revokeObjectURL(url);
}

export function participantSocketUrl(token: string): string {
  const base = API_BASE || window.location.origin;
  const url = new URL(base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/ws/participant/${token}`;
  return url.toString();
}

export function sendSocket(socket: WebSocket | null, event: string, payload: Record<string, unknown>) {
  socket?.send(JSON.stringify({ event, payload }));
}
