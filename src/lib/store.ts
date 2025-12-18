import { create } from "zustand";
import type { UsageData, ProviderId } from "./types";
import type { AppSettings } from "./tauri";

interface UsageState {
  usage: Record<ProviderId, UsageData | null>;
  isLoading: Record<ProviderId, boolean>;
  error: Record<ProviderId, string | null>;
  lastRefresh: Record<ProviderId, Date | null>;

  setUsage: (provider: ProviderId, data: UsageData | null) => void;
  setLoading: (provider: ProviderId, loading: boolean) => void;
  setError: (provider: ProviderId, error: string | null) => void;
  setLastRefresh: (provider: ProviderId, date: Date | null) => void;
}

export const useUsageStore = create<UsageState>((set) => ({
  usage: { claude: null, codex: null },
  isLoading: { claude: false, codex: false },
  error: { claude: null, codex: null },
  lastRefresh: { claude: null, codex: null },

  setUsage: (provider, data) =>
    set((state) => ({
      usage: { ...state.usage, [provider]: data },
    })),

  setLoading: (provider, loading) =>
    set((state) => ({
      isLoading: { ...state.isLoading, [provider]: loading },
    })),

  setError: (provider, error) =>
    set((state) => ({
      error: { ...state.error, [provider]: error },
    })),

  setLastRefresh: (provider, date) =>
    set((state) => ({
      lastRefresh: { ...state.lastRefresh, [provider]: date },
    })),
}));

interface SettingsState {
  settings: AppSettings | null;
  isLoading: boolean;
  setSettings: (settings: AppSettings) => void;
  setLoading: (loading: boolean) => void;
}

const defaultSettings: AppSettings = {
  theme: "system",
  language: "en",
  launchAtStartup: false,
  refreshMode: "adaptive",
  refreshInterval: 300,
  notifications: {
    enabled: true,
    thresholds: [50, 75, 90],
    notifyOnReset: true,
    notifyOnExpiry: true,
  },
  providers: [
    { id: "claude", enabled: true, credentials: {} },
    { id: "codex", enabled: false, credentials: {} },
  ],
};

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: defaultSettings,
  isLoading: false,

  setSettings: (settings) => set({ settings }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
