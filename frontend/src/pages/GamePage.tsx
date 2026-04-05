import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { HistoryStrip } from "../components/HistoryStrip";
import { ReferentGrid } from "../components/ReferentGrid";
import { SignalWorkspace } from "../components/SignalWorkspace";
import { TopBar } from "../components/TopBar";
import { sendSocket } from "../lib/api";
import { applyActionToCanvasState, loadHistory, makeEmptyCanvasState, normalizeCanvasState, persistHistory } from "../lib/helpers";
import { useBootstrap } from "../hooks/useBootstrap";
import { useParticipantSocket } from "../hooks/useParticipantSocket";
import type { CanvasState, HistoryEntry, InterfaceType, SignalAction, SocketMessage, TrialPayload } from "../types/contracts";

export function GamePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data } = useBootstrap(token);

  // Interface type: URL param > studyConfig > "blocks"
  const interfaceType: InterfaceType = (searchParams.get("interface") as InterfaceType) || data?.studyConfig.interfaceType || "blocks";
  const seismographMode = (searchParams.get("seismo_mode") as "continuous" | "hold_to_draw") || data?.studyConfig.seismographMode || "hold_to_draw";
  const inertialAlpha = Number(searchParams.get("alpha")) || data?.studyConfig.inertialAlpha || 0.15;

  const [trial, setTrial] = useState<TrialPayload | null>(null);
  const [score, setScore] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>(() => (token ? loadHistory(token) : []));
  const [speakerCanvasState, setSpeakerCanvasState] = useState<CanvasState>(() => makeEmptyCanvasState(interfaceType));
  const [listenerCanvasState, setListenerCanvasState] = useState<CanvasState>(() => makeEmptyCanvasState(interfaceType));
  const [selectedGuess, setSelectedGuess] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; targetReferent: string; selectedReferent: string } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(45);
  const [speakerDone, setSpeakerDone] = useState(false);

  // Undo/redo stacks
  const undoStack = useRef<CanvasState[]>([]);
  const redoStack = useRef<CanvasState[]>([]);
  const [undoLen, setUndoLen] = useState(0);
  const [redoLen, setRedoLen] = useState(0);

  function pushUndo(snapshot: CanvasState) {
    undoStack.current.push(snapshot);
    redoStack.current = [];
    setUndoLen(undoStack.current.length);
    setRedoLen(0);
  }

  function handleUndo() {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    redoStack.current.push(speakerCanvasState);
    setSpeakerCanvasState(prev);
    setUndoLen(undoStack.current.length);
    setRedoLen(redoStack.current.length);
  }

  function handleRedo() {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current.pop()!;
    undoStack.current.push(speakerCanvasState);
    setSpeakerCanvasState(next);
    setUndoLen(undoStack.current.length);
    setRedoLen(redoStack.current.length);
  }

  function handleClear() {
    const empty = makeEmptyCanvasState(interfaceType);
    if (JSON.stringify(speakerCanvasState) === JSON.stringify(empty)) return;
    pushUndo(speakerCanvasState);
    setSpeakerCanvasState(empty);
    sendSocket(socketRef.current, "canvas_action", { action: "clear", timestampMs: Date.now() });
  }

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
    if (!trial) return;
    setSecondsLeft(trial.timerSeconds);
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [trial?.trialNumber]);

  useEffect(() => {
    if (secondsLeft === 0 && trial?.role === "speaker") {
      sendSocket(socketRef.current, "canvas_snapshot", { canvasState: speakerCanvasState, submittedAtMs: Date.now() });
    }
  }, [secondsLeft, trial]);

  const handleSocketMessage = useCallback(
    (message: SocketMessage) => {
      if (message.event === "phase_sync") {
        setTrial(message.payload.trial);
        setScore(message.payload.score);
        setHistory(message.payload.history.map((h) => ({ ...h, canvasState: normalizeCanvasState(h.canvasState) })));
        return;
      }
      if (message.event === "session_resumed") {
        setTrial(message.payload);
        return;
      }
      // Live streaming: receive speaker's actions in real-time
      if (message.event === "canvas_action_relay") {
        setListenerCanvasState((current) => applyActionToCanvasState(current, message.payload));
        return;
      }
      // Speaker finished composing
      if (message.event === "speaker_done") {
        setListenerCanvasState(normalizeCanvasState(message.payload.canvasState));
        setSpeakerDone(true);
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
        setSpeakerCanvasState(makeEmptyCanvasState(interfaceType));
        setListenerCanvasState(makeEmptyCanvasState(interfaceType));
        setSelectedGuess(null);
        setFeedback(null);
        setSpeakerDone(false);
        undoStack.current = [];
        redoStack.current = [];
        setUndoLen(0);
        setRedoLen(0);
        if ("history" in message.payload && token) {
          const hist = message.payload.history.map((h: HistoryEntry) => ({ ...h, canvasState: normalizeCanvasState(h.canvasState) }));
          persistHistory(token, hist);
          setHistory(hist);
        }
      }
    },
    [navigate, token, interfaceType],
  );

  const socketRef = useParticipantSocket(token, Boolean(data?.resumableSession), handleSocketMessage);

  function handleSignalAction(action: SignalAction) {
    if (!trial) return;
    // For blocks: push undo on place/remove
    if (interfaceType === "blocks" && (action.action === "place" || action.action === "remove")) {
      pushUndo(speakerCanvasState);
    }
    // For stroke-based: push undo on stroke_start
    if ((interfaceType === "inertial" || interfaceType === "etch_a_sketch") && action.action === "stroke_start") {
      pushUndo(speakerCanvasState);
    }
    setSpeakerCanvasState((current) => applyActionToCanvasState(current, action));
    sendSocket(socketRef.current, "canvas_action", action as unknown as Record<string, unknown>);
  }

  const manifest = data?.assets;
  const displayedCanvasState = trial?.role === "speaker" ? speakerCanvasState : listenerCanvasState;
  const roleLabel = trial?.role === "speaker" ? "Writer" : "Reader";
  const listenerCanGuess = trial?.role === "listener" && speakerDone;

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
                    <h2>{trial.role === "speaker" ? "Target set" : "Choice set"}</h2>
                    <p className="muted-copy">{trial.role === "speaker" ? "Reference the target and write below" : "Read the form and choose above"}</p>
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
                    disabled={!listenerCanGuess}
                    onSelect={(referentId) => {
                      if (!listenerCanGuess) return;
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
                    <h2>{trial.role === "speaker" ? "Target word" : "Received form"}</h2>
                    <p className="muted-copy">{trial.role === "speaker" ? "Build your word" : "Interpret your partner's form"}</p>
                  </div>
                  <div className="timer-badge">{secondsLeft}s</div>
                </div>
                <SignalWorkspace
                  interfaceType={interfaceType}
                  canvasState={displayedCanvasState}
                  onAction={trial.role === "speaker" ? handleSignalAction : undefined}
                  readOnly={trial.role !== "speaker"}
                  primitives={manifest.primitives}
                  maxPrimitives={data.studyConfig.maxPrimitivesPerForm}
                  seismographMode={seismographMode}
                  inertialAlpha={inertialAlpha}
                  onClear={handleClear}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  canUndo={undoLen > 0}
                  canRedo={redoLen > 0}
                />
                {trial.role === "speaker" ? (
                  <div className="canvas-actions">
                    <div />
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => sendSocket(socketRef.current, "canvas_snapshot", { canvasState: speakerCanvasState, submittedAtMs: Date.now() })}
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <div className="canvas-actions">
                    <div className="waiting-copy">
                      {speakerDone ? "Choose a referent above." : "Watching your partner compose..."}
                    </div>
                  </div>
                )}
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
