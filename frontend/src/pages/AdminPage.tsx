import { useEffect, useState } from "react";

import { AppShell } from "../components/AppShell";
import { adminLogin, downloadExport, endSession, getAdminConfig, getLobby, getSessions, pairParticipants, pauseSession, updateAdminConfig } from "../lib/api";
import type { StudyConfig } from "../types/contracts";

export function AdminPage() {
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(localStorage.getItem("symbol-games:admin-token") ?? "");
  const [config, setConfig] = useState<StudyConfig | null>(null);
  const [lobby, setLobby] = useState<Array<{ participantId: string; token: string; joinedAt: string | null }>>([]);
  const [sessions, setSessions] = useState<Array<{ sessionId: string; dyadId: string; state: string; trialNumber: number; score: number; condition: string }>>([]);

  useEffect(() => {
    if (!token) {
      return;
    }
    void Promise.all([getAdminConfig(token), getLobby(token), getSessions(token)]).then(([adminConfig, lobbyData, sessionData]) => {
      setConfig(adminConfig);
      setLobby(lobbyData.participants);
      setSessions(sessionData.sessions);
    });
  }, [token]);

  async function handleLogin() {
    const response = await adminLogin(password);
    localStorage.setItem("symbol-games:admin-token", response.accessToken);
    setToken(response.accessToken);
  }

  return (
    <AppShell>
      <section className="panel stack">
        <p className="eyebrow">Researcher Dashboard</p>
        <h1>Admin Controls</h1>
        {!token ? (
          <div className="stack narrow-stack">
            <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Admin password" type="password" />
            <button type="button" className="primary-button" onClick={() => void handleLogin()}>
              Sign In
            </button>
          </div>
        ) : null}
        {token && config ? (
          <>
            <div className="admin-grid">
              <section className="sub-panel stack">
                <h2>Study Config</h2>
                <label className="stack">
                  <span>Pairing mode</span>
                  <select
                    value={config.pairingMode}
                    onChange={(event) => setConfig((current) => (current ? { ...current, pairingMode: event.target.value as StudyConfig["pairingMode"] } : current))}
                  >
                    <option value="auto">Auto</option>
                    <option value="manual">Manual</option>
                  </select>
                </label>
                <label className="stack">
                  <span>Speaker time limit</span>
                  <input
                    type="number"
                    value={config.speakerTimeLimitS}
                    onChange={(event) => setConfig((current) => (current ? { ...current, speakerTimeLimitS: Number(event.target.value) } : current))}
                  />
                </label>
                <button type="button" className="secondary-button" onClick={() => config && void updateAdminConfig(token, config)}>
                  Save Config
                </button>
              </section>
              <section className="sub-panel stack">
                <h2>Lobby</h2>
                {lobby.map((participant) => (
                  <div key={participant.token} className="list-row">
                    <span>{participant.participantId}</span>
                    <code>{participant.token.slice(0, 8)}</code>
                  </div>
                ))}
                {config.pairingMode === "manual" && lobby.length >= 2 ? (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void pairParticipants(token, lobby[0].token, lobby[1].token, "random")}
                  >
                    Pair First Two Waiting
                  </button>
                ) : null}
              </section>
              <section className="sub-panel stack">
                <h2>Active Sessions</h2>
                {sessions.map((session) => (
                  <div key={session.sessionId} className="session-card">
                    <strong>{session.dyadId}</strong>
                    <span>{session.condition}</span>
                    <span>{session.state}</span>
                    <span>Trial {session.trialNumber}</span>
                    <div className="button-row">
                      <button type="button" className="secondary-button" onClick={() => void pauseSession(token, session.sessionId)}>
                        Pause
                      </button>
                      <button type="button" className="secondary-button danger-button" onClick={() => void endSession(token, session.sessionId)}>
                        End
                      </button>
                    </div>
                  </div>
                ))}
                <div className="button-row">
                  <button type="button" className="secondary-button" onClick={() => void downloadExport(token, "json")}>
                    Download JSON
                  </button>
                  <button type="button" className="secondary-button" onClick={() => void downloadExport(token, "csv")}>
                    Download CSV
                  </button>
                </div>
              </section>
            </div>
          </>
        ) : null}
      </section>
    </AppShell>
  );
}
