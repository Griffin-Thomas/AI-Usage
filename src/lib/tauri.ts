import { invoke } from "@tauri-apps/api/core";
import type {
  UsageData,
  ProviderId,
  ProviderMetadata,
  UsageHistoryEntry,
  HistoryMetadata,
  HistoryQuery,
  RetentionPolicy,
  UsageStats,
  Account,
  Credentials,
} from "./types";

// Re-export for backward compatibility
export type { Credentials };

// Usage commands
export async function fetchUsage(provider: ProviderId): Promise<UsageData> {
  return invoke<UsageData>("fetch_usage", { provider });
}

export async function fetchUsageForAccount(accountId: string): Promise<UsageData> {
  return invoke<UsageData>("fetch_usage_for_account", { accountId });
}

export async function validateCredentials(
  provider: ProviderId,
  credentials: Credentials
): Promise<boolean> {
  return invoke<boolean>("validate_credentials", { provider, credentials });
}

// Test connection result with detailed status
export interface TestConnectionResult {
  success: boolean;
  error_code: string | null;
  error_message: string | null;
  hint: string | null;
}

export async function testConnection(
  provider: ProviderId,
  credentials: Credentials
): Promise<TestConnectionResult> {
  return invoke<TestConnectionResult>("test_connection", { provider, credentials });
}

export async function listProviders(): Promise<ProviderMetadata[]> {
  return invoke<ProviderMetadata[]>("list_providers");
}

// ============================================================================
// Account commands (Multi-Account Support)
// ============================================================================

export async function listAccounts(provider: ProviderId): Promise<Account[]> {
  return invoke<Account[]>("list_accounts", { provider });
}

export async function getAccount(accountId: string): Promise<Account | null> {
  return invoke<Account | null>("get_account", { accountId });
}

export async function saveAccount(account: Account): Promise<void> {
  return invoke("save_account", { account });
}

export async function deleteAccount(accountId: string): Promise<void> {
  return invoke("delete_account", { accountId });
}

export async function testAccountConnection(
  account: Account
): Promise<TestConnectionResult> {
  return invoke<TestConnectionResult>("test_account_connection", { account });
}

// Credential commands
export async function getCredentials(provider: ProviderId): Promise<Credentials | null> {
  return invoke<Credentials | null>("get_credentials", { provider });
}

export async function saveCredentials(
  provider: ProviderId,
  credentials: Credentials
): Promise<void> {
  return invoke("save_credentials", { provider, credentials });
}

export async function deleteCredentials(provider: ProviderId): Promise<void> {
  return invoke("delete_credentials", { provider });
}

export async function hasCredentials(provider: ProviderId): Promise<boolean> {
  return invoke<boolean>("has_credentials", { provider });
}

// Settings commands
export async function getSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_settings");
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  return invoke("save_settings", { settings });
}

export async function sendTestNotification(): Promise<void> {
  return invoke("send_test_notification");
}

// Scheduler commands
export interface SchedulerStatus {
  running: boolean;
  intervalSecs: number;
  lastFetch: number;
}

export async function getSchedulerStatus(): Promise<SchedulerStatus> {
  return invoke<SchedulerStatus>("get_scheduler_status");
}

export async function startScheduler(): Promise<void> {
  return invoke("start_scheduler");
}

export async function stopScheduler(): Promise<void> {
  return invoke("stop_scheduler");
}

export async function setRefreshInterval(intervalSecs: number): Promise<void> {
  return invoke("set_refresh_interval", { intervalSecs });
}

export async function forceRefresh(): Promise<void> {
  return invoke("force_refresh");
}

export async function resumeScheduler(): Promise<void> {
  return invoke("resume_scheduler");
}

export interface SessionStatus {
  valid: boolean;
  errorCount: number;
  paused: boolean;
}

export async function getSessionStatus(): Promise<SessionStatus> {
  return invoke<SessionStatus>("get_session_status");
}

// Settings types
export type TrayDisplayLimit = "highest" | "five_hour" | "seven_day";

export interface AppSettings {
  theme: "light" | "dark" | "system" | "pink";
  language: "en";
  launchAtStartup: boolean;
  refreshMode: "adaptive" | "fixed";
  refreshInterval: 60 | 180 | 300 | 600;
  trayDisplayLimit: TrayDisplayLimit;
  globalShortcut: string | null;
  notifications: NotificationSettings;
  providers: ProviderConfig[];
}

export interface NotificationSettings {
  enabled: boolean;
  thresholds: number[];
  notifyOnReset: boolean;
  notifyOnExpiry: boolean;
  dndEnabled: boolean;
  dndStartTime: string | null;
  dndEndTime: string | null;
}

export interface ProviderConfig {
  id: ProviderId;
  enabled: boolean;
  credentials: Record<string, string>;
}

// ============================================================================
// History commands
// ============================================================================

export async function queryHistory(
  query?: HistoryQuery
): Promise<UsageHistoryEntry[]> {
  return invoke<UsageHistoryEntry[]>("query_history", { query });
}

export async function getHistoryMetadata(): Promise<HistoryMetadata> {
  return invoke<HistoryMetadata>("get_history_metadata");
}

export async function getRetentionPolicy(): Promise<RetentionPolicy> {
  return invoke<RetentionPolicy>("get_retention_policy");
}

export async function setRetentionPolicy(
  policy: RetentionPolicy
): Promise<void> {
  return invoke("set_retention_policy", { policy });
}

export async function cleanupHistory(): Promise<number> {
  return invoke<number>("cleanup_history");
}

export async function getUsageStats(
  provider: ProviderId,
  limitId: string,
  start: string,
  end: string
): Promise<UsageStats | null> {
  return invoke<UsageStats | null>("get_usage_stats", {
    provider,
    limitId,
    start,
    end,
  });
}

export async function exportHistoryJson(
  query?: HistoryQuery
): Promise<string> {
  return invoke<string>("export_history_json", { query });
}

export async function exportHistoryCsv(
  query?: HistoryQuery
): Promise<string> {
  return invoke<string>("export_history_csv", { query });
}

export async function clearHistory(): Promise<void> {
  return invoke("clear_history");
}
