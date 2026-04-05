import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { SignalWorkspace } from "../components/SignalWorkspace";
import { ReferentGrid } from "../components/ReferentGrid";
import { completeLearning, recordExposure, recordQuiz } from "../lib/api";
import { applyActionToCanvasState, createPracticePrompt, makeEmptyCanvasState, phaseRoute, playAudio, shuffle } from "../lib/helpers";
import { useBootstrap } from "../hooks/useBootstrap";
import type { CanvasState, InterfaceType, SignalAction } from "../types/contracts";

type LearningStep = "exposure" | "quiz" | "practice";

export function LearningPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data, loading, error, refresh } = useBootstrap(token);
  const interfaceType: InterfaceType = (searchParams.get("interface") as InterfaceType) || data?.studyConfig.interfaceType || "blocks";
  const [step, setStep] = useState<LearningStep>("exposure");
  const [heardForms, setHeardForms] = useState<string[]>([]);
  const [quizPrompt, setQuizPrompt] = useState<{ referentId: string; options: string[]; taskType: "audio_to_referent" | "referent_to_word" } | null>(null);
  const [quizStatus, setQuizStatus] = useState<{ slidingAccuracy: number; passed: boolean }>({ slidingAccuracy: 0, passed: false });
  const [practiceTrial, setPracticeTrial] = useState(1);
  const [practiceCanvasState, setPracticeCanvasState] = useState<CanvasState>(() => makeEmptyCanvasState(interfaceType));

  useEffect(() => {
    if (!data || !token) {
      return;
    }
    if (data.participant.phase === "ready_for_lobby" || data.participant.phase === "waiting") {
      navigate(phaseRoute(token, data.participant.phase));
    }
    const initialHeard = ((data.participant.learningState.heardForms as string[] | undefined) ?? []).slice();
    setHeardForms(initialHeard);
  }, [data, navigate, token]);

  useEffect(() => {
    if (!data) {
      return;
    }
    if (step === "quiz" && !quizPrompt) {
      const referentIds = data.assets.referents.map((referent) => referent.id);
      const target = referentIds[Math.floor(Math.random() * referentIds.length)];
      setQuizPrompt({
        referentId: target,
        options: shuffle([target, ...referentIds.filter((candidate) => candidate !== target).slice(0, 3)]),
        taskType: Math.random() > 0.5 ? "audio_to_referent" : "referent_to_word",
      });
    }
  }, [data, quizPrompt, step]);

  const manifest = data?.assets;
  const learningCondition = data?.participant.assignedCondition ?? "transparent";
  const allHeard = manifest ? heardForms.length >= manifest.referents.length : false;
  const practicePrompt = useMemo(() => (manifest ? createPracticePrompt(manifest.primitives) : null), [manifest]);

  function handlePracticeAction(action: SignalAction) {
    setPracticeCanvasState((current) => applyActionToCanvasState(current, action));
  }

  async function handleExposurePlay(referentId: string, audioUrl: string) {
    playAudio(audioUrl);
    if (!token || heardForms.includes(referentId)) {
      return;
    }
    await recordExposure(token, referentId);
    setHeardForms((current) => [...current, referentId]);
  }

  async function handleQuizAnswer(selectedReferentId: string) {
    if (!token || !quizPrompt || !manifest) {
      return;
    }
    const correct = selectedReferentId === quizPrompt.referentId;
    const outcome = await recordQuiz(token, {
      taskType: quizPrompt.taskType,
      referentId: quizPrompt.referentId,
      selectedReferentId,
      isCorrect: correct,
    });
    setQuizStatus(outcome);
    if (outcome.passed) {
      setStep("practice");
      setQuizPrompt(null);
      return;
    }
    const referentIds = manifest.referents.map((referent) => referent.id);
    const nextTarget = referentIds[Math.floor(Math.random() * referentIds.length)];
    setQuizPrompt({
      referentId: nextTarget,
      options: shuffle([nextTarget, ...referentIds.filter((candidate) => candidate !== nextTarget).slice(0, 3)]),
      taskType: Math.random() > 0.5 ? "audio_to_referent" : "referent_to_word",
    });
  }

  async function handlePracticeSubmit() {
    if (!token) {
      return;
    }
    if (practiceTrial === 2) {
      await completeLearning(token, 2);
      await refresh();
      navigate(`/session/${token}/lobby`);
      return;
    }
    setPracticeTrial(2);
    setPracticeCanvasState(makeEmptyCanvasState(interfaceType));
  }

  async function handleSkipLearning() {
    if (!token) {
      return;
    }
    await completeLearning(token, 0);
    await refresh();
    navigate(`/session/${token}/lobby`);
  }

  return (
    <AppShell>
      <section className="panel stack">
        <div className="split-header">
          <div>
            <p className="eyebrow">Learning Phase</p>
            <h1>Learn the objects and their words</h1>
          </div>
          <div className="step-tabs">
            <button type="button" className={step === "exposure" ? "tab active" : "tab"} onClick={() => setStep("exposure")}>
              Exposure
            </button>
            <button type="button" className={step === "quiz" ? "tab active" : "tab"} disabled={!allHeard} onClick={() => setStep("quiz")}>
              Quiz
            </button>
            <button type="button" className={step === "practice" ? "tab active" : "tab"} disabled={!quizStatus.passed} onClick={() => setStep("practice")}>
              Practice
            </button>
          </div>
        </div>
        <div className="button-row">
          <p className="muted-copy">For pilot testing, you can bypass training and jump straight into the multiplayer lobby.</p>
          <button type="button" className="secondary-button" onClick={() => void handleSkipLearning()}>
            Skip Learning and Enter Lobby
          </button>
        </div>
        {loading ? <p>Loading learning materials...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        {manifest && step === "exposure" ? (
          <>
            <p className="muted-copy">Click each referent to hear its word. You need to hear all 30 forms before the quiz unlocks.</p>
            <div className="status-chip">{heardForms.length} / {manifest.referents.length} heard</div>
            <ReferentGrid
              manifest={manifest}
              referentIds={manifest.referents.map((referent) => referent.id)}
              condition={learningCondition}
              showAudioButtons
              onSelect={(referentId) => {
                const referent = manifest.referents.find((item) => item.id === referentId);
                if (referent) {
                  void handleExposurePlay(referentId, referent.audio[learningCondition]);
                }
              }}
            />
            <button type="button" className="primary-button" disabled={!allHeard} onClick={() => setStep("quiz")}>
              Start Quiz
            </button>
          </>
        ) : null}
        {manifest && step === "quiz" && quizPrompt ? (
          <>
            <p className="muted-copy">
              Accuracy over the last 10 responses: {(quizStatus.slidingAccuracy * 100).toFixed(0)}%. Reach {Math.round(data!.studyConfig.learningCriterion * 100)}% to continue.
            </p>
            <div className="quiz-card">
              <div className="quiz-prompt">
                <h2>{quizPrompt.taskType === "audio_to_referent" ? "Hear a word and pick the matching referent" : "Pick the referent that matches the played word"}</h2>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    const referent = manifest.referents.find((item) => item.id === quizPrompt.referentId);
                    if (referent) {
                      playAudio(referent.audio[learningCondition]);
                    }
                  }}
                >
                  Play Word
                </button>
              </div>
              <ReferentGrid manifest={manifest} referentIds={quizPrompt.options} condition={learningCondition} onSelect={(id) => void handleQuizAnswer(id)} />
            </div>
          </>
        ) : null}
        {manifest && step === "practice" && practicePrompt ? (
          <>
            <div className="practice-card">
              <div>
                <p className="eyebrow">Practice Trial {practiceTrial} / 2</p>
                <h2>Try the writing workspace</h2>
                <ul className="compact-list">
                  {practicePrompt.target.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </div>
              <SignalWorkspace
                interfaceType={interfaceType}
                canvasState={practiceCanvasState}
                onAction={handlePracticeAction}
                readOnly={false}
                primitives={manifest.primitives}
                maxPrimitives={data!.studyConfig.maxPrimitivesPerForm}
                onClear={() => setPracticeCanvasState(makeEmptyCanvasState(interfaceType))}
              />
              <button type="button" className="primary-button" onClick={() => void handlePracticeSubmit()}>
                {practiceTrial === 2 ? "Finish Learning" : "Submit Practice Form"}
              </button>
            </div>
          </>
        ) : null}
      </section>
    </AppShell>
  );
}
