import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { HistoryStrip } from "../components/HistoryStrip";
import { ReferentGrid } from "../components/ReferentGrid";
import { submitDebrief } from "../lib/api";
import { buildNovelPrompts, buildRecognitionOptions, loadHistory } from "../lib/helpers";
import { useBootstrap } from "../hooks/useBootstrap";

export function DebriefPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { data } = useBootstrap(token);
  const [submitting, setSubmitting] = useState(false);
  const [strategy, setStrategy] = useState("");
  const [systemDescription, setSystemDescription] = useState("");
  const [patterns, setPatterns] = useState("");
  const [rootsAware, setRootsAware] = useState("yes");
  const [sharedSystem, setSharedSystem] = useState(4);
  const [recognitionAnswers, setRecognitionAnswers] = useState<Record<string, string>>({});
  const [novelAnswers, setNovelAnswers] = useState<Record<string, string>>({});

  const history = token ? loadHistory(token) : [];
  const probes = useMemo(() => history.slice(0, 4).map((entry) => ({ ...entry, options: data ? buildRecognitionOptions(data.assets.referents, entry.targetReferent) : [] })), [data, history]);
  const novelPrompts = useMemo(() => (data ? buildNovelPrompts(data.assets.referents) : []), [data]);

  async function handleSubmit(formData: FormData) {
    if (!token) {
      return;
    }
    setSubmitting(true);
    const answers = Object.fromEntries(formData.entries());
    const payload = {
      ...answers,
      strategy,
      systemDescription,
      patterns,
      rootsAware,
      sharedSystem,
      recognitionAnswers,
      novelAnswers,
    };
    const response = await submitDebrief(token, payload);
    navigate(`/session/${token}/completion`, { state: { completionCode: response.completionCode } });
  }

  return (
    <AppShell>
      <section className="panel stack">
        <p className="eyebrow">Debrief</p>
        <h1>Describe the system you built</h1>
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit(new FormData(event.currentTarget));
          }}
        >
          <label className="stack">
            <span>How did you decide which symbols to use?</span>
            <textarea value={strategy} onChange={(event) => setStrategy(event.target.value)} name="strategy" rows={4} />
          </label>
          <label className="stack">
            <span>Did you develop a system? If so, describe it.</span>
            <textarea value={systemDescription} onChange={(event) => setSystemDescription(event.target.value)} name="systemDescription" rows={4} />
          </label>
          <label className="stack">
            <span>Did you notice patterns in how the words were formed?</span>
            <textarea value={patterns} onChange={(event) => setPatterns(event.target.value)} name="patterns" rows={4} />
          </label>
          <label className="stack">
            <span>Were you aware of roots and endings while playing?</span>
            <select value={rootsAware} onChange={(event) => setRootsAware(event.target.value)} name="rootsAware">
              <option value="yes">Yes</option>
              <option value="partly">Partly</option>
              <option value="no">No</option>
            </select>
          </label>
          <label className="stack">
            <span>Did you and your partner converge on a shared system? ({sharedSystem}/7)</span>
            <input type="range" min="1" max="7" value={sharedSystem} onChange={(event) => setSharedSystem(Number(event.target.value))} />
          </label>
          {data ? <HistoryStrip history={history.slice(0, 4)} primitives={data.assets.primitives} /> : null}
          {data ? (
            <div className="stack">
              <h2>Recognition Probes</h2>
              {probes.map((probe) => (
                <fieldset key={probe.trialNumber} className="probe-card">
                  <legend>What does this form say? Trial {probe.trialNumber}</legend>
                  <HistoryStrip history={[probe]} primitives={data.assets.primitives} />
                  <ReferentGrid
                    manifest={data.assets}
                    referentIds={probe.options}
                    condition={data.resumableSession?.condition ?? "transparent"}
                    selectedId={recognitionAnswers[String(probe.trialNumber)]}
                    onSelect={(referentId) =>
                      setRecognitionAnswers((current) => ({
                        ...current,
                        [String(probe.trialNumber)]: referentId,
                      }))
                    }
                  />
                </fieldset>
              ))}
              <h2>Novel Combination Probes</h2>
              {novelPrompts.map((prompt) => (
                <fieldset key={prompt.promptId} className="probe-card">
                  <legend>If this were a new word, which referent would it most likely mean?</legend>
                  <ReferentGrid
                    manifest={data.assets}
                    referentIds={prompt.options}
                    condition={data.resumableSession?.condition ?? "transparent"}
                    selectedId={novelAnswers[prompt.promptId]}
                    onSelect={(referentId) =>
                      setNovelAnswers((current) => ({
                        ...current,
                        [prompt.promptId]: referentId,
                      }))
                    }
                  />
                </fieldset>
              ))}
            </div>
          ) : null}
          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Debrief"}
          </button>
        </form>
      </section>
    </AppShell>
  );
}
