import { useEffect, useRef } from "react";

import { participantSocketUrl } from "../lib/api";
import type { SocketMessage } from "../types/contracts";

export function useParticipantSocket(token: string | undefined, enabled: boolean, onMessage: (message: SocketMessage) => void) {
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token || !enabled) {
      return;
    }

    const socket = new WebSocket(participantSocketUrl(token));
    socketRef.current = socket;

    socket.addEventListener("message", (event) => {
      const parsed = JSON.parse(event.data) as SocketMessage;
      onMessage(parsed);
    });

    const heartbeat = window.setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ event: "heartbeat", payload: {} }));
      }
    }, 5000);

    return () => {
      window.clearInterval(heartbeat);
      socket.close();
    };
  }, [enabled, onMessage, token]);

  return socketRef;
}
