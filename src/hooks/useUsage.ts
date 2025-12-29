import { useCallback, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { useUsageStore, useAccountsStore, useSettingsStore } from "@/lib/store";
import {
  listAccounts,
  fetchUsageForAccount,
  forceRefresh as forceRefreshCommand,
} from "@/lib/tauri";
import { updateTray, resetTray } from "@/lib/tray";
import type { UsageData } from "@/lib/types";

// Event payload from scheduler (now includes account_id)
interface UsageUpdateEvent {
  provider: string;
  account_id: string;
  data: UsageData | null;
  error: string | null;
}

/**
 * Hook for managing usage data for all accounts.
 * Loads accounts, listens for scheduler updates, and manages store state.
 */
export function useUsage() {
  const {
    usage,
    setUsage,
    setLoading,
    setError,
    setLastRefresh,
    getAllUsage,
  } = useUsageStore();
  const { accounts, setAccounts } = useAccountsStore();
  const { settings } = useSettingsStore();
  const hasFetched = useRef(false);

  // Load all accounts from backend
  const loadAccounts = useCallback(async () => {
    try {
      const claudeAccounts = await listAccounts("claude");
      setAccounts(claudeAccounts);
      return claudeAccounts;
    } catch (err) {
      console.error("Failed to load accounts:", err);
      return [];
    }
  }, [setAccounts]);

  // Refresh usage for a specific account
  const refreshAccount = useCallback(
    async (accountId: string) => {
      setLoading(accountId, true);
      setError(accountId, null);

      try {
        const data = await fetchUsageForAccount(accountId);
        setUsage(accountId, data);
        setLastRefresh(accountId, new Date());
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(accountId, message);
        return null;
      } finally {
        setLoading(accountId, false);
      }
    },
    [setUsage, setLoading, setError, setLastRefresh]
  );

  // Refresh all accounts
  const refreshAll = useCallback(async () => {
    const accountList = accounts.length > 0 ? accounts : await loadAccounts();

    if (accountList.length === 0) {
      await resetTray();
      return;
    }

    // Fetch usage for all accounts
    const results: UsageData[] = [];
    for (const account of accountList) {
      const data = await refreshAccount(account.id);
      if (data) {
        results.push(data);
      }
    }

    // Update tray with worst-case usage across all accounts
    if (results.length > 0) {
      const worstCase = findWorstCaseUsage(results);
      if (worstCase) {
        await updateTray(worstCase, settings?.trayDisplayLimit ?? "highest");
      }
    }
  }, [accounts, loadAccounts, refreshAccount, settings?.trayDisplayLimit]);

  // Force refresh via scheduler (respects rate limiting)
  const forceRefresh = useCallback(async () => {
    try {
      await forceRefreshCommand();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Rate limited")) {
        console.log("Rate limited by scheduler, using cached data");
      } else {
        console.error("Force refresh failed:", err);
      }
    }
  }, []);

  // Listen for scheduler usage updates (per-account)
  useEffect(() => {
    const unlisten = listen<UsageUpdateEvent>("usage-update", async (event) => {
      const { account_id, data, error } = event.payload;

      if (error) {
        setError(account_id, error);
        setLoading(account_id, false);
        return;
      }

      if (data) {
        setUsage(account_id, data);
        setLastRefresh(account_id, new Date());
        setError(account_id, null);

        // Update tray with worst-case usage across all accounts
        const allUsage = getAllUsage();
        const worstCase = findWorstCaseUsage([...allUsage, data]);
        if (worstCase) {
          await updateTray(worstCase, settings?.trayDisplayLimit ?? "highest");
        }
      }

      setLoading(account_id, false);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [
    setUsage,
    setError,
    setLoading,
    setLastRefresh,
    getAllUsage,
    settings?.trayDisplayLimit,
  ]);

  // Listen for tray refresh events (manual refresh from tray menu)
  useEffect(() => {
    const unlisten = listen("tray-refresh", () => {
      forceRefresh();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [forceRefresh]);

  // Initial fetch on mount
  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      refreshAll();
    }
  }, [refreshAll]);

  // Update tray when trayDisplayLimit setting changes
  const trayDisplayLimit = settings?.trayDisplayLimit;
  useEffect(() => {
    const allUsage = getAllUsage();
    if (allUsage.length > 0 && trayDisplayLimit) {
      const worstCase = findWorstCaseUsage(allUsage);
      if (worstCase) {
        updateTray(worstCase, trayDisplayLimit);
      }
    }
  }, [trayDisplayLimit, getAllUsage]);

  return {
    accounts,
    usage,
    refreshAll,
    refreshAccount,
    forceRefresh,
    loadAccounts,
  };
}

/**
 * Find the usage data with the highest utilization across all accounts.
 * Used for tray display (worst-case scenario).
 */
function findWorstCaseUsage(usageList: UsageData[]): UsageData | null {
  if (usageList.length === 0) return null;
  if (usageList.length === 1) return usageList[0];

  // Find the usage with the highest max utilization
  return usageList.reduce((worst, current) => {
    const worstMax = Math.max(...worst.limits.map((l) => l.utilization));
    const currentMax = Math.max(...current.limits.map((l) => l.utilization));
    return currentMax > worstMax ? current : worst;
  });
}
