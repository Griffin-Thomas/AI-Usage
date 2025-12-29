import { create } from "zustand";
import type { UsageData, Account } from "./types";
import type { AppSettings } from "./tauri";

// ============================================================================
// Usage Store (keyed by accountId for multi-account support)
// ============================================================================

interface UsageState {
  usage: Record<string, UsageData | null>; // accountId -> UsageData
  isLoading: Record<string, boolean>;
  error: Record<string, string | null>;
  lastRefresh: Record<string, Date | null>;

  setUsage: (accountId: string, data: UsageData | null) => void;
  setLoading: (accountId: string, loading: boolean) => void;
  setError: (accountId: string, error: string | null) => void;
  setLastRefresh: (accountId: string, date: Date | null) => void;
  removeAccount: (accountId: string) => void;
  clearAll: () => void;
  getAllUsage: () => UsageData[];
}

export const useUsageStore = create<UsageState>((set, get) => ({
  usage: {},
  isLoading: {},
  error: {},
  lastRefresh: {},

  setUsage: (accountId, data) =>
    set((state) => ({
      usage: { ...state.usage, [accountId]: data },
    })),

  setLoading: (accountId, loading) =>
    set((state) => ({
      isLoading: { ...state.isLoading, [accountId]: loading },
    })),

  setError: (accountId, error) =>
    set((state) => ({
      error: { ...state.error, [accountId]: error },
    })),

  setLastRefresh: (accountId, date) =>
    set((state) => ({
      lastRefresh: { ...state.lastRefresh, [accountId]: date },
    })),

  removeAccount: (accountId) =>
    set((state) => {
      const newState = {
        usage: { ...state.usage },
        isLoading: { ...state.isLoading },
        error: { ...state.error },
        lastRefresh: { ...state.lastRefresh },
      };
      delete newState.usage[accountId];
      delete newState.isLoading[accountId];
      delete newState.error[accountId];
      delete newState.lastRefresh[accountId];
      return newState;
    }),

  clearAll: () =>
    set({
      usage: {},
      isLoading: {},
      error: {},
      lastRefresh: {},
    }),

  getAllUsage: () => {
    const state = get();
    return Object.values(state.usage).filter(
      (data): data is UsageData => data !== null
    );
  },
}));

// ============================================================================
// Accounts Store (for managing multiple accounts)
// ============================================================================

interface AccountsState {
  accounts: Account[];
  isLoading: boolean;
  error: string | null;

  setAccounts: (accounts: Account[]) => void;
  addAccount: (account: Account) => void;
  updateAccount: (account: Account) => void;
  removeAccount: (accountId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  getAccountById: (accountId: string) => Account | undefined;
}

export const useAccountsStore = create<AccountsState>((set, get) => ({
  accounts: [],
  isLoading: false,
  error: null,

  setAccounts: (accounts) => set({ accounts }),

  addAccount: (account) =>
    set((state) => ({
      accounts: [...state.accounts, account],
    })),

  updateAccount: (account) =>
    set((state) => ({
      accounts: state.accounts.map((a) =>
        a.id === account.id ? account : a
      ),
    })),

  removeAccount: (accountId) =>
    set((state) => ({
      accounts: state.accounts.filter((a) => a.id !== accountId),
    })),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  getAccountById: (accountId) => {
    return get().accounts.find((a) => a.id === accountId);
  },
}));

// ============================================================================
// Settings Store
// ============================================================================

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
  trayDisplayLimit: "highest",
  globalShortcut: null,
  notifications: {
    enabled: true,
    thresholds: [50, 75, 90],
    notifyOnReset: true,
    notifyOnExpiry: true,
    dndEnabled: false,
    dndStartTime: "22:00",
    dndEndTime: "08:00",
  },
  providers: [
    { id: "claude", enabled: true, credentials: {} },
    { id: "chatgpt", enabled: false, credentials: {} },
    { id: "gemini", enabled: false, credentials: {} },
  ],
};

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: defaultSettings,
  isLoading: false,

  setSettings: (settings) => set({ settings }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
