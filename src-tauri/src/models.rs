use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Provider identifier (used in Phase 4 multi-provider support)
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum ProviderId {
    Claude,
    Codex,
}

#[allow(dead_code)]
impl ProviderId {
    pub fn as_str(&self) -> &'static str {
        match self {
            ProviderId::Claude => "claude",
            ProviderId::Codex => "codex",
        }
    }
}

impl std::fmt::Display for ProviderId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Credentials for a provider
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Credentials {
    /// Claude: organization ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub org_id: Option<String>,

    /// Claude: session key
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_key: Option<String>,

    /// Codex: API key (future use)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
}

/// Usage data returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageData {
    pub provider: String,
    pub timestamp: DateTime<Utc>,
    pub limits: Vec<UsageLimit>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw: Option<serde_json::Value>,
}

/// Individual usage limit
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageLimit {
    pub id: String,
    pub label: String,
    pub utilization: f64,
    pub resets_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
}

/// Claude API response structures
#[derive(Debug, Serialize, Deserialize)]
pub struct ClaudeUsageResponse {
    pub five_hour: Option<LimitUsage>,
    pub seven_day: Option<LimitUsage>,
    pub seven_day_oauth_apps: Option<LimitUsage>,
    pub seven_day_opus: Option<LimitUsage>,
    pub seven_day_sonnet: Option<LimitUsage>,
    // Additional fields from API (may be null)
    pub iguana_necktie: Option<LimitUsage>,
    pub extra_usage: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LimitUsage {
    pub utilization: f64,
    pub resets_at: String,
}

/// App settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String,
    pub language: String,
    pub launch_at_startup: bool,
    pub refresh_mode: String,
    pub refresh_interval: u32,
    pub notifications: NotificationSettings,
    pub providers: Vec<ProviderConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationSettings {
    pub enabled: bool,
    pub thresholds: Vec<u32>,
    pub notify_on_reset: bool,
    pub notify_on_expiry: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    pub id: String,
    pub enabled: bool,
    pub credentials: std::collections::HashMap<String, String>,
}

// ============================================================================
// History Models
// ============================================================================

/// A single usage history entry - snapshot of usage at a point in time
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageHistoryEntry {
    /// Unique identifier (timestamp-provider format)
    pub id: String,
    /// Provider ID (claude, codex, gemini)
    pub provider: String,
    /// When this snapshot was taken
    pub timestamp: DateTime<Utc>,
    /// Usage limits at this point in time
    pub limits: Vec<UsageLimitSnapshot>,
}

/// Snapshot of a usage limit for history storage
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageLimitSnapshot {
    pub id: String,
    pub utilization: f64,
    pub resets_at: DateTime<Utc>,
}

/// History storage metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryMetadata {
    /// Number of entries stored
    pub entry_count: usize,
    /// Oldest entry timestamp
    pub oldest_entry: Option<DateTime<Utc>>,
    /// Newest entry timestamp
    pub newest_entry: Option<DateTime<Utc>>,
    /// Last cleanup timestamp
    pub last_cleanup: Option<DateTime<Utc>>,
    /// Retention days setting
    pub retention_days: u32,
}

/// Query parameters for history retrieval
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryQuery {
    /// Filter by provider (optional)
    pub provider: Option<String>,
    /// Start of date range (optional)
    pub start_date: Option<DateTime<Utc>>,
    /// End of date range (optional)
    pub end_date: Option<DateTime<Utc>>,
    /// Limit number of results (optional, default 1000)
    pub limit: Option<usize>,
    /// Offset for pagination (optional)
    pub offset: Option<usize>,
}

/// Aggregated usage statistics for a time period
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageStats {
    pub provider: String,
    pub limit_id: String,
    pub period_start: DateTime<Utc>,
    pub period_end: DateTime<Utc>,
    pub avg_utilization: f64,
    pub max_utilization: f64,
    pub min_utilization: f64,
    pub sample_count: usize,
}

/// Data retention policy
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetentionPolicy {
    /// Number of days to keep history (30, 60, 90, or 0 for unlimited)
    pub retention_days: u32,
    /// Whether to auto-cleanup on app start
    pub auto_cleanup: bool,
}

impl Default for RetentionPolicy {
    fn default() -> Self {
        Self {
            retention_days: 30,
            auto_cleanup: true,
        }
    }
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            language: "en".to_string(),
            launch_at_startup: false,
            refresh_mode: "adaptive".to_string(),
            refresh_interval: 300,
            notifications: NotificationSettings {
                enabled: true,
                thresholds: vec![50, 75, 90],
                notify_on_reset: true,
                notify_on_expiry: true,
            },
            providers: vec![
                ProviderConfig {
                    id: "claude".to_string(),
                    enabled: true,
                    credentials: std::collections::HashMap::new(),
                },
                ProviderConfig {
                    id: "codex".to_string(),
                    enabled: false,
                    credentials: std::collections::HashMap::new(),
                },
            ],
        }
    }
}
