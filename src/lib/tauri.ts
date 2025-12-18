import { invoke } from "@tauri-apps/api/core";
import type { UsageData, ProviderId } from "./types";

// Credentials type matching Rust
export interface Credentials {
  org_id?: string;
  session_key?: string;
  api_key?: string;
}

// Usage commands
export async function fetchUsage(provider: ProviderId): Promise<UsageData> {
  return invoke<UsageData>("fetch_usage", { provider });
}

export async function validateCredentials(
  provider: ProviderId,
  credentials: Credentials
): Promise<boolean> {
  return invoke<boolean>("validate_credentials", { provider, credentials });
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

// Settings types
export interface AppSettings {
  theme: "light" | "dark" | "system";
  language: "en";
  launchAtStartup: boolean;
  refreshMode: "adaptive" | "fixed";
  refreshInterval: 60 | 180 | 300 | 600;
  notifications: NotificationSettings;
  providers: ProviderConfig[];
}

export interface NotificationSettings {
  enabled: boolean;
  thresholds: number[];
  notifyOnReset: boolean;
  notifyOnExpiry: boolean;
}

export interface ProviderConfig {
  id: "claude" | "codex";
  enabled: boolean;
  credentials: Record<string, string>;
}
