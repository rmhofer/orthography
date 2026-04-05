import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { completeLearning, recordAudioCheck, recordConsent } from "../lib/api";
import { phaseRoute, playAudio } from "../lib/helpers";
import { useBootstrap } from "../hooks/useBootstrap";

export function LandingPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const { data, loading, error, refresh } = useBootstrap(token);
  const [consented, setConsented] = useState(false);
  const [audioChecked, setAudioChecked] = useState(false);
  const sampleAudio = useMemo(() => data?.assets.referents[0]?.audio.transparent, [data]);

  useEffect(() => {
    if (!data || !token) {
      return;
    }
    if (data.participant.phase !== "landing" && data.participant.phase !== "consent_complete") {
      navigate(phaseRoute(token, data.participant.phase) + qs);
    } else {
      setConsented(Boolean(data.participant.consented));
      setAudioChecked(Boolean(data.participant.audioChecked));
    }
  }, [data, navigate, token, qs]);

  async function handleContinue() {
    if (!token) return;
    await recordConsent(token, consented);
    await recordAudioCheck(token, audioChecked);
    await refresh();
    navigate(`/session/${token}/learning${qs}`);
  }

  async function handleSkipLearning() {
    if (!token) return;
    await recordConsent(token, true);
    await recordAudioCheck(token, true);
    await completeLearning(token, 0);
    await refresh();
    navigate(`/session/${token}/lobby${qs}`);
  }

  return (
    <AppShell>
      <section className="panel stack">
        <div className="debug-skip-row">
          <button type="button" className="debug-skip-button" onClick={() => void handleSkipLearning()}>
            DEBUG: skip
          </button>
        </div>
        <p className="eyebrow">Setup</p>
        <h2>Consent and Audio Check</h2>
        <p>Before you begin, confirm consent and make sure you can hear the language stimuli clearly.</p>
        {loading ? <p>Loading session...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        <label className="checkbox-row">
          <input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} />
          <span>I consent to participate in this study.</span>
        </label>
        <div className="audio-check-card">
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              if (sampleAudio) {
                playAudio(sampleAudio);
              }
            }}
          >
            Play sample audio
          </button>
          <label className="checkbox-row">
            <input type="checkbox" checked={audioChecked} onChange={(event) => setAudioChecked(event.target.checked)} />
            <span>I can hear the audio clearly.</span>
          </label>
        </div>
        <div className="centered">
          <button type="button" className="primary-button" disabled={!consented || !audioChecked} onClick={() => void handleContinue()}>
            Continue
          </button>
        </div>
      </section>
    </AppShell>
  );
}
