import { useCallback, useEffect, useState } from "react";

import { bootstrapParticipant } from "../lib/api";
import type { ParticipantBootstrap } from "../types/contracts";

export function useBootstrap(token: string | undefined) {
  const [data, setData] = useState<ParticipantBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const bootstrap = await bootstrapParticipant(token);
      setData(bootstrap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh, setData };
}
