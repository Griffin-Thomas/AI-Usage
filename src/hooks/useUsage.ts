import { useCallback, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { useUsageStore } from "@/lib/store";
import { fetchUsage, hasCredentials, forceRefresh as forceRefreshCommand } from "@/lib/tauri";
import { updateTray, resetTray } from "@/lib/tray";
import type { ProviderId, UsageData } from "@/lib/types";

// Event payload from scheduler
interface UsageUpdateEvent {
  provider: string;
  data: UsageData | null;
  error: string | null;
}

export function useUsage(provider: ProviderId) {
  const { usage, setUsage, setLoading, setError, setLastRefresh } = useUsageStore();
  const hasFetched = useRef(false);

  // Manual refresh (for initial load and manual refresh button)
  const refresh = useCallback(async () => {
    setLoading(provider, true);
    setError(provider, null);

    try {
      // Check if credentials exist first
      const hasCreds = await hasCredentials(provider);
      if (!hasCreds) {
        setError(provider, "No credentials configured. Please set up your credentials in Settings.");
        setLoading(provider, false);
        await resetTray();
        return;
      }

      const data = await fetchUsage(provider);
      setUsage(provider, data);
      setLastRefresh(provider, new Date());

      // Update system tray with new usage data
      await updateTray(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(provider, message);
    } finally {
      setLoading(provider, false);
    }
  }, [provider, setUsage, setLoading, setError, setLastRefresh]);

  // Force refresh via scheduler (respects rate limiting)
  const forceRefresh = useCallback(async () => {
    try {
      await forceRefreshCommand();
    } catch (err) {
      // If rate limited, fall back to manual refresh
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Rate limited")) {
        console.log("Rate limited by scheduler, using cached data");
      } else {
        console.error("Force refresh failed:", err);
      }
    }
  }, []);

  // Listen for scheduler usage updates
  useEffect(() => {
    const unlisten = listen<UsageUpdateEvent>("usage-update", async (event) => {
      const { provider: eventProvider, data, error } = event.payload;

      if (eventProvider !== provider) return;

      if (error) {
        setError(provider, error);
        setLoading(provider, false);
        return;
      }

      if (data) {
        setUsage(provider, data);
        setLastRefresh(provider, new Date());
        setError(provider, null);

        // Update system tray with new usage data
        await updateTray(data);
      }

      setLoading(provider, false);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [provider, setUsage, setError, setLoading, setLastRefresh]);

  // Listen for tray refresh events (manual refresh from tray menu)
  useEffect(() => {
    const unlisten = listen("tray-refresh", () => {
      forceRefresh();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [forceRefresh]);

  // Initial fetch on mount (scheduler may not have fetched yet)
  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      refresh();
    }
  }, [refresh]);

  // Refetch when usage is cleared (credentials updated)
  const currentUsage = usage[provider];
  useEffect(() => {
    if (currentUsage === null && hasFetched.current) {
      refresh();
    }
  }, [currentUsage, refresh]);

  return { refresh, forceRefresh };
}
