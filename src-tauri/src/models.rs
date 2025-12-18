use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Provider identifier
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum ProviderId {
    Claude,
    Codex,
}

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
    pub five_hour: LimitUsage,
    pub seven_day: Option<LimitUsage>,
    pub seven_day_oauth_apps: Option<LimitUsage>,
    pub seven_day_opus: Option<LimitUsage>,
    pub seven_day_sonnet: Option<LimitUsage>,
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

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
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
