# Data Models

## TypeScript

### Account Types

```typescript
type ProviderId = "claude" | "chatgpt" | "gemini";

interface Credentials {
  org_id?: string;
  session_key?: string;
  api_key?: string;
}

interface Account {
  id: string;
  name: string;
  provider: ProviderId;
  credentials: Credentials;
  createdAt: string;
}
```

### Usage Types

```typescript
interface UsageData {
  provider: ProviderId;
  accountId: string;
  accountName: string;
  timestamp: string;
  limits: UsageLimit[];
  raw?: unknown;
}

interface UsageLimit {
  id: string;           // e.g., 'five_hour', 'seven_day'
  label: string;        // Display name
  utilization: number;  // 0-100
  resetsAt: string;     // ISO 8601
  category?: string;    // e.g., 'opus', 'sonnet'
}
```

### Provider Types

```typescript
type ProviderStatus = "available" | "blocked" | "planned";

interface CredentialField {
  key: string;
  label: string;
  placeholder: string;
  isSecret: boolean;
}

interface ProviderMetadata {
  id: ProviderId;
  name: string;
  status: ProviderStatus;
  requiredCredentials: CredentialField[];
  description?: string;
}
```

### Settings

```typescript
interface AppSettings {
  theme: 'light' | 'dark' | 'system' | 'pink';
  language: 'en';
  launchAtStartup: boolean;
  refreshMode: 'adaptive' | 'fixed';
  refreshInterval: 60 | 180 | 300 | 600;
  trayDisplayLimit: 'highest' | 'five_hour' | 'seven_day';
  globalShortcut?: string;
  notifications: NotificationSettings;
  providers: ProviderConfig[];
}

interface NotificationSettings {
  enabled: boolean;
  thresholds: number[];     // e.g., [50, 75, 90]
  notifyOnReset: boolean;
  notifyOnExpiry: boolean;
  dndEnabled: boolean;
  dndStartTime?: string;    // e.g., "22:00"
  dndEndTime?: string;      // e.g., "08:00"
}

interface ProviderConfig {
  id: ProviderId;
  enabled: boolean;
  credentials: Record<string, string>;
}
```

### History

```typescript
interface UsageHistoryEntry {
  id: string;
  provider: ProviderId;
  accountId: string;
  accountName: string;
  timestamp: string;
  limits: UsageLimitSnapshot[];
}

interface UsageLimitSnapshot {
  id: string;
  utilization: number;
  resetsAt: string;
}

interface HistoryMetadata {
  entryCount: number;
  oldestEntry: string | null;
  newestEntry: string | null;
  lastCleanup: string | null;
  retentionDays: number;
}

interface HistoryQuery {
  provider?: ProviderId;
  accountId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

interface UsageStats {
  provider: string;
  limitId: string;
  periodStart: string;
  periodEnd: string;
  avgUtilization: number;
  maxUtilization: number;
  minUtilization: number;
  sampleCount: number;
}

interface RetentionPolicy {
  retentionDays: number;
  autoCleanup: boolean;
}
```

---

## Rust

### Provider Trait

```rust
pub trait UsageProvider: Send + Sync {
    fn id(&self) -> &'static str;
    fn name(&self) -> &'static str;
    async fn fetch_usage(&self, credentials: &Credentials) -> Result<UsageData, ProviderError>;
    fn validate_credentials(&self, credentials: &Credentials) -> bool;
}
```

### Account Types

```rust
#[derive(Serialize, Deserialize, Clone)]
pub struct Credentials {
    pub org_id: Option<String>,
    pub session_key: Option<String>,
    pub api_key: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub credentials: Credentials,
    pub created_at: DateTime<Utc>,
}
```

### Usage Types

```rust
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UsageData {
    pub provider: String,
    pub account_id: String,
    pub account_name: String,
    pub timestamp: DateTime<Utc>,
    pub limits: Vec<UsageLimit>,
    pub raw: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UsageLimit {
    pub id: String,
    pub label: String,
    pub utilization: f64,
    pub resets_at: DateTime<Utc>,
    pub category: Option<String>,
}
```

### Settings Types

```rust
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String,
    pub language: String,
    pub launch_at_startup: bool,
    pub refresh_mode: String,
    pub refresh_interval: u32,
    pub tray_display_limit: String,
    pub global_shortcut: Option<String>,
    pub notifications: NotificationSettings,
    pub providers: Vec<ProviderConfig>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NotificationSettings {
    pub enabled: bool,
    pub thresholds: Vec<u32>,
    pub notify_on_reset: bool,
    pub notify_on_expiry: bool,
    pub dnd_enabled: bool,
    pub dnd_start_time: Option<String>,
    pub dnd_end_time: Option<String>,
}
```

### History Types

```rust
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UsageHistoryEntry {
    pub id: String,
    pub provider: String,
    pub account_id: String,
    pub account_name: String,
    pub timestamp: DateTime<Utc>,
    pub limits: Vec<UsageLimitSnapshot>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HistoryQuery {
    pub provider: Option<String>,
    pub account_id: Option<String>,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}
```
