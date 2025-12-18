# Data Models

## TypeScript

### Core Types

```typescript
interface UsageData {
  provider: 'claude' | 'codex';
  timestamp: string;
  limits: UsageLimit[];
  raw?: unknown;
}

interface UsageLimit {
  id: string;           // e.g., 'five_hour', 'seven_day', 'weekly'
  label: string;        // Display name
  utilization: number;  // 0-100
  resetsAt: string;     // ISO 8601
  category?: string;    // e.g., 'opus', 'sonnet', 'messages'
}
```

### Settings

```typescript
interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  language: 'en';
  launchAtStartup: boolean;
  refreshMode: 'adaptive' | 'fixed';
  refreshInterval: 60 | 180 | 300 | 600;
  notifications: NotificationSettings;
  providers: ProviderConfig[];
}

interface NotificationSettings {
  enabled: boolean;
  thresholds: number[];     // e.g., [50, 75, 90]
  notifyOnReset: boolean;
  notifyOnExpiry: boolean;
}

interface ProviderConfig {
  id: 'claude' | 'codex';
  enabled: boolean;
  credentials: Record<string, string>;
}
```

### History

```typescript
interface UsageHistoryEntry {
  id: string;
  provider: 'claude' | 'codex';
  timestamp: string;
  limits: UsageLimit[];
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

### Data Structures

```rust
#[derive(Serialize, Deserialize, Clone)]
pub struct UsageData {
    pub provider: String,
    pub timestamp: DateTime<Utc>,
    pub limits: Vec<UsageLimit>,
    pub raw: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UsageLimit {
    pub id: String,
    pub label: String,
    pub utilization: f64,
    pub resets_at: DateTime<Utc>,
    pub category: Option<String>,
}
```
