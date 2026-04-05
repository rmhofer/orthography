from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class StudyConfig(BaseModel):
    condition: Literal["random", "transparent", "opaque"] = "random"
    viewMode: Literal["transmit"] = "transmit"
    totalTrials: int = 60
    roleSwapEvery: int = 1
    maxPrimitivesPerForm: int = 10
    learningCriterion: float = 0.8
    choiceSetSize: int = 6
    pairingMode: Literal["auto", "manual"] = "auto"
    interTrialIntervalMs: int = 1500
    speakerTimeLimitS: int = 45
    pointsPerCorrect: int = 10
    showWordAudioToSpeaker: bool = True
    historyPreviewSize: int = 3


class ParticipantStartRequest(BaseModel):
    token: str | None = None
    recruitmentData: dict[str, Any] = Field(default_factory=dict)


class ParticipantStartResponse(BaseModel):
    token: str
    participantId: str
    phase: str


class ConsentRequest(BaseModel):
    consented: bool


class AudioCheckRequest(BaseModel):
    passed: bool


class ExposureEventRequest(BaseModel):
    referentId: str


class QuizSubmissionRequest(BaseModel):
    taskType: Literal["audio_to_referent", "referent_to_word"]
    referentId: str
    selectedReferentId: str | None = None
    isCorrect: bool


class LearningCompleteRequest(BaseModel):
    practiceTrialsCompleted: int = 2


class LobbyJoinRequest(BaseModel):
    ready: bool = True


class DebriefSubmissionRequest(BaseModel):
    answers: dict[str, Any]


class CanvasPrimitive(BaseModel):
    instanceId: str
    primitiveId: str
    x: float
    y: float
    placementOrder: int
    createdAtMs: int
    updatedAtMs: int


class CanvasAction(BaseModel):
    action: Literal["place", "move", "remove", "clear", "submit"]
    primitiveInstanceId: str | None = None
    primitiveId: str | None = None
    x: float | None = None
    y: float | None = None
    timestampMs: int


class TrialPayload(BaseModel):
    trialNumber: int
    trialType: str
    role: Literal["speaker", "listener"]
    choiceSet: list[str]
    targetReferent: str
    targetAudioUrl: str | None = None
    timerSeconds: int
    score: int
    history: list[dict[str, Any]] = Field(default_factory=list)
    condition: Literal["transparent", "opaque"]
    speakerToken: str
    listenerToken: str


class TrialResult(BaseModel):
    trialNumber: int
    trialType: str
    targetReferent: str
    targetWord: str
    speakerId: str
    listenerId: str
    choiceSet: list[str]
    canvasState: dict[str, Any]
    canvasActionLog: list[dict[str, Any]]
    speakerCompositionTimeMs: int
    listenerResponse: str
    correct: bool
    listenerResponseTimeMs: int
    cumulativeScore: int


class BootstrapResponse(BaseModel):
    participant: dict[str, Any]
    studyConfig: StudyConfig
    assets: dict[str, Any]
    resumableSession: dict[str, Any] | None = None


class AdminLoginRequest(BaseModel):
    password: str


class AdminLoginResponse(BaseModel):
    accessToken: str


class AdminPairRequest(BaseModel):
    participantAToken: str
    participantBToken: str
    condition: Literal["transparent", "opaque", "random"] = "random"


class AdminConfigUpdateRequest(BaseModel):
    pairingMode: Literal["auto", "manual"] | None = None
    totalTrials: int | None = None
    roleSwapEvery: int | None = None
    maxPrimitivesPerForm: int | None = None
    learningCriterion: float | None = None
    choiceSetSize: int | None = None
    interTrialIntervalMs: int | None = None
    speakerTimeLimitS: int | None = None
    pointsPerCorrect: int | None = None


class WebSocketEnvelope(BaseModel):
    event: Literal[
        "phase_sync",
        "canvas_action",
        "canvas_snapshot",
        "speaker_ready",
        "listener_guess",
        "feedback",
        "role_swap",
        "session_paused",
        "session_resumed",
        "partner_disconnected",
        "heartbeat",
    ]
    payload: dict[str, Any]
