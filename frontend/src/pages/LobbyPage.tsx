import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { joinLobby } from "../lib/api";
import { phaseRoute } from "../lib/helpers";
import { useBootstrap } from "../hooks/useBootstrap";

export function LobbyPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const { data, refresh } = useBootstrap(token);
  const [joined, setJoined] = useState(false);
  const [secondsWaiting, setSecondsWaiting] = useState(0);

  useEffect(() => {
    if (!token || joined) {
      return;
    }
    setJoined(true);
    void joinLobby(token);
  }, [joined, token]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsWaiting((current) => current + 1);
      void refresh();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!data || !token) {
      return;
    }
    if (data.participant.phase === "game" || data.resumableSession) {
      navigate(`/session/${token}/game${qs}`);
    }
  }, [data, navigate, token, qs]);

  return (
    <AppShell>
      <section className="panel stack centered">
        <p className="eyebrow">Lobby</p>
        <h1>Waiting for a partner</h1>
        <p>
          The study pairs participants after learning completes. If no partner arrives within 3 minutes, you can stop and receive partial
          compensation.
        </p>
        <div className="timer-circle">{secondsWaiting}s</div>
        <p className="muted-copy">The page checks for matches automatically.</p>
      </section>
    </AppShell>
  );
}
