import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { CompositionWorkspace } from "../components/CompositionWorkspace";
import { HistoryStrip } from "../components/HistoryStrip";
import { ReferentGrid } from "../components/ReferentGrid";
import { TopBar } from "../components/TopBar";
import { sendSocket } from "../lib/api";
import { loadHistory, persistHistory, playAudio } from "../lib/helpers";
import { useBootstrap } from "../hooks/useBootstrap";
import { useParticipantSocket } from "../hooks/useParticipantSocket";
import type { CanvasAction, CanvasPrimitive, HistoryEntry, SocketMessage, TrialPayload } from "../types/contracts";

export function GamePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { data } = useBootstrap(token);
  const [trial, setTrial] = useState<TrialPayload | null>(null);
  const [score, setScore] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>(() => (token ? loadHistory(token) : []));
  const [speakerCanvas, setSpeakerCanvas] = useState<CanvasPrimitive[]>([]);
  const [listenerCanvas, setListenerCanvas] = useState<CanvasPrimitive[]>([]);
  const [selectedGuess, setSelectedGuess] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; targetReferent: string; selectedReferent: string } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(45);

  useEffect(() => {
    if (data?.participant.phase === "debrief" && token) {
      navigate(`/session/${token}/debrief`);
    }
  }, [data, navigate, token]);

  useEffect(() => {
    if (token) {
      persistHistory(token, history);
    }
  }, [history, token]);

  useEffect(() => {
    if (!trial) {
      return;
    }
    setSecondsLeft(trial.timerSeconds);
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [trial?.trialNumber]);

  useEffect(() => {
    if (secondsLeft === 0 && trial?.role === "speaker") {
      sendSocket(socketRef.current, "canvas_snapshot", { submittedAtMs: Date.now() });
    }
  }, [secondsLeft, trial]);

  const handleSocketMessage = useCallback(
    (message: SocketMessage) => {
      if (message.event === "phase_sync") {
        setTrial(message.payload.trial);
        setScore(message.payload.score);
        setHistory(message.payload.history);
        return;
      }
      if (message.event === "session_resumed") {
        setTrial(message.payload);
        return;
      }
      if (message.event === "speaker_ready") {
        setListenerCanvas(message.payload.canvasState.primitives);
        return;
      }
      if (message.event === "feedback") {
        setFeedback(message.payload);
        setScore(message.payload.score);
        return;
      }
      if (message.event === "role_swap") {
        if ("completed" in message.payload) {
          if (message.payload.completed && token) {
            navigate(`/session/${token}/debrief`);
          }
          return;
        }
        setTrial(message.payload);
        setSpeakerCanvas([]);
        setListenerCanvas([]);
        setSelectedGuess(null);
        setFeedback(null);
        if ("history" in message.payload && token) {
          persistHistory(token, message.payload.history);
          setHistory(message.payload.history);
        }
      }
    },
    [navigate, token],
  );

  const socketRef = useParticipantSocket(token, Boolean(data?.resumableSession), handleSocketMessage);

  function handleCanvasAction(action: CanvasAction) {
    if (!trial) {
      return;
    }
    if (action.action === "place") {
      setSpeakerCanvas((current) => [
        ...current,
        {
          instanceId: action.primitiveInstanceId,
          primitiveId: action.primitiveId,
          x: action.x,
          y: action.y,
          placementOrder: current.length + 1,
          createdAtMs: action.timestampMs,
          updatedAtMs: action.timestampMs,
        },
      ]);
    }
    if (action.action === "move") {
      setSpeakerCanvas((current) =>
        current.map((primitive) =>
          primitive.instanceId === action.primitiveInstanceId
            ? { ...primitive, x: action.x, y: action.y, updatedAtMs: action.timestampMs }
            : primitive,
        ),
      );
    }
    if (action.action === "remove") {
      setSpeakerCanvas((current) => current.filter((primitive) => primitive.instanceId !== action.primitiveInstanceId));
    }
    sendSocket(socketRef.current, "canvas_action", action as unknown as Record<string, unknown>);
  }

  const manifest = data?.assets;
  const displayedCanvas = trial?.role === "speaker" ? speakerCanvas : listenerCanvas;
  const roleLabel = trial?.role === "speaker" ? "Writer" : "Reader";

  return (
    <AppShell>
      <section className="panel stack game-panel">
        <TopBar score={score} trialLabel={trial ? `${trial.trialNumber} / ${data?.studyConfig.totalTrials ?? 60}` : undefined} roleLabel={roleLabel} />
        {trial && manifest ? (
          <div className="game-layout">
            <div className="game-main-column">
              <div className="grid-column">
                <div className="compact-section-header">
                  <div>
                    <p className="eyebrow">{trial.role === "speaker" ? "Target Set" : "Choice Set"}</p>
                    <h2>{trial.role === "speaker" ? "Reference the target and write below" : "Read the form and choose above"}</h2>
                  </div>
                  {feedback ? (
                    <div className={`feedback-banner ${feedback.correct ? "correct" : "incorrect"}`}>
                      {feedback.correct ? "Correct." : "Incorrect."} Target: {feedback.targetReferent}
                    </div>
                  ) : null}
                </div>
                <div className="game-referent-grid">
                  <ReferentGrid
                    manifest={manifest}
                    referentIds={trial.choiceSet}
                    condition={trial.condition}
                    selectedId={selectedGuess}
                    targetId={trial.role === "speaker" ? trial.targetReferent : undefined}
                    disabled={trial.role !== "listener" || !listenerCanvas.length}
                    onSelect={(referentId) => {
                      if (trial.role !== "listener") {
                        return;
                      }
                      setSelectedGuess(referentId);
                      sendSocket(socketRef.current, "listener_guess", {
                        selectedReferent: referentId,
                        responseTimeMs: Math.max(0, (trial.timerSeconds - secondsLeft) * 1000),
                      });
                    }}
                  />
                </div>
              </div>
              <div className="panel subtle-panel compact-game-panel">
                <div className="canvas-header">
                  <div>
                    <p className="eyebrow">{trial.role === "speaker" ? "Target Word" : "Received Form"}</p>
                    <h2>{trial.role === "speaker" ? "Build the symbol composition" : "Interpret your partner's form"}</h2>
                  </div>
                  <div className="timer-badge">{secondsLeft}s</div>
                </div>
                <CompositionWorkspace
                  primitives={manifest.primitives}
                  placedPrimitives={displayedCanvas}
                  onAction={trial.role === "speaker" ? handleCanvasAction : undefined}
                  readOnly={trial.role !== "speaker"}
                  maxPrimitives={data.studyConfig.maxPrimitivesPerForm}
                />
                <div className="canvas-actions">
                  {trial.role === "speaker" && trial.targetAudioUrl ? (
                    <button type="button" className="secondary-button" onClick={() => playAudio(trial.targetAudioUrl!)}>
                      Replay Word
                    </button>
                  ) : null}
                  {trial.role === "speaker" ? (
                    <button type="button" className="primary-button" onClick={() => sendSocket(socketRef.current, "canvas_snapshot", { submittedAtMs: Date.now() })}>
                      Transmit
                    </button>
                  ) : (
                    <div className="waiting-copy">{listenerCanvas.length ? "Choose a referent above." : "Waiting for your partner..."}</div>
                  )}
                </div>
              </div>
            </div>
            <div className="game-side-column">
              <HistoryStrip history={history.slice(-3)} primitives={manifest.primitives} />
            </div>
          </div>
        ) : (
          <p>Loading game session...</p>
        )}
      </section>
    </AppShell>
  );
}
