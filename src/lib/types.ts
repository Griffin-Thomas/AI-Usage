export type ProviderId = "claude" | "chatgpt" | "gemini";

// ============================================================================
// Account Types (Multi-Account Support)
// ============================================================================

export interface Credentials {
  org_id?: string;
  session_key?: string;
  api_key?: string;
}

export interface Account {
  id: string;
  name: string;
  provider: ProviderId;
  credentials: Credentials;
  createdAt: string;
}

// ============================================================================
// Usage Types
// ============================================================================

export interface UsageData {
  provider: ProviderId;
  accountId: string;
  accountName: string;
  timestamp: string;
  limits: UsageLimit[];
  raw?: unknown;
}

// ============================================================================
// Provider Types
// ============================================================================

export type ProviderStatus = "available" | "blocked" | "planned";

export interface CredentialField {
  key: string;
  label: string;
  placeholder: string;
  isSecret: boolean;
}

export interface ProviderMetadata {
  id: ProviderId;
  name: string;
  status: ProviderStatus;
  requiredCredentials: CredentialField[];
  description?: string;
}

export interface UsageLimit {
  id: string;
  label: string;
  utilization: number;
  resetsAt: string;
  category?: string;
}

export interface ClaudeUsageResponse {
  five_hour: LimitUsage;
  seven_day?: LimitUsage;
  seven_day_oauth_apps?: LimitUsage;
  seven_day_opus?: LimitUsage;
  seven_day_sonnet?: LimitUsage;
}

export interface LimitUsage {
  utilization: number;
  resets_at: string;
}

// ============================================================================
// History Types
// ============================================================================

export interface UsageHistoryEntry {
  id: string;
  provider: ProviderId;
  accountId: string;
  accountName: string;
  timestamp: string;
  limits: UsageLimitSnapshot[];
}

export interface UsageLimitSnapshot {
  id: string;
  utilization: number;
  resetsAt: string;
}

export interface HistoryMetadata {
  entryCount: number;
  oldestEntry: string | null;
  newestEntry: string | null;
  lastCleanup: string | null;
  retentionDays: number;
}

export interface HistoryQuery {
  provider?: ProviderId;
  accountId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface UsageStats {
  provider: string;
  limitId: string;
  periodStart: string;
  periodEnd: string;
  avgUtilization: number;
  maxUtilization: number;
  minUtilization: number;
  sampleCount: number;
}

export interface RetentionPolicy {
  retentionDays: number;
  autoCleanup: boolean;
}
